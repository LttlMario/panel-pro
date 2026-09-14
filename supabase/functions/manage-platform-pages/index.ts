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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const icons = /^[\p{Extended_Pictographic}\p{Emoji_Presentation}\w\s-]{1,8}$/u;
const rateBuckets = new Map<string, number[]>();
const formRateBuckets = new Map<string, number[]>();
const allowRequest = (identity: string) => { const now = Date.now(); const windowStart = now - 60_000; const recent = (rateBuckets.get(identity) || []).filter((timestamp) => timestamp > windowStart); if (recent.length >= 120) return false; recent.push(now); rateBuckets.set(identity, recent); if (rateBuckets.size > 2000) { for (const [key, values] of rateBuckets) if (!values.some((timestamp) => timestamp > windowStart)) rateBuckets.delete(key); } return true; };
const allowFormRequest = (identity: string) => { const now = Date.now(); const windowStart = now - 600_000; const recent = (formRateBuckets.get(identity) || []).filter((timestamp) => timestamp > windowStart); if (recent.length >= 8) return false; recent.push(now); formRateBuckets.set(identity, recent); if (formRateBuckets.size > 2000) { for (const [key, values] of formRateBuckets) if (!values.some((timestamp) => timestamp > windowStart)) formRateBuckets.delete(key); } return true; };
const recurrenceStepMs = (recurrence: unknown) => recurrence === 'daily' ? 86_400_000 : recurrence === 'weekly' ? 604_800_000 : recurrence === 'monthly' ? 2_592_000_000 : 0;
function recurrenceActive(publishAt: number, expiresAt: number, recurrence: unknown, recurrenceUntil: number, now: number) {
  if (Number.isFinite(publishAt) && publishAt > now) return false;
  const step = recurrenceStepMs(recurrence);
  if (!step) return !Number.isFinite(expiresAt) || expiresAt > now;
  if (Number.isFinite(recurrenceUntil) && now >= recurrenceUntil) return false;
  if (!Number.isFinite(publishAt)) return false;
  const cycleStart = publishAt + Math.floor(Math.max(0, now - publishAt) / step) * step;
  if (Number.isFinite(recurrenceUntil) && cycleStart >= recurrenceUntil) return false;
  if (!Number.isFinite(expiresAt)) return true;
  const windowLength = Math.max(0, expiresAt - publishAt);
  return now < cycleStart + windowLength;
}

function cleanSlug(value: unknown) {
  const raw = String(value || '').trim().toLowerCase().replace(/\.html$/, '').replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!/^[a-z][a-z0-9-]{1,79}$/.test(raw)) throw new Error('Ruta paginii trebuie să conțină 2-80 caractere, fără spații.');
  return `${raw}.html`;
}

