import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { requirePanelSession } from '../_shared/panel-session.ts';
import { isPlatformAdminAccount } from '../_shared/platform-admin.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const secretKey = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
const sections = new Set(['management', 'resurse', 'ilegal', 'administratie', 'feedback']);
const icons = /^[\p{Extended_Pictographic}\p{Emoji_Presentation}\w\s-]{1,8}$/u;

function cleanSlug(value: unknown) {
  const raw = String(value || '').trim().toLowerCase().replace(/\.html$/, '').replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!/^[a-z][a-z0-9-]{1,79}$/.test(raw)) throw new Error('Ruta paginii trebuie să conțină 2-80 caractere, fără spații.');
  return `${raw}.html`;
}

function cleanBlocks(value: unknown) {
  if (!Array.isArray(value)) throw new Error('Conținutul paginii trebuie să fie o listă de blocuri.');
  if (value.length > 40) throw new Error('Pagina poate avea maximum 40 de blocuri.');
  return value.map((block: any, index) => {
    const type = String(block?.type || 'text');
    if (!['heading', 'text', 'callout', 'list', 'link'].includes(type)) throw new Error(`Tip de bloc invalid la poziția ${index + 1}.`);
    const result: any = { type };
    if (type === 'list') {
      const items = Array.isArray(block.items) ? block.items.map((item: any) => String(item || '').trim()).filter(Boolean).slice(0, 30) : [];
      if (!items.length) throw new Error(`Lista de la poziția ${index + 1} este goală.`);
      result.items = items;
    } else {
      result.text = String(block.text || '').trim().slice(0, 2000);
      if (!result.text) throw new Error(`Blocul de la poziția ${index + 1} nu are text.`);
    }
    if (type === 'link') {
      const href = String(block.href || '').trim();
      if (!/^[a-z0-9][a-z0-9-]{1,79}\.html(?:[?#].*)?$/i.test(href)) throw new Error('Legăturile paginilor custom pot indica doar pagini Panel Pro.');
      result.href = href;
    }
    return result;
  });
}

function cleanModuleDefinition(value: unknown) {
  const source = value && typeof value === 'object' ? value as any : {};
  const allowedActions = new Set(['open_form', 'save_submission', 'send_log', 'approve', 'reject', 'report', 'update_message', 'notify_submitter']);
  const buttons = Array.isArray(source.buttons) ? source.buttons.slice(0, 20).map((button: any, index: number) => {
    const action = String(button?.action || 'open_form').trim();
    if (!allowedActions.has(action)) throw new Error(`Acțiunea butonului ${index + 1} nu este acceptată.`);
    return { label: String(button?.label || `Acțiune ${index + 1}`).trim().slice(0, 80), action, style: [1, 2, 3, 4].includes(Number(button?.style)) ? Number(button.style) : 1 };
  }) : [];
  const allowedTypes = new Set(['short_text', 'long_text', 'url']);
  const form_schema = Array.isArray(source.form_schema) ? source.form_schema.slice(0, 5).map((field: any, index: number) => {
    const type = String(field?.type || 'short_text').toLowerCase();
    if (!allowedTypes.has(type)) throw new Error(`Tipul câmpului ${index + 1} nu este acceptat. Folosește short_text, long_text sau url.`);
    const id = String(field?.id || `field_${index + 1}`).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 100);
    return { id, label: String(field?.label || `Câmp ${index + 1}`).trim().slice(0, 45), type, required: field?.required !== false, placeholder: String(field?.placeholder || '').slice(0, 100), max_length: Math.min(4000, Math.max(1, Number(field?.max_length) || (type === 'long_text' ? 1000 : 200))) };
  }) : [];
  const limits = source.limits && typeof source.limits === 'object' ? source.limits : {};
  const permissions = source.permissions && typeof source.permissions === 'object' ? source.permissions : {};
  const roleIds = (value: unknown) => Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter((item) => /^\d{15,22}$/.test(item)).slice(0, 50) : [];
  const fields = Array.isArray(source.fields) ? source.fields.slice(0, 25).map((field: any) => ({ name: String(field?.name || 'Informație').slice(0, 256), value: String(field?.value || '—').slice(0, 1024), inline: field?.inline === true })) : [];
  const responses = source.responses && typeof source.responses === 'object' ? { button: String(source.responses.button || '').slice(0, 2000), success: String(source.responses.success || '').slice(0, 2000), error: String(source.responses.error || '').slice(0, 2000), confirmation: String(source.responses.confirmation || '').slice(0, 2000), review: String(source.responses.review || '').slice(0, 2000) } : {};
  const workflowSource = source.workflow && typeof source.workflow === 'object' ? source.workflow : {};
  const workflowActions = [...new Set([...(Array.isArray(source.actions) ? source.actions : []), ...(Array.isArray(workflowSource.actions) ? workflowSource.actions : []), ...(source.handler === 'approval' ? ['review_buttons', 'send_log'] : [])].map((item) => String(item).trim()).filter((item) => ['review_buttons', 'send_log', 'update_message', 'notify_submitter'].includes(item)))];
  return { ...source, fields, responses, buttons, form_schema, workflow: { ...workflowSource, actions: workflowActions }, permissions: { allowed_role_ids: roleIds(permissions.allowed_role_ids), approval_role_ids: roleIds(permissions.approval_role_ids) }, limits: { cooldown_seconds: Math.max(0, Math.min(86400, Number(limits.cooldown_seconds) || 0)), max_requests: Math.max(0, Math.min(10000, Number(limits.max_requests) || 0)) }, slash_command: { enabled: source.slash_command?.enabled === true } };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);
  try {
    const key = secretKey();
    if (!key) return reply({ error: 'Cheia serverului lipsește.' }, 500);
    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    const session = await requirePanelSession(db, request, 0, true);
    if (!(session.is_platform_admin || await isPlatformAdminAccount(db, session.discord_id))) return reply({ error: 'Acces permis doar administratorului global.' }, 403);
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'list').trim();
    if (action === 'list') {
      const [{ data: pages, error: pagesError }, { data: modules, error: modulesError }] = await Promise.all([
        db.from('platform_custom_pages').select('slug,title,description,icon,sidebar_section,sort_order,content,enabled,updated_at').order('sidebar_section').order('sort_order').order('title'),
        db.from('platform_module_templates').select('module_key,label,description,definition,enabled,updated_at').order('label')
      ]);
      if (pagesError) throw pagesError;
      if (modulesError) throw modulesError;
      return reply({ pages: pages || [], modules: modules || [] });
    }
    if (action === 'save_page') {
      const slug = cleanSlug(body.slug);
      const title = String(body.title || '').trim().slice(0, 120);
      if (title.length < 2) throw new Error('Titlul paginii este obligatoriu.');
      const description = String(body.description || '').trim().slice(0, 500);
      const section = String(body.sidebar_section || 'administratie');
      if (!sections.has(section)) throw new Error('Zona sidebarului este invalidă.');
      const icon = String(body.icon || '📄').trim().slice(0, 8);
      if (!icons.test(icon)) throw new Error('Iconița paginii este invalidă.');
      const content = { blocks: cleanBlocks(body.content?.blocks ?? body.blocks ?? []) };
      const row = { slug, title, description, icon, sidebar_section: section, sort_order: Math.max(0, Math.min(9999, Number(body.sort_order) || 100)), content, enabled: body.enabled !== false, updated_by_discord_id: session.discord_id };
      const { data: existingPage } = await db.from('platform_custom_pages').select('*').eq('slug', slug).maybeSingle();
      if (existingPage) await db.from('platform_content_versions').insert({ content_type: 'page', content_key: slug, snapshot: existingPage, changed_by_discord_id: session.discord_id, change_type: 'before_save' });
      const { error } = await db.from('platform_custom_pages').upsert({ ...row, created_by_discord_id: existingPage?.created_by_discord_id || session.discord_id }, { onConflict: 'slug' });
      if (error) throw error;
      await db.from('platform_content_versions').insert({ content_type: 'page', content_key: slug, snapshot: { ...row, created_by_discord_id: existingPage?.created_by_discord_id || session.discord_id }, changed_by_discord_id: session.discord_id, change_type: 'saved' });
      await db.from('admin_audit_log').insert({ organization_id: session.organization_id, actor_discord_id: session.discord_id, action: 'platform_custom_page_saved', target_type: 'platform_custom_page', target_id: slug, details: { sidebar_section: section } });
      return reply({ ok: true, page: row });
    }
    if (action === 'delete_page') {
      const slug = cleanSlug(body.slug);
      const { error } = await db.from('platform_custom_pages').delete().eq('slug', slug);
      if (error) throw error;
      await db.from('admin_audit_log').insert({ organization_id: session.organization_id, actor_discord_id: session.discord_id, action: 'platform_custom_page_deleted', target_type: 'platform_custom_page', target_id: slug, details: {} });
      return reply({ ok: true, slug });
    }
    if (action === 'set_page_enabled') {
      const slug = cleanSlug(body.slug);
      const enabled = body.enabled !== false;
      const { data, error } = await db.from('platform_custom_pages').update({ enabled, updated_by_discord_id: session.discord_id, updated_at: new Date().toISOString() }).eq('slug', slug).select('slug,enabled').maybeSingle();
      if (error) throw error;
      if (!data) return reply({ error: 'Pagina nu există.' }, 404);
      await db.from('admin_audit_log').insert({ organization_id: session.organization_id, actor_discord_id: session.discord_id, action: enabled ? 'platform_custom_page_enabled' : 'platform_custom_page_disabled', target_type: 'platform_custom_page', target_id: slug, details: { enabled } });
      return reply({ ok: true, page: data });
    }
    if (action === 'history') {
      const contentType = body.content_type === 'module' ? 'module' : 'page';
      const contentKey = String(body.content_key || '').trim();
      if (!contentKey) throw new Error('Cheia conținutului lipsește.');
      const { data, error } = await db.from('platform_content_versions').select('id,content_type,content_key,snapshot,changed_by_discord_id,change_type,created_at').eq('content_type', contentType).eq('content_key', contentKey).order('created_at', { ascending: false }).limit(20);
      if (error) throw error;
      return reply({ versions: data || [] });
    }
    if (action === 'restore_page') {
      const slug = cleanSlug(body.slug);
      const versionId = Number(body.version_id);
      if (!Number.isInteger(versionId) || versionId < 1) throw new Error('Versiunea este invalidă.');
      const { data: version, error: versionError } = await db.from('platform_content_versions').select('snapshot').eq('id', versionId).eq('content_type', 'page').eq('content_key', slug).maybeSingle();
      if (versionError) throw versionError;
      if (!version?.snapshot) throw new Error('Versiunea nu a fost găsită.');
      const snapshot: any = version.snapshot;
      const { error } = await db.from('platform_custom_pages').upsert({ ...snapshot, slug, updated_by_discord_id: session.discord_id, updated_at: new Date().toISOString() }, { onConflict: 'slug' });
      if (error) throw error;
      await db.from('admin_audit_log').insert({ organization_id: session.organization_id, actor_discord_id: session.discord_id, action: 'platform_custom_page_restored', target_type: 'platform_custom_page', target_id: slug, details: { version_id: versionId } });
      return reply({ ok: true, slug });
    }
    if (action === 'restore_module') {
      const moduleKey = String(body.module_key || '').trim().toLowerCase();
      const versionId = Number(body.version_id);
      if (!/^custom_[a-z0-9_]{2,60}$/.test(moduleKey)) throw new Error('Cheia modulului este invalidă.');
      if (!Number.isInteger(versionId) || versionId < 1) throw new Error('Versiunea este invalidă.');
      const { data: version, error: versionError } = await db.from('platform_content_versions').select('snapshot').eq('id', versionId).eq('content_type', 'module').eq('content_key', moduleKey).maybeSingle();
      if (versionError) throw versionError;
      if (!version?.snapshot) throw new Error('Versiunea nu a fost găsită.');
      const snapshot: any = version.snapshot;
      const { error } = await db.from('platform_module_templates').upsert({ ...snapshot, module_key: moduleKey, updated_by_discord_id: session.discord_id, updated_at: new Date().toISOString() }, { onConflict: 'module_key' });
      if (error) throw error;
      await db.from('admin_audit_log').insert({ organization_id: session.organization_id, actor_discord_id: session.discord_id, action: 'platform_module_restored', target_type: 'platform_module_template', target_id: moduleKey, details: { version_id: versionId } });
      return reply({ ok: true, module_key: moduleKey });
    }
    if (action === 'save_module') {
      const moduleKey = String(body.module_key || '').trim().toLowerCase();
      if (!/^custom_[a-z0-9_]{2,60}$/.test(moduleKey)) throw new Error('Cheia modulului este invalidă.');
      const label = String(body.label || '').trim().slice(0, 120);
      if (label.length < 2) throw new Error('Numele modulului este obligatoriu.');
      const definition = cleanModuleDefinition(body.definition);
      const { data: existingModule } = await db.from('platform_module_templates').select('*').eq('module_key', moduleKey).maybeSingle();
      if (existingModule) await db.from('platform_content_versions').insert({ content_type: 'module', content_key: moduleKey, snapshot: existingModule, changed_by_discord_id: session.discord_id, change_type: 'before_save' });
      const { error } = await db.from('platform_module_templates').upsert({ module_key: moduleKey, label, description: String(body.description || '').trim().slice(0, 500), definition, enabled: body.enabled !== false, updated_by_discord_id: session.discord_id }, { onConflict: 'module_key' });
      if (error) throw error;
      await db.from('platform_content_versions').insert({ content_type: 'module', content_key: moduleKey, snapshot: { module_key: moduleKey, label, description: String(body.description || '').trim().slice(0, 500), definition, enabled: body.enabled !== false, updated_by_discord_id: session.discord_id }, changed_by_discord_id: session.discord_id, change_type: 'saved' });
      await db.from('admin_audit_log').insert({ organization_id: session.organization_id, actor_discord_id: session.discord_id, action: 'platform_module_template_saved', target_type: 'platform_module_template', target_id: moduleKey, details: { label } });
      return reply({ ok: true, module_key: moduleKey });
    }
    return reply({ error: 'Acțiune necunoscută.' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Eroare internă.';
    return reply({ error: message }, /Sesiunea|Autentifică|expirat/i.test(message) ? 401 : 400);
  }
});
