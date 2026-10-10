import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { requirePanelSession } from '../_shared/panel-session.ts';
import { resolvePackageFeatures } from '../_shared/package-features.ts';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';
import { deliverDiscordRoute, routeCandidates } from '../_shared/discord-delivery.ts';

const headers = { 'Access-Control-Allow-Origin': 'https://panel-pro.ro', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session', 'Content-Type': 'application/json' };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const text = (value: unknown, max = 4000) => String(value ?? '').trim().slice(0, max);
const uuid = (value: unknown) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
const discordId = (value: unknown) => String(value || '').trim().replace(/^<@!?([0-9]{15,22})>$/, '$1');
const taskTypes = new Set(['employee_advancement', 'organization_weekly']);
const taskLabels: Record<string, string> = { employee_advancement: 'Task angajați · avansare', organization_weekly: 'Task săptămânal · organizație' };

const actorName = async (db: any, discordIdValue: string) => {
  const { data } = await db.from('users').select('display_name,username').eq('discord_id', discordIdValue).maybeSingle();
  return text(data?.display_name || data?.username || discordIdValue, 120);
};

const taskPayload = (task: any, buttons = true) => ({ allowed_mentions: { parse: [] }, embeds: [{ title: `📋 ${taskLabels[String(task.task_type)] || 'Task'}`, description: text(task.description || task.title || 'Fără detalii.', 4096), color: task.status === 'accepted' ? 0x22c55e : task.status === 'refused' ? 0xef4444 : 0xf59e0b, fields: [
  { name: '👤 Destinatar', value: `<@${String(task.assignee_discord_id || '')}>`, inline: true },
  { name: '📅 Termen-limită', value: new Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', dateStyle: 'full', timeStyle: 'short' }).format(new Date(task.due_at)), inline: true },
  { name: '📌 Status', value: task.status === 'accepted' ? '✅ Acceptat' : task.status === 'refused' ? '❌ Refuzat' : task.status === 'expired' ? '⌛ Expirat' : '⏳ În așteptare', inline: false },
  ...(text(task.response_note) ? [{ name: '💬 Răspuns', value: text(task.response_note, 1024), inline: false }] : []),
], timestamp: new Date().toISOString(), footer: { text: 'Panel Pro · Task-uri' } }], components: buttons && task.status === 'pending' ? [{ type: 1, components: [{ type: 2, style: 3, label: '✅ Acceptă taskul', custom_id: `panel:tasks:accept:${task.id}` }, { type: 2, style: 4, label: '❌ Refuză taskul', custom_id: `panel:tasks:refuse:${task.id}` }] }] : [] });

const logPayload = (task: any) => ({ allowed_mentions: { parse: [] }, embeds: [{ title: `${task.status === 'accepted' ? '✅' : '❌'} ${taskLabels[String(task.task_type)] || 'Task'} · ${task.status === 'accepted' ? 'acceptat' : 'refuzat'}`, color: task.status === 'accepted' ? 0x22c55e : 0xef4444, fields: [
  { name: '📋 Task', value: text(task.description || task.title || 'Task', 1024), inline: false },
  { name: '👤 Destinatar', value: `<@${String(task.assignee_discord_id || '')}>`, inline: true },
  { name: '📅 Termen-limită', value: new Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', dateStyle: 'full', timeStyle: 'short' }).format(new Date(task.due_at)), inline: true },
  { name: '💬 Răspuns', value: task.status === 'accepted' ? 'Taskul a fost acceptat.' : 'Taskul a fost refuzat.', inline: false },
], timestamp: new Date().toISOString(), footer: { text: 'Panel Pro · Log task-uri' } }] });

async function accessFor(db: any, session: any, page: string, feature: string) {
  const { data, error } = await db.from('app_settings').select('key,value').eq('organization_id', session.organization_id).in('key', ['page_permissions', 'organization_package']);
  if (error) throw error;
  const values = Object.fromEntries((data || []).map((row: any) => [row.key, row.value || {}]));
  const enabled = resolvePackageFeatures(values.organization_package || {}).includes(feature);
  const roleIds = new Set((session.discord_role_ids || []).map(String));
  const configuredRoles = Array.isArray(values.page_permissions?.[page]) ? values.page_permissions[page].map(String) : [];
  const canRead = session.is_platform_admin === true || Number(session.permission_level || 0) >= 7 || configuredRoles.some((id: string) => roleIds.has(id));
  if (!enabled && !session.is_platform_admin) throw new Error(`Modulul ${taskLabels[feature === 'employee_tasks' ? 'employee_advancement' : 'organization_weekly']} nu este activ în pachetul organizației.`);
  if (!canRead) throw new Error('Nu ai acces la această pagină. Selectează rolul tău în organizatii.html.');
  return { values, canWrite: canRead, platformAdmin: session.is_platform_admin === true };
}

async function sendDm(db: any, task: any) {
  const token = await getPlatformSecret(db, 'discord_bot_token');
  if (!token) throw new Error('Tokenul botului Discord nu este configurat.');
  const requestHeaders = { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };
  const channelResponse = await fetch('https://discord.com/api/v10/users/@me/channels', { method: 'POST', headers: requestHeaders, body: JSON.stringify({ recipient_id: String(task.assignee_discord_id) }) });
  const channel = await channelResponse.json().catch(() => ({}));
  if (!channelResponse.ok || !channel?.id) throw new Error('Mesajul privat nu a putut fi deschis pentru destinatar.');
  const messageResponse = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, { method: 'POST', headers: requestHeaders, body: JSON.stringify(taskPayload(task, true)) });
  const message = await messageResponse.json().catch(() => ({}));
  if (!messageResponse.ok || !message?.id) throw new Error('Taskul a fost salvat, dar DM-ul nu a putut fi trimis.');
  return { channel_id: String(channel.id), message_id: String(message.id) };
}

async function loadGuildMembers(db: any, guildId: string) {
  const token = await getPlatformSecret(db, 'discord_bot_token');
  if (!token) throw new Error('Tokenul botului Discord nu este configurat.');
  const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`, { headers: { Authorization: `Bot ${token}` } });
  const rows = await response.json().catch(() => []);
  if (!response.ok || !Array.isArray(rows)) throw new Error('Membrii serverului Discord nu au putut fi încărcați. Verifică Server Members Intent și accesul botului.');
  return rows.filter((row: any) => row?.user?.id && row.user.bot !== true).map((row: any) => ({ discord_id: String(row.user.id), name: text(row.user.global_name || row.user.username || row.user.id, 100), panel_role: '', guild_id: guildId }));
}

async function sendLog(db: any, organizationId: string, guildId: string, task: any) {
  const { data: settings, error } = await db.from('organization_settings').select('discord_channel_routes').eq('organization_id', organizationId).maybeSingle();
  if (error) throw error;
  const route = settings?.discord_channel_routes?.log_tasks || {};
  const target = route.primary?.guild_id === guildId ? 'primary' : route.secondary?.guild_id === guildId ? 'secondary' : '';
  if (!target || !route[target]?.channel_id) throw new Error('Canalul de log task-uri nu este configurat pentru serverul selectat.');
  const scoped = { discord_channel_routes: { log_tasks: { primary: target === 'primary' ? route.primary : null, secondary: target === 'secondary' ? route.secondary : null } } };
  const delivery = await deliverDiscordRoute(db, scoped, 'log_tasks', JSON.stringify(logPayload(task)), { postOnly: true, organizationId, messageKey: `task-page-${task.id}`, retryPayload: logPayload(task) });
  if (!delivery.results?.length) throw new Error(delivery.failures?.join(' | ') || 'Logul nu a putut fi trimis.');
  return String(delivery.results[0].id || '');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);
  try {
    const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    const db = createClient(Deno.env.get('SUPABASE_URL')!, secret);
    const session = await requirePanelSession(db, request);
    const body = await request.json().catch(() => ({}));
    const type = text(body.task_type, 40);
    if (!taskTypes.has(type)) throw new Error('Tipul taskului nu este valid.');
    const page = type === 'employee_advancement' ? 'task-angajati.html' : 'task-saptamanal.html';
    const feature = type === 'employee_advancement' ? 'employee_tasks' : 'organization_weekly_tasks';
    const access = await accessFor(db, session, page, feature);
    const [{ data: guilds, error: guildError }, { data: organizationMembers, error: memberError }] = await Promise.all([
      db.from('organization_guilds').select('guild_id,kind,enabled').eq('organization_id', session.organization_id),
      db.from('organization_members').select('discord_id,panel_role,active').eq('organization_id', session.organization_id).eq('active', true),
    ]);
    if (guildError || memberError) throw guildError || memberError;
    const targetGuild = (guilds || []).find((item: any) => item.kind === (type === 'organization_weekly' ? 'secondary' : 'primary') && item.enabled !== false) || (guilds || []).find((item: any) => item.enabled !== false);
    if (!targetGuild?.guild_id) throw new Error('Serverul Discord necesar pentru acest task nu este configurat.');
    const directory = await loadGuildMembers(db, String(targetGuild.guild_id));
    const storedMembers = Object.fromEntries((organizationMembers || []).map((item: any) => [String(item.discord_id), item]));
    const directoryIds = directory.map((item: any) => String(item.discord_id));
    const { data: directoryUsers, error: directoryUsersError } = await db.from('users').select('discord_id,display_name,username').in('discord_id', directoryIds.length ? directoryIds : ['-']);
    if (directoryUsersError) throw directoryUsersError;
    const directoryNames = Object.fromEntries((directoryUsers || []).map((item: any) => [String(item.discord_id), text(item.display_name || item.username || '', 100)]));
    const members = directory.map((item: any) => ({ ...item, name: directoryNames[item.discord_id] || item.name || `Membru Discord ${item.discord_id}`, panel_role: storedMembers[item.discord_id]?.panel_role || '' }));
    const action = text(body.action, 30) || 'load';
    if (action === 'load') {
      const ids = (members || []).map((item: any) => String(item.discord_id));
      const { data: users } = await db.from('users').select('discord_id,display_name,username').in('discord_id', ids.length ? ids : ['-']);
      const names = Object.fromEntries((users || []).map((item: any) => [String(item.discord_id), text(item.display_name || item.username || item.discord_id, 100)]));
      const { data: tasks, error } = await db.from('platform_tasks').select('*').eq('organization_id', session.organization_id).eq('guild_id', String(targetGuild.guild_id)).order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      return reply({ ok: true, tasks: tasks || [], members: (members || []).map((item: any) => ({ discord_id: String(item.discord_id), name: names[String(item.discord_id)] || String(item.discord_id), panel_role: item.panel_role || '' })), actor_name: await actorName(db, session.discord_id), access: { read: true, write: access.canWrite, platform_admin: access.platformAdmin }, guild_id: String(targetGuild.guild_id) });
    }
    if (action === 'create') {
      const description = text(body.description, 4000);
      const dueAt = new Date(String(body.due_at || ''));
      const assignees = [...new Set((Array.isArray(body.assignees) ? body.assignees : []).map(discordId).filter((id: string) => /^(\d{15,22})$/.test(id)))];
      const validMembers = new Set((members || []).map((item: any) => String(item.discord_id)));
      if (description.length < 2) throw new Error('Scrie taskul înainte de trimitere.');
      if (!Number.isFinite(dueAt.getTime()) || dueAt.getTime() <= Date.now()) throw new Error('Termenul-limită trebuie să fie în viitor.');
      if (!assignees.length || assignees.some((id: string) => !validMembers.has(id))) throw new Error('Selectează cel puțin un membru activ din organizație.');
      const groupId = crypto.randomUUID();
      const { data: tasks, error } = await db.from('platform_tasks').insert(assignees.map((id: string) => ({ task_group_id: groupId, organization_id: session.organization_id, guild_id: String(targetGuild.guild_id), title: 'Task', description, due_at: dueAt.toISOString(), assignee_discord_id: id, created_by_discord_id: session.discord_id }))).select('*');
      if (error) throw error;
      const failures: string[] = [];
      for (const task of tasks || []) {
        try { const dm = await sendDm(db, task); await db.from('platform_tasks').update({ dm_channel_id: dm.channel_id, dm_message_id: dm.message_id, updated_at: new Date().toISOString() }).eq('id', task.id); }
        catch (error) { const message = error instanceof Error ? error.message : 'DM-ul nu a putut fi trimis.'; failures.push(`<@${task.assignee_discord_id}>: ${message}`); await db.from('platform_tasks').update({ status: 'cancelled', response_note: message, updated_at: new Date().toISOString() }).eq('id', task.id); }
      }
      return reply({ ok: true, sent: (tasks || []).length - failures.length, failures, task_group_id: groupId });
    }
    if (action === 'delete') {
      if (!uuid(body.id)) throw new Error('Task invalid.');
      const { data: task, error } = await db.from('platform_tasks').select('id,created_by_discord_id').eq('organization_id', session.organization_id).eq('id', body.id).maybeSingle();
      if (error) throw error;
      if (!task) throw new Error('Taskul nu există.');
      if (!access.platformAdmin && String(task.created_by_discord_id) !== String(session.discord_id)) throw new Error('Nu poți șterge acest task.');
      const { error: deleteError } = await db.from('platform_tasks').delete().eq('organization_id', session.organization_id).eq('id', body.id);
      if (deleteError) throw deleteError;
      return reply({ ok: true });
    }
    return reply({ error: 'Acțiune necunoscută.' }, 400);
  } catch (error) { return reply({ error: error instanceof Error ? error.message : 'Taskul nu a putut fi procesat.' }, 400); }
});
