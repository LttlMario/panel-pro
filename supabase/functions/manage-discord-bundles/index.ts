import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { requirePanelSession } from '../_shared/panel-session.ts';
import { isPlatformAdminAccount } from '../_shared/platform-admin.ts';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const id = (value: unknown) => /^\d{15,22}$/.test(String(value || '').trim()) ? String(value).trim() : '';
const api = 'https://discord.com/api/v10';
const VIEW = 1024n, SEND = 2048n, EMBED = 16384n, HISTORY = 65536n, MANAGE_MESSAGES = 8192n;
const allow = (...bits: bigint[]) => bits.reduce((sum, bit) => sum | bit, 0n).toString();

type ModuleSpec = { key: string; label: string; description: string; handler: string; color: number; fields?: any[]; buttons: any[]; review?: boolean; channel: string; logChannel: string };
type BundleSpec = { label: string; category: string; modules: ModuleSpec[] };

const field = (id: string, label: string, type = 'short_text', required = true) => ({ id, label, type, required, max_length: type === 'long_text' ? 1500 : 300 });
const module = (key: string, label: string, description: string, handler: string, color: number, channel: string, fields: any[] = [], review = false, button = 'Deschide formularul'): ModuleSpec => ({ key, label, description, handler, color, channel, logChannel: `🧾・log-${channel.replace(/^[^・]+・/, '')}`, fields, review, buttons: [{ label: button, action: handler === 'report' ? 'report' : 'open_form', style: review ? 3 : 1 }] });
const bundles: Record<string, BundleSpec> = {
  full: {
    label: 'Full', category: 'PANEL PRO · FULL', modules: [
      module('custom_full_anunturi', 'Anunțuri organizație', 'Publică anunțuri și comunicate.', 'announcement', 0x5865f2, '📣・anunturi', [field('message', 'Mesajul anunțului', 'long_text')], false, 'Publică anunț'),
      module('custom_full_cereri', 'Cereri organizație', 'Colectează cereri de la membrii organizației.', 'request', 0x3b82f6, '📋・cereri', [field('subject', 'Subiect'), field('details', 'Detalii', 'long_text')], false, 'Trimite cerere'),
      module('custom_full_aprobari', 'Cereri cu aprobare', 'Trimite cereri către staff pentru aprobare sau respingere.', 'approval', 0xf59e0b, '✅・aprobari', [field('subject', 'Subiect'), field('details', 'Detalii', 'long_text')], true, 'Trimite spre aprobare'),
      module('custom_full_contracte', 'Contracte și documente', 'Înregistrează documente și linkuri importante.', 'request', 0x8b5cf6, '📄・documente', [field('title', 'Titlu document'), field('url', 'Link document', 'url'), field('details', 'Detalii', 'long_text')], false, 'Adaugă document'),
      module('custom_full_pontaj', 'Pontaj și activitate', 'Centralizează pontajul și activitatea echipei.', 'report', 0x14b8a6, '⏱️・pontaj', [], false, 'Generează pontaj'),
      module('custom_full_rapoarte', 'Rapoarte organizație', 'Generează rapoarte pentru activitatea organizației.', 'report', 0x22c55e, '📊・rapoarte', [], false, 'Vezi raportul')
    ]
  },
  legal_management: {
    label: 'Legale + Management', category: 'PANEL PRO · LEGALE', modules: [
      module('custom_legal_anunturi', 'Anunțuri și comunicate', 'Publică informații oficiale.', 'announcement', 0x2563eb, '📣・anunturi-legale', [field('message', 'Mesajul anunțului', 'long_text')], false, 'Publică anunț'),
      module('custom_legal_cereri', 'Cereri oficiale', 'Primește solicitări oficiale de la membri.', 'approval', 0xf59e0b, '📋・cereri-legale', [field('subject', 'Subiect'), field('details', 'Detalii', 'long_text')], true, 'Trimite cerere'),
      module('custom_legal_contracte', 'Contracte și documente', 'Gestionează documentele organizației.', 'request', 0x7c3aed, '📄・contracte', [field('title', 'Titlu document'), field('url', 'Link document', 'url'), field('details', 'Detalii', 'long_text')], false, 'Adaugă document'),
      module('custom_legal_rapoarte', 'Rapoarte de management', 'Generează rapoarte de management.', 'report', 0x16a34a, '📊・rapoarte-legale', [], false, 'Generează raport'),
      module('custom_legal_pontaj', 'Pontaj echipă', 'Centralizează turele și activitatea.', 'report', 0x0891b2, '⏱️・pontaj-legal', [], false, 'Vezi pontajul')
    ]
  },
  illegal: {
    label: 'Ilegale', category: 'PANEL PRO · ILEGALE', modules: [
      module('custom_illegal_anunturi', 'Anunțuri Ilegale', 'Publică informații operaționale.', 'announcement', 0xdc2626, '📣・anunturi-ilegale', [field('message', 'Mesajul anunțului', 'long_text')], false, 'Publică anunț'),
      module('custom_illegal_cereri', 'Cereri operaționale', 'Trimite solicitări către staff.', 'approval', 0xea580c, '📋・cereri-ilegale', [field('subject', 'Subiect'), field('details', 'Detalii', 'long_text')], true, 'Trimite cerere'),
      module('custom_illegal_rapoarte', 'Rapoarte operaționale', 'Centralizează rapoartele operaționale.', 'report', 0xb91c1c, '📊・rapoarte-ilegale', [], false, 'Generează raport'),
      module('custom_illegal_sanctiuni', 'Sancțiuni și sesizări', 'Înregistrează sesizări pentru staff.', 'approval', 0x991b1b, '⚠️・sesizari', [field('member', 'Persoană / identificator'), field('details', 'Descrierea sesizării', 'long_text')], true, 'Trimite sesizare')
    ]
  }
};