function cleanPageHref(value: unknown) {
  const href = String(value || '').trim();
  return href === '#' || /^[a-z][a-z0-9-]{1,79}\.html(?:[?#].*)?$/i.test(href) ? href : '#';
}

function cleanPagePermissions(value: unknown) {
  const source = value && typeof value === 'object' ? value as any : {};
  const cleanIds = (input: unknown, pattern: RegExp) => Array.isArray(input) ? input.map((item) => String(item || '').trim()).filter((item) => pattern.test(item)).slice(0, 50) : [];
  const cleanAction = (input: unknown) => {
    const item = input && typeof input === 'object' ? input as any : {};
    const expiresAt = item.expires_at ? Date.parse(String(item.expires_at)) : NaN;
    return { organization_ids: cleanIds(item.organization_ids, UUID_RE), role_ids: cleanIds(item.role_ids, /^\d{15,22}$/), user_ids: cleanIds(item.user_ids, /^\d{15,22}$/), expires_at: Number.isFinite(expiresAt) ? new Date(expiresAt).toISOString() : null };
  };
  const actions = ['read', 'write', 'edit', 'approve', 'publish', 'archive', 'delete'];
  const result: any = { expires_at: null };
  actions.forEach((action) => { result[action] = cleanAction(source[action]); });
  const globalExpires = source.expires_at ? Date.parse(String(source.expires_at)) : NaN;
  if (Number.isFinite(globalExpires)) result.expires_at = new Date(globalExpires).toISOString();
  return result;
}

function cleanPageVisual(value: unknown) {
  const source = value && typeof value === 'object' ? value as any : {};
  return { accent: ['cyan', 'violet', 'emerald', 'amber', 'rose'].includes(String(source.accent)) ? String(source.accent) : 'cyan', font: ['system', 'mono', 'serif'].includes(String(source.font)) ? String(source.font) : 'system', spacing: ['compact', 'comfortable', 'spacious'].includes(String(source.spacing)) ? String(source.spacing) : 'comfortable', radius: ['small', 'medium', 'large'].includes(String(source.radius)) ? String(source.radius) : 'medium' };
}

function cleanPageSeo(value: unknown) {
  const source = value && typeof value === 'object' ? value as any : {};
  return { title: String(source.title || '').trim().slice(0, 120), description: String(source.description || '').trim().slice(0, 160), noindex: source.noindex === true };
}

function cleanPreviewToken(value: unknown) {
  const token = String(value || '').trim();
  return /^[A-Za-z0-9_-]{20,120}$/.test(token) ? token : null;
}

function pagePermissionAllows(page: any, action: string, session: any) {
  if (session?.is_platform_admin) return true;
  const rule = page?.content?.settings?.permissions?.[action];
  if (!rule || typeof rule !== 'object') return false;
  if (rule.expires_at && Date.parse(String(rule.expires_at)) <= Date.now()) return false;
  const organization = String(session?.organization_id || '');
  const discordId = String(session?.discord_id || '');
  const roleIds = Array.isArray(session?.discord_role_ids) ? session.discord_role_ids.map(String) : [];
  return (Array.isArray(rule.organization_ids) && rule.organization_ids.map(String).includes(organization)) || (Array.isArray(rule.user_ids) && rule.user_ids.map(String).includes(discordId)) || (Array.isArray(rule.role_ids) && roleIds.some((role: string) => rule.role_ids.map(String).includes(role)));
}

function cleanBlocks(value: unknown, depth = 0) {
  if (!Array.isArray(value)) throw new Error('Conținutul paginii trebuie să fie o listă de blocuri.');
  if (depth > 3) throw new Error('Structura grupurilor este prea adâncă.');
  if (value.length > 40) throw new Error('Pagina poate avea maximum 40 de blocuri.');
  const serialized = JSON.stringify(value);
  if (serialized.length > 220_000) throw new Error('Conținutul paginii este prea mare. Redu textul sau numărul de imagini.');
  if (/<\/?script\b|javascript\s*:|on[a-z]+\s*=|data:text\/html/i.test(serialized)) throw new Error('Conținutul conține markup sau cod nesigur.');
  return value.map((block: any, index) => {
    const type = String(block?.type || 'text');
    if (!['hero', 'heading', 'text', 'callout', 'list', 'link', 'cards', 'stats', 'faq', 'table', 'button', 'divider', 'form', 'gallery', 'timeline', 'calculator', 'accordion', 'tabs', 'banner', 'group'].includes(type)) throw new Error(`Tip de bloc invalid la poziția ${index + 1}.`);
    const result: any = { type };
    if (type === 'list') {
      const items = Array.isArray(block.items) ? block.items.map((item: any) => String(item || '').trim()).filter(Boolean).slice(0, 30) : [];
      if (!items.length) throw new Error(`Lista de la poziția ${index + 1} este goală.`);
      result.items = items;
    } else if (type === 'cards') {
      const cards = Array.isArray(block.cards) ? block.cards.slice(0, 8).map((card: any) => ({ title: String(card?.title || '').trim().slice(0, 120), text: String(card?.text || '').trim().slice(0, 500), href: cleanPageHref(card?.href) })).filter((card: any) => card.title && card.text) : [];
      if (!cards.length) throw new Error(`Cardurile de la poziția ${index + 1} sunt goale.`);
      result.cards = cards;
    } else if (type === 'faq') {
      const items = Array.isArray(block.items) ? block.items.slice(0, 15).map((item: any) => ({ question: String(item?.question || '').trim().slice(0, 180), answer: String(item?.answer || '').trim().slice(0, 1000) })).filter((item: any) => item.question && item.answer) : [];
      if (!items.length) throw new Error(`Întrebările FAQ de la poziția ${index + 1} sunt goale.`);
      result.items = items;
    } else if (type === 'stats') {
      const items = Array.isArray(block.items) ? block.items.slice(0, 8).map((item: any) => ({ label: String(item?.label || '').trim().slice(0, 80), value: String(item?.value || '0').trim().slice(0, 80), detail: String(item?.detail || '').trim().slice(0, 180) })).filter((item: any) => item.label) : [];
      if (!items.length) throw new Error(`Statisticile de la poziția ${index + 1} sunt goale.`);
      result.items = items;
    } else if (type === 'table') {
      const headers = Array.isArray(block.headers) ? block.headers.map((item: any) => String(item || '').trim().slice(0, 80)).filter(Boolean).slice(0, 8) : [];
      const rows = Array.isArray(block.rows) ? block.rows.slice(0, 20).map((row: any) => Array.isArray(row) ? row.map((cell: any) => String(cell || '').trim().slice(0, 200)).slice(0, 8) : []).filter((row: any[]) => row.length) : [];
      if (!headers.length || !rows.length) throw new Error(`Tabelul de la poziția ${index + 1} nu are date.`);
      result.headers = headers; result.rows = rows;
    } else if (type === 'form') {
      const fields = Array.isArray(block.fields) ? block.fields.slice(0, 15).map((field: any) => ({ label: String(field?.label || 'Câmp').trim().slice(0, 120), type: ['text', 'textarea', 'number', 'email'].includes(String(field?.type)) ? String(field.type) : 'text', required: field?.required !== false })).filter((field: any) => field.label) : [];
      if (!fields.length) throw new Error(`Formularul de la poziția ${index + 1} nu are câmpuri.`);
      result.fields = fields;
    } else if (type === 'gallery') {
      const items = Array.isArray(block.items) ? block.items.slice(0, 20).map((item: any) => ({ title: String(item?.title || 'Imagine').trim().slice(0, 120), text: String(item?.text || '').trim().slice(0, 500), src: String(item?.src || '').trim().slice(0, 500) })).filter((item: any) => item.title && (!item.src || /^(https?:\/\/|\/(?!\/)|\.\/)/i.test(item.src))) : [];
      if (!items.length) throw new Error(`Galeria de la poziția ${index + 1} este goală.`);
      result.items = items;
    } else if (type === 'timeline') {
      const items = Array.isArray(block.items) ? block.items.slice(0, 30).map((item: any) => ({ date: String(item?.date || 'Moment').trim().slice(0, 80), text: String(item?.text || '').trim().slice(0, 800) })).filter((item: any) => item.text) : [];
      if (!items.length) throw new Error(`Timeline-ul de la poziția ${index + 1} este gol.`);
      result.items = items;
    } else if (type === 'calculator') {
      const fields = Array.isArray(block.fields) ? block.fields.slice(0, 10).map((field: any) => ({ label: String(field?.label || 'Valoare').trim().slice(0, 120), type: 'number', value: Number.isFinite(Number(field?.value)) ? Number(field.value) : 0 })) : [];
      if (!fields.length) throw new Error(`Calculatorul de la poziția ${index + 1} nu are câmpuri.`);
      result.fields = fields; result.result = String(block.result || 'Total: 0').trim().slice(0, 200);
    } else if (type === 'accordion') {
      const items = Array.isArray(block.items) ? block.items.slice(0, 20).map((item: any) => ({ title: String(item?.title || 'Secțiune').trim().slice(0, 160), text: String(item?.text || '').trim().slice(0, 1200) })).filter((item: any) => item.title && item.text) : [];
      if (!items.length) throw new Error(`Acordeonul de la poziția ${index + 1} este gol.`);
      result.items = items;
    } else if (type === 'tabs') {
      const items = Array.isArray(block.items) ? block.items.slice(0, 12).map((item: any) => ({ title: String(item?.title || 'Tab').trim().slice(0, 120), text: String(item?.text || '').trim().slice(0, 1600) })).filter((item: any) => item.title && item.text) : [];
      if (!items.length) throw new Error(`Taburile de la poziția ${index + 1} sunt goale.`);
      result.items = items;
    } else if (type === 'group') {
      const blocks = Array.isArray(block.blocks) ? cleanBlocks(block.blocks, depth + 1).slice(0, 12) : [];
      if (!blocks.length) throw new Error(`Grupul de la poziția ${index + 1} este gol.`);
      result.title = String(block.title || 'Grup').trim().slice(0, 120); result.blocks = blocks;
    } else if (type === 'banner') {
      result.text = String(block.text || 'Banner informativ').trim().slice(0, 500); result.tone = ['info', 'success', 'warning', 'danger'].includes(String(block.tone)) ? String(block.tone) : 'info';
    } else if (type === 'button') {
      result.text = String(block.text || 'Deschide pagina').trim().slice(0, 120);
      result.href = String(block.href || 'index.html').trim().slice(0, 160);
    } else {
      result.text = String(block.text || '').trim().slice(0, 2000);
      if (type !== 'divider' && !result.text) throw new Error(`Blocul de la poziția ${index + 1} nu are text.`);
    }
    if (type === 'link' || type === 'button') {
      const href = String(block.href || '').trim();
      if (href !== '#' && !/^[a-z0-9][a-z0-9-]{1,79}\.html(?:[?#].*)?$/i.test(href)) throw new Error('Legăturile paginilor custom pot indica doar pagini Panel Pro sau ancora # pentru acțiuni locale.');
      result.href = href;
    }
    return result;
  });
}

function cleanSubmissionValues(value: unknown) {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const result: Record<string, string> = {};
  Object.entries(source).slice(0, 15).forEach(([key, raw]) => {
    const fieldKey = String(key || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 80);
    if (!fieldKey) return;
    result[fieldKey] = String(raw ?? '').trim().slice(0, 4000);
  });
  if (JSON.stringify(result).length > 45_000) throw new Error('Formularul este prea mare. Redu textul introdus.');
  return result;
}

function findFormBlock(page: any, blockIndex: unknown) {
  const path = Array.isArray(blockIndex) ? blockIndex.map(Number) : [Number(blockIndex)];
  if (!path.length || path.some((value) => !Number.isInteger(value) || value < 0 || value > 39)) throw new Error('Formularul nu este valid.');
  let block = Array.isArray(page?.content?.blocks) ? page.content.blocks[path[0]] : null;
  for (const index of path.slice(1)) block = block?.type === 'group' && Array.isArray(block.blocks) ? block.blocks[index] : null;
  if (!block || block.type !== 'form' || !Array.isArray(block.fields)) throw new Error('Formularul nu mai este disponibil.');
  return { index: path[0], path, block };
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
    const body = await request.json().catch(() => ({}));
      const action = String(body.action || 'list').trim();
    const identity = request.headers.get('x-panel-session') || request.headers.get('authorization') || request.headers.get('cf-connecting-ip') || 'anonymous';
    if (!allowRequest(identity.slice(0, 180))) return reply({ error: 'Prea multe solicitări. Încearcă din nou peste un minut.' }, 429);
    if (action === 'public_list') {
      const { data, error } = await db.from('platform_custom_pages').select('slug,title,description,icon,sidebar_section,sort_order,content,enabled,updated_at').eq('enabled', true).order('sidebar_section').order('sort_order').order('title');
      if (error) throw error;
      let authenticated = false;
      let audienceSession: any = null;
      const needsSession = (data || []).some((page: any) => { const permissions = page?.content?.settings?.permissions?.read; return permissions && (permissions.organization_ids?.length || permissions.role_ids?.length || permissions.user_ids?.length); });
      if (request.headers.get('x-panel-session') || needsSession) { try { audienceSession = await requirePanelSession(db, request, 0, true); authenticated = true; } catch (_) {} }
      const now = Date.now();
      const previewToken = cleanPreviewToken(body.preview_token);
      const pages = (data || []).filter((page: any) => {
        const settings = page?.content?.settings || {};
        const publishAt = settings.publish_at ? Date.parse(String(settings.publish_at)) : NaN;
        const expiresAt = settings.expires_at ? Date.parse(String(settings.expires_at)) : NaN;
        const recurrenceUntil = settings.recurrence_until ? Date.parse(String(settings.recurrence_until)) : NaN;
        const audience = settings.audience && typeof settings.audience === 'object' ? settings.audience : {};
        const organizations = Array.isArray(audience.organization_ids) ? audience.organization_ids.map(String) : [];
        const roles = Array.isArray(audience.role_ids) ? audience.role_ids.map(String) : [];
        const users = Array.isArray(audience.user_ids) ? audience.user_ids.map(String) : [];
        const device = String(audience.device || 'all');
        const requestDevice = String(request.headers.get('x-panel-device') || 'all');
        const audienceAllowed = (!organizations.length || (audienceSession && organizations.includes(String(audienceSession.organization_id)))) && (!roles.length || (audienceSession && audienceSession.discord_role_ids.some((role: string) => roles.includes(String(role))))) && (!users.length || (audienceSession && users.includes(String(audienceSession.discord_id)))) && (device === 'all' || requestDevice === 'all' || device === requestDevice);
        const permissions = settings.permissions && typeof settings.permissions === 'object' ? settings.permissions : {};
        const readPermission = permissions.read && typeof permissions.read === 'object' ? permissions.read : {};
        const permissionExpiry = readPermission.expires_at || permissions.expires_at;
        const permissionActive = !permissionExpiry || Date.parse(String(permissionExpiry)) > now;
        const permissionAllowed = (!readPermission.organization_ids?.length || (audienceSession && readPermission.organization_ids.includes(String(audienceSession.organization_id)))) && (!readPermission.role_ids?.length || (audienceSession && audienceSession.discord_role_ids.some((role: string) => readPermission.role_ids.includes(String(role))))) && (!readPermission.user_ids?.length || (audienceSession && readPermission.user_ids.includes(String(audienceSession.discord_id))));
        const approvalAllowed = settings.approval_required !== true || settings.approval_status === 'approved';
        const privatePreview = Boolean(previewToken && settings.preview_token === previewToken);
        const active = privatePreview || (settings.publication !== 'draft' && approvalAllowed && recurrenceActive(publishAt, expiresAt, settings.recurrence, recurrenceUntil, now));
        return active && (privatePreview || (permissionActive && permissionAllowed && audienceAllowed && (String(settings.access || 'global_admin') === 'public' || (authenticated && String(settings.access || '') === 'authenticated'))));
      });
      return reply({ pages });
    }
    if (action === 'submit_form') {
      const formIdentity = request.headers.get('x-panel-session') || request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'anonymous-form';
      if (!allowFormRequest(formIdentity.slice(0, 180))) return reply({ error: 'Ai trimis prea multe cereri. Încearcă din nou mai târziu.' }, 429);
      if (String(body.website || '').trim()) return reply({ ok: true, accepted: true });
      const slug = cleanSlug(body.slug);
      const { data: page, error: pageError } = await db.from('platform_custom_pages').select('slug,enabled,content').eq('slug', slug).maybeSingle();
      if (pageError) throw pageError;
      if (!page || page.enabled === false) return reply({ error: 'Pagina nu este disponibilă.' }, 404);
      const settings = page.content?.settings && typeof page.content.settings === 'object' ? page.content.settings : {};
      const now = Date.now();
      const publishAt = settings.publish_at ? Date.parse(String(settings.publish_at)) : NaN;
      const expiresAt = settings.expires_at ? Date.parse(String(settings.expires_at)) : NaN;
      const approvalAllowed = settings.approval_required !== true || settings.approval_status === 'approved';
      const recurrenceUntil = settings.recurrence_until ? Date.parse(String(settings.recurrence_until)) : NaN;
      if (settings.publication === 'draft' || !approvalAllowed || !recurrenceActive(publishAt, expiresAt, settings.recurrence, recurrenceUntil, now)) return reply({ error: 'Pagina nu acceptă formulare în acest moment.' }, 403);
      const access = String(settings.access || 'global_admin');
      let submitter: any = null;
      if (request.headers.get('x-panel-session')) {
        try { submitter = await requirePanelSession(db, request, 0, true); } catch (_) {}
      }
      if (access === 'authenticated' && !submitter) return reply({ error: 'Autentifică-te pentru a trimite acest formular.' }, 401);
      if (access === 'global_admin') return reply({ error: 'Această pagină nu acceptă trimiteri publice.' }, 403);
      const audience = settings.audience && typeof settings.audience === 'object' ? settings.audience : {};
      const audienceOrganizations = Array.isArray(audience.organization_ids) ? audience.organization_ids.map(String) : [];
      const audienceRoles = Array.isArray(audience.role_ids) ? audience.role_ids.map(String) : [];
      const audienceUsers = Array.isArray(audience.user_ids) ? audience.user_ids.map(String) : [];
      const submitterRoles = Array.isArray(submitter?.discord_role_ids) ? submitter.discord_role_ids.map(String) : [];
      if ((audienceOrganizations.length || audienceRoles.length || audienceUsers.length) && !submitter) return reply({ error: 'Autentifică-te pentru a trimite acest formular.' }, 401);
      if ((audienceOrganizations.length && !audienceOrganizations.includes(String(submitter?.organization_id))) || (audienceRoles.length && !submitterRoles.some((role: string) => audienceRoles.includes(role))) || (audienceUsers.length && !audienceUsers.includes(String(submitter?.discord_id)))) return reply({ error: 'Nu ai acces la această pagină.' }, 403);
      const readPermission = settings.permissions?.read && typeof settings.permissions.read === 'object' ? settings.permissions.read : {};
      const permissionRestricted = readPermission.organization_ids?.length || readPermission.role_ids?.length || readPermission.user_ids?.length;
      if (permissionRestricted && !submitter) return reply({ error: 'Autentifică-te pentru a trimite acest formular.' }, 401);
      if ((readPermission.organization_ids?.length && !readPermission.organization_ids.map(String).includes(String(submitter?.organization_id))) || (readPermission.role_ids?.length && !submitterRoles.some((role: string) => readPermission.role_ids.map(String).includes(role))) || (readPermission.user_ids?.length && !readPermission.user_ids.map(String).includes(String(submitter?.discord_id)))) return reply({ error: 'Nu ai permisiunea necesară pentru această pagină.' }, 403);
      const { index, path, block } = findFormBlock(page, body.block_path ?? body.block_index);
      const values = cleanSubmissionValues(body.values);
      (block.fields as any[]).forEach((field, fieldIndex) => {
        const key = `field_${fieldIndex}`;
        const value = String(values[key] || '').trim();
        if (field.required !== false && !value) throw new Error(`Câmpul „${String(field.label || `#${fieldIndex + 1}`)}” este obligatoriu.`);
        if (String(field.type) === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error(`Adresa de email din „${String(field.label || `#${fieldIndex + 1}`)}” nu este validă.`);
      });
      const { data: inserted, error: insertError } = await db.from('platform_page_submissions').insert({ page_slug: slug, block_index: index, values, submitter_discord_id: submitter?.discord_id || null, submitter_organization_id: submitter?.organization_id || null }).select('id,created_at').single();
      if (insertError) throw insertError;
      if (submitter?.organization_id) await db.from('admin_audit_log').insert({ organization_id: submitter.organization_id, actor_discord_id: submitter.discord_id || null, action: 'platform_page_form_submitted', target_type: 'platform_custom_page', target_id: slug, details: { submission_id: inserted.id, block_path: path } });
      return reply({ ok: true, submission_id: inserted.id, created_at: inserted.created_at });
    }
    const session = await requirePanelSession(db, request, 0, true);
    const isGlobalAdmin = session.is_platform_admin || await isPlatformAdminAccount(db, session.discord_id);
    if (!isGlobalAdmin) {
      const permissionAction = action === 'save_page' ? (body.publish === true ? 'publish' : 'edit') : action === 'delete_page' ? 'delete' : action === 'set_page_enabled' ? 'archive' : action === 'set_page_state' ? ((body.approve === true || body.reject === true) ? 'approve' : body.publication === 'published' ? 'publish' : 'archive') : action === 'restore_page' ? 'edit' : action === 'history' ? 'read' : null;
      const permissionSlug = String(body.slug || body.content_key || '').trim().replace(/\.html$/i, '');
      if (!permissionAction || !permissionSlug) return reply({ error: 'Acces permis doar administratorului global sau utilizatorului autorizat pentru această acțiune.' }, 403);
      const { data: protectedPage, error: permissionError } = await db.from('platform_custom_pages').select('content').eq('slug', `${permissionSlug}.html`).maybeSingle();
      if (permissionError) throw permissionError;
      if (!protectedPage || !pagePermissionAllows(protectedPage, permissionAction, session)) return reply({ error: 'Nu ai permisiunea necesară pentru această acțiune.' }, 403);
    }
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
      const sourceSettings = body.content?.settings && typeof body.content.settings === 'object' ? body.content.settings : {};
      const access = ['public', 'authenticated', 'global_admin'].includes(String(sourceSettings.access)) ? String(sourceSettings.access) : 'global_admin';
      const layout = ['single', 'wide', 'two-column'].includes(String(sourceSettings.layout)) ? String(sourceSettings.layout) : 'single';
      const category = ['legal', 'illegal', 'both'].includes(String(sourceSettings.category)) ? String(sourceSettings.category) : 'both';
      const publication = body.publish === true ? 'published' : body.publish === false ? 'draft' : (sourceSettings.publication === 'draft' ? 'draft' : 'published');
      const parseDate = (value: unknown) => { if (!value) return null; const timestamp = Date.parse(String(value)); return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null; };
      const publishAt = parseDate(sourceSettings.publish_at);
      const expiresAt = parseDate(sourceSettings.expires_at);
      const recurrence = ['none', 'daily', 'weekly', 'monthly'].includes(String(sourceSettings.recurrence)) ? String(sourceSettings.recurrence) : 'none';
      const recurrenceUntil = parseDate(sourceSettings.recurrence_until);
      if (publishAt && expiresAt && Date.parse(expiresAt) <= Date.parse(publishAt)) throw new Error('Expirarea trebuie să fie după momentul publicării.');
      if (publishAt && recurrenceUntil && Date.parse(recurrenceUntil) <= Date.parse(publishAt)) throw new Error('Finalul repetării trebuie să fie după momentul publicării.');
      const audienceSource = sourceSettings.audience && typeof sourceSettings.audience === 'object' ? sourceSettings.audience : {};
      const audience = { organization_ids: Array.isArray(audienceSource.organization_ids) ? audienceSource.organization_ids.map(String).filter((value: string) => UUID_RE.test(value)).slice(0, 50) : [], role_ids: Array.isArray(audienceSource.role_ids) ? audienceSource.role_ids.map(String).filter((value: string) => /^\d{15,22}$/.test(value)).slice(0, 50) : [], user_ids: Array.isArray(audienceSource.user_ids) ? audienceSource.user_ids.map(String).filter((value: string) => /^\d{15,22}$/.test(value)).slice(0, 50) : [], device: ['all', 'desktop', 'mobile'].includes(String(audienceSource.device)) ? String(audienceSource.device) : 'all' };
      const permissions = cleanPagePermissions(sourceSettings.permissions);
      const visual = cleanPageVisual(sourceSettings.visual);
      const seo = cleanPageSeo(sourceSettings.seo);
      const previewToken = cleanPreviewToken(sourceSettings.preview_token);
      const approvalRequired = sourceSettings.approval_required === true;
      const approvalStatus = approvalRequired ? (['pending', 'approved', 'rejected'].includes(String(sourceSettings.approval_status)) ? String(sourceSettings.approval_status) : 'pending') : 'approved';
      const themeValue = String(sourceSettings.theme || 'inherit');
      const theme = ['inherit', 'panel-pro', 'midnight', 'light', 'contrast'].includes(themeValue) ? themeValue : 'inherit';
      const content = { settings: { access, layout, theme, category, publication, publish_at: publishAt, expires_at: expiresAt, recurrence, recurrence_until: recurrenceUntil, audience, permissions, visual, seo, preview_token: previewToken, approval_required: approvalRequired, approval_status: approvalStatus, responsive: sourceSettings.responsive !== false }, blocks: cleanBlocks(body.content?.blocks ?? body.blocks ?? []) };
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
    if (action === 'set_page_state') {
      const slug = cleanSlug(body.slug);
      const publication = ['draft', 'published', 'archived'].includes(String(body.publication)) ? String(body.publication) : 'draft';
      const approvalStatus = body.approve === true ? 'approved' : body.reject === true ? 'rejected' : null;
      const { data: current, error: currentError } = await db.from('platform_custom_pages').select('content').eq('slug', slug).maybeSingle();
      if (currentError) throw currentError;
      if (!current) return reply({ error: 'Pagina nu există.' }, 404);
      const content = current.content && typeof current.content === 'object' ? current.content : {};
      const settings = content.settings && typeof content.settings === 'object' ? content.settings : {};
      await db.from('platform_content_versions').insert({ content_type: 'page', content_key: slug, snapshot: current, changed_by_discord_id: session.discord_id, change_type: `before_${publication}` });
      const nextSettings = { ...settings, publication, ...(approvalStatus ? { approval_status: approvalStatus, approval_required: true } : {}) };
      const { data, error } = await db.from('platform_custom_pages').update({ content: { ...content, settings: nextSettings }, enabled: publication !== 'archived', updated_by_discord_id: session.discord_id, updated_at: new Date().toISOString() }).eq('slug', slug).select('slug,enabled,content').maybeSingle();
      if (error) throw error;
      await db.from('admin_audit_log').insert({ organization_id: session.organization_id, actor_discord_id: session.discord_id, action: `platform_custom_page_${publication}`, target_type: 'platform_custom_page', target_id: slug, details: { publication } });
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
    if (action === 'audit') {
      const contentKey = cleanSlug(body.slug || body.content_key);
      const { data, error } = await db.from('admin_audit_log').select('id,actor_discord_id,action,target_type,target_id,details,created_at').eq('target_type', 'platform_custom_page').eq('target_id', contentKey).order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return reply({ entries: data || [] });
    }
    if (action === 'health') {
      const contentKey = cleanSlug(body.slug || body.content_key);
      const [{ data: page, error: pageError }, { count: versionCount, error: versionError }] = await Promise.all([
        db.from('platform_custom_pages').select('slug,title,enabled,content,updated_at').eq('slug', contentKey).maybeSingle(),
        db.from('platform_content_versions').select('id', { count: 'exact', head: true }).eq('content_type', 'page').eq('content_key', contentKey),
      ]);
      if (pageError) throw pageError;
      if (versionError) throw versionError;
      if (!page) return reply({ error: 'Pagina nu există.' }, 404);
      const settings = page.content?.settings || {};
      const now = Date.now();
      const publishAt = settings.publish_at ? Date.parse(String(settings.publish_at)) : NaN;
      const expiresAt = settings.expires_at ? Date.parse(String(settings.expires_at)) : NaN;
      return reply({ health: { slug: page.slug, title: page.title, enabled: page.enabled !== false, publication: settings.publication || 'published', approval_status: settings.approval_status || 'approved', scheduled: Number.isFinite(publishAt) && publishAt > now, expired: Number.isFinite(expiresAt) && expiresAt <= now, private_preview: Boolean(settings.preview_token), versions: versionCount || 0, updated_at: page.updated_at } });
    }
    if (action === 'list_submissions') {
      const slug = cleanSlug(body.slug || body.content_key);
      const limit = Math.max(1, Math.min(100, Number(body.limit) || 50));
      const { data, error } = await db.from('platform_page_submissions').select('id,page_slug,block_index,values,submitter_discord_id,submitter_organization_id,status,created_at,updated_at').eq('page_slug', slug).order('created_at', { ascending: false }).limit(limit);
      if (error) throw error;
      return reply({ submissions: data || [] });
    }
    if (action === 'update_submission_status') {
      const id = String(body.submission_id || '').trim();
      const status = ['new', 'read', 'handled', 'archived'].includes(String(body.status)) ? String(body.status) : '';
      if (!UUID_RE.test(id) || !status) throw new Error('Cererea sau starea este invalidă.');
      const { data, error } = await db.from('platform_page_submissions').update({ status, updated_at: new Date().toISOString() }).eq('id', id).select('id,status,updated_at').maybeSingle();
      if (error) throw error;
      if (!data) return reply({ error: 'Cererea nu există.' }, 404);
      await db.from('admin_audit_log').insert({ organization_id: session.organization_id, actor_discord_id: session.discord_id, action: 'platform_page_submission_status_updated', target_type: 'platform_page_submission', target_id: id, details: { status } });
      return reply({ ok: true, submission: data });
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
