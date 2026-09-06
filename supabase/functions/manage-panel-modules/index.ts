import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { requirePanelSession } from '../_shared/panel-session.ts';
import { isPlatformAdminAccount } from '../_shared/platform-admin.ts';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';
import { requestDiscordTarget } from '../_shared/discord-delivery.ts';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const id = (value: unknown) => /^\d{15,22}$/.test(String(value || '').trim()) ? String(value).trim() : '';
const key = (value: unknown) => /^custom_[a-z0-9_]{2,60}$/.test(String(value || '').trim()) ? String(value).trim() : '';
const roleIds = (value: unknown) => Array.isArray(value) ? [...new Set(value.map((item) => id(item)).filter(Boolean))].slice(0, 50) : [];
const secret = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;

function payload(module: any) {
  const definition = module.definition && typeof module.definition === 'object' ? module.definition : {};
  const buttons = Array.isArray(definition.buttons) ? definition.buttons.slice(0, 20) : [];
  const components: any[] = [];
  for (let index = 0; index < buttons.length && components.length < 4; index += 5) components.push({ type: 1, components: buttons.slice(index, index + 5).map((button: any, offset: number) => ({ type: 2, style: [1,2,3,4].includes(Number(button.style)) ? Number(button.style) : 1, label: String(button.label || `Acțiune ${index + offset + 1}`).slice(0, 80), custom_id: `panel:custom:${module.module_key}:${index + offset}:${String(button.action || 'open_form').replace(/[^a-z0-9_-]/gi, '_').slice(0, 32)}` })) });
  return { allowed_mentions: { parse: [] }, embeds: [{ title: String(definition.title || module.label || 'Modul Panel Pro').slice(0, 256), description: String(definition.description || module.description || 'Folosește butoanele de mai jos.').slice(0, 4096), color: Number(definition.color || 0x5865f2), fields: Array.isArray(definition.fields) ? definition.fields.slice(0, 25) : [], footer: { text: String(definition.footer || 'Panel Pro · modul custom').slice(0, 2048) } }], components };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);
  try {
    const service = secret(); if (!service) return reply({ error: 'Cheia serverului lipsește.' }, 500);
    const db = createClient(Deno.env.get('SUPABASE_URL')!, service);
    const session = await requirePanelSession(db, request, 0);
    const platformAdmin = session.is_platform_admin || await isPlatformAdminAccount(db, session.discord_id);
    if (!platformAdmin) return reply({ error: 'Acces permis doar administratorului global.' }, 403);
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'catalog');
    if (action === 'catalog') {
      const [{ data: modules, error: moduleError }, { data: publications, error: publicationError }, { data: guilds, error: guildError }, { data: organizations, error: organizationError }] = await Promise.all([
        db.from('platform_module_templates').select('module_key,label,description,definition,enabled,updated_at').eq('enabled', true).order('label'),
        platformAdmin ? db.from('platform_module_publications').select('id,module_key,organization_id,guild_id,target,embed_channel_id,result_channel_id,permissions,message_id,status,last_error,published_at,updated_at') : db.from('platform_module_publications').select('id,module_key,organization_id,guild_id,target,embed_channel_id,result_channel_id,permissions,message_id,status,last_error,published_at,updated_at').eq('organization_id', session.organization_id),
        platformAdmin ? db.from('organization_guilds').select('organization_id,guild_id,guild_name,kind,enabled').eq('enabled', true).order('kind') : db.from('organization_guilds').select('organization_id,guild_id,guild_name,kind,enabled').eq('organization_id', session.organization_id).eq('enabled', true).order('kind'),
        platformAdmin ? db.from('organizations').select('id,name').eq('active', true).order('name') : db.from('organizations').select('id,name').eq('id', session.organization_id)
      ]);
      if (moduleError || publicationError || guildError || organizationError) throw moduleError || publicationError || guildError || organizationError;
      const botToken = await getPlatformSecret(db, 'discord_bot_token');
      const roles: any[] = [];
      if (botToken) {
        for (const guild of guilds || []) {
          const response = await fetch(`https://discord.com/api/v10/guilds/${encodeURIComponent(String(guild.guild_id))}/roles`, { headers: { Authorization: `Bot ${botToken}` } });
          if (!response.ok) continue;
          const rows = await response.json().catch(() => []);
          if (Array.isArray(rows)) rows.filter((role: any) => !role?.managed && String(role?.id || '') !== String(guild.guild_id)).forEach((role: any) => roles.push({ guild_id: String(guild.guild_id), guild_name: String(guild.guild_name || guild.guild_id), kind: String(guild.kind || 'primary'), id: String(role.id), name: String(role.name || role.id), position: Number(role.position || 0) }));
        }
      }
      return reply({ modules: modules || [], publications: publications || [], guilds: guilds || [], organizations: organizations || [], roles, organization_id: session.organization_id, platform_admin: platformAdmin });
    }
    const moduleKey = key(body.module_key); if (!moduleKey) return reply({ error: 'Modul invalid.' }, 400);
    const { data: module, error: moduleError } = await db.from('platform_module_templates').select('module_key,label,description,definition,enabled').eq('module_key', moduleKey).eq('enabled', true).maybeSingle();
    if (moduleError) throw moduleError; if (!module) return reply({ error: 'Modulul nu există sau este dezactivat.' }, 404);
    const organizationId = String(body.organization_id || session.organization_id); if (!/^[0-9a-f-]{36}$/i.test(organizationId)) return reply({ error: 'Organizația este invalidă.' }, 400);
    if (!platformAdmin) return reply({ error: 'Acces permis doar administratorului global.' }, 403);
    const guildId = id(body.guild_id); const target = body.target === 'secondary' ? 'secondary' : 'primary'; const embedChannelId = id(body.embed_channel_id); const resultChannelId = body.result_channel_id ? id(body.result_channel_id) : '';
    const permissions = { allowed_role_ids: roleIds(body.permissions?.allowed_role_ids), approval_role_ids: roleIds(body.permissions?.approval_role_ids) };
    if (!guildId || !embedChannelId) return reply({ error: 'Guild-ul și canalul embed sunt obligatorii.' }, 400);
    if (['publish', 'repair'].includes(action) && Array.isArray(module.definition?.buttons) && module.definition.buttons.length && !resultChannelId) return reply({ error: 'Pentru un modul cu butoane este obligatoriu canalul de rezultate.' }, 400);
    const { data: guild } = await db.from('organization_guilds').select('guild_id,kind').eq('organization_id', organizationId).eq('guild_id', guildId).eq('enabled', true).maybeSingle();
    if (!guild || String(guild.kind || 'primary') !== target) return reply({ error: 'Guild-ul nu aparține organizației sau țintei selectate.' }, 400);
    if (action === 'save_publication' || action === 'publish' || action === 'repair') {
      let messageId = String(body.message_id || '').trim();
      const botToken = await getPlatformSecret(db, 'discord_bot_token'); if (!botToken) return reply({ error: 'DISCORD_BOT_TOKEN lipsește din Supabase.' }, 500);
      const bodyJson = JSON.stringify(payload(module));
      if (action !== 'save_publication') {
        const response = await requestDiscordTarget(db, { target, transport: 'bot', channel_id: embedChannelId }, bodyJson, id(messageId) ? { method: 'PATCH', messageId } : { method: 'POST' });
        if (!response.ok && id(messageId)) {
          const fallback = await requestDiscordTarget(db, { target, transport: 'bot', channel_id: embedChannelId }, bodyJson, { method: 'POST' });
          if (!fallback.ok) throw new Error(`Embedul nu a putut fi publicat (HTTP ${fallback.status}).`);
          const sent = await fallback.json().catch(() => ({})); messageId = String(sent?.id || '');
        } else if (!response.ok) throw new Error(`Embedul nu a putut fi publicat (HTTP ${response.status}).`);
        else { const sent = await response.json().catch(() => ({})); messageId = String(sent?.id || messageId); }
      }
      const row = { module_key: moduleKey, organization_id: organizationId, guild_id: guildId, target, embed_channel_id: embedChannelId, result_channel_id: resultChannelId || null, permissions, message_id: messageId || null, status: action === 'save_publication' ? 'draft' : 'published', last_error: null, published_at: action === 'save_publication' ? null : new Date().toISOString(), updated_at: new Date().toISOString() };
      const { data: saved, error } = await db.from('platform_module_publications').upsert(row, { onConflict: 'module_key,organization_id,target' }).select('*').single(); if (error) throw error;
      await db.from('platform_module_events').insert({ module_key: moduleKey, organization_id: organizationId, guild_id: guildId, discord_id: session.discord_id, event_type: `publication_${row.status}`, payload: { message_id: messageId, embed_channel_id: embedChannelId, result_channel_id: resultChannelId || null } });
      return reply({ ok: true, publication: saved });
    }
    return reply({ error: 'Acțiune necunoscută.' }, 400);
  } catch (error) { const message = error instanceof Error ? error.message : 'Eroare internă.'; return reply({ error: message }, /Sesiunea|Autentifică|expirat/i.test(message) ? 401 : 400); }
});