const definitionFor = (item: ModuleSpec) => ({ title: item.label, description: item.description, color: item.color, handler: item.handler, form_schema: item.fields || [], buttons: item.buttons, workflow: { logging_enabled: true, actions: item.review ? ['review_buttons', 'send_log', 'update_message', 'notify_submitter'] : ['send_log', 'update_message'] }, responses: { success: 'Solicitarea a fost salvată și rezultatul a fost trimis în canalul de rezultate.', review: 'Solicitarea a fost trimisă pentru aprobare.', error: 'Solicitarea nu a putut fi procesată.' }, footer: 'Panel Pro · bot Discord' });
const embedPayload = (item: ModuleSpec) => ({ allowed_mentions: { parse: [] }, embeds: [{ title: item.label, description: item.description, color: item.color, footer: { text: 'Panel Pro · folosește butonul de mai jos' } }], components: [{ type: 1, components: item.buttons.map((button, index) => ({ type: 2, style: Number(button.style) || 1, label: String(button.label).slice(0, 80), custom_id: `panel:custom:${item.key}:${index}:${button.action}` })) }] });

async function discord(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`${api}${path}`, { ...init, headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Discord a refuzat operația (${response.status}): ${String(data?.message || data?.code || 'eroare necunoscută')}.`);
  return data;
}
const sameName = (rows: any[], name: string) => rows.find((row) => String(row?.name || '').trim() === name);
async function ensureRole(guildId: string, token: string, roles: any[], name: string) {
  const found = sameName(roles, name);
  if (found) return { row: found, created: false };
  const row = await discord(`/guilds/${guildId}/roles`, token, { method: 'POST', body: JSON.stringify({ name, color: name.includes('Staff') ? 0x5865f2 : 0x64748b, hoist: true, mentionable: true, permissions: '0' }) });
  roles.push(row); return { row, created: true };
}
async function ensureChannel(guildId: string, token: string, channels: any[], name: string, type: number, parentId = '', overwrites: any[] = []) {
  const found = channels.find((row) => String(row?.name || '').trim() === name && Number(row?.type) === type && (!parentId || String(row?.parent_id || '') === parentId));
  if (found) return { row: found, created: false };
  const row = await discord(`/guilds/${guildId}/channels`, token, { method: 'POST', body: JSON.stringify({ name, type, ...(parentId ? { parent_id: parentId } : {}), ...(overwrites.length ? { permission_overwrites: overwrites } : {}) }) });
  channels.push(row); return { row, created: true };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);
  try {
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    const db = createClient(Deno.env.get('SUPABASE_URL')!, service);
    const session = await requirePanelSession(db, request, 0);
    if (!(session.is_platform_admin || await isPlatformAdminAccount(db, session.discord_id))) return reply({ error: 'Acces permis doar administratorului global.' }, 403);
    const body = await request.json().catch(() => ({}));
    const bundle = bundles[String(body.bundle_key || '')];
    const organizationId = String(body.organization_id || '').trim();
    const guildId = id(body.guild_id);
    if (!bundle) return reply({ error: 'Preset Discord invalid.' }, 400);
    if (!/^[0-9a-f-]{36}$/i.test(organizationId) || !guildId) return reply({ error: 'Organizația sau serverul Discord sunt invalide.' }, 400);
    const { data: guild } = await db.from('organization_guilds').select('guild_id,kind').eq('organization_id', organizationId).eq('guild_id', guildId).eq('enabled', true).maybeSingle();
    if (!guild) return reply({ error: 'Serverul nu aparține organizației selectate.' }, 400);
    const token = await getPlatformSecret(db, 'discord_bot_token'); if (!token) return reply({ error: 'DISCORD_BOT_TOKEN lipsește din Supabase.' }, 500);
    const [guildInfo, channels] = await Promise.all([discord(`/guilds/${guildId}`, token), discord(`/guilds/${guildId}/channels`, token)]);
    const bot = await discord('/users/@me', token);
    const everyone = guildId;
    const botAllow = allow(VIEW, SEND, EMBED, HISTORY, MANAGE_MESSAGES);
    const botOverwrite = [{ id: String(bot.id), type: 1, allow: botAllow, deny: '0' }];
    const category = await ensureChannel(guildId, token, channels, bundle.category, 4);
    let createdChannels = Number(category.created), createdMessages = 0;
    const installedChannels: any[] = [];
    for (const item of bundle.modules) {
      const channel = await ensureChannel(guildId, token, channels, item.channel, 0, String(category.row.id), botOverwrite);
      createdChannels += Number(channel.created);
      const log = await ensureChannel(guildId, token, channels, item.logChannel, 0, String(category.row.id), botOverwrite);
      createdChannels += Number(log.created);
      const { data: existingModule } = await db.from('platform_module_templates').select('module_key').eq('module_key', item.key).maybeSingle();
      if (!existingModule) {
        const { error: moduleError } = await db.from('platform_module_templates').insert({ module_key: item.key, label: item.label, description: item.description, definition: definitionFor(item), enabled: true, updated_by_discord_id: session.discord_id });
        if (moduleError) throw moduleError;
      }
      const target = String(guild.kind || 'primary') === 'secondary' ? 'secondary' : 'primary';
      const { data: currentPublication } = await db.from('platform_module_publications').select('message_id').eq('module_key', item.key).eq('organization_id', organizationId).eq('target', target).maybeSingle();
      const messageUrl = `${api}/channels/${channel.row.id}/messages${currentPublication?.message_id ? `/${currentPublication.message_id}` : ''}`;
      let messageResponse = await fetch(messageUrl, { method: currentPublication?.message_id ? 'PATCH' : 'POST', headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(embedPayload(item)) });
      if (!messageResponse.ok && currentPublication?.message_id) messageResponse = await fetch(`${api}/channels/${channel.row.id}/messages`, { method: 'POST', headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(embedPayload(item)) });
      if (!messageResponse.ok) throw new Error(`Embedul „${item.label}” nu a putut fi publicat în canalul ${item.channel}.`);
      const message = await messageResponse.json().catch(() => ({}));
      if (!currentPublication?.message_id) createdMessages += 1;
      const { error: publicationError } = await db.from('platform_module_publications').upsert({ module_key: item.key, organization_id: organizationId, guild_id: guildId, target, embed_channel_id: String(channel.row.id), result_channel_id: String(log.row.id), permissions: {}, message_id: String(message.id || currentPublication?.message_id || ''), status: 'published', last_error: null, published_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'module_key,organization_id,target' });
      if (publicationError) throw publicationError;
      installedChannels.push({ id: String(channel.row.id), name: String(channel.row.name || item.channel), purpose: item.label, module_key: item.key, kind: 'embed' }, { id: String(log.row.id), name: String(log.row.name || item.logChannel), purpose: `log ${item.label}`, module_key: item.key, kind: 'log' });
    }
    await db.from('admin_audit_log').insert({ organization_id: organizationId, actor_discord_id: session.discord_id, action: 'discord_bundle_installed', target_type: 'discord_guild', target_id: guildId, details: { bundle: body.bundle_key, category_id: category.row.id, channel_count: installedChannels.length, module_count: bundle.modules.length } });
    return reply({ ok: true, guild: { id: guildInfo.id, name: guildInfo.name }, category: { id: category.row.id, name: bundle.category }, created: { channels: createdChannels, roles: 0, messages: createdMessages }, channels: installedChannels, modules_available: bundle.modules.map((item) => ({ module_key: item.key, label: item.label, embed_channel_id: installedChannels.find((channel) => channel.module_key === item.key && channel.kind === 'embed')?.id || '', result_channel_id: installedChannels.find((channel) => channel.module_key === item.key && channel.kind === 'log')?.id || '' })) });
  } catch (error) { return reply({ error: error instanceof Error ? error.message : 'Instalarea pachetului a eșuat.' }, 400); }
});
