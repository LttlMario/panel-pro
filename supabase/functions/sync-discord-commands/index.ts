import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { requirePanelSession } from '../_shared/panel-session.ts';
import { isPlatformAdminAccount } from '../_shared/platform-admin.ts';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const id = (value: unknown) => /^\d{15,22}$/.test(String(value || '').trim()) ? String(value).trim() : '';
const secret = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);
  try {
    const service = secret(); if (!service) return reply({ error: 'Cheia serverului lipsește.' }, 500);
    const db = createClient(Deno.env.get('SUPABASE_URL')!, service);
    const session = await requirePanelSession(db, request, 0);
    if (!(session.is_platform_admin || await isPlatformAdminAccount(db, session.discord_id))) return reply({ error: 'Acces permis doar administratorului global.' }, 403);
    const body = await request.json().catch(() => ({}));
    const guildId = id(body.guild_id); if (!guildId) return reply({ error: 'Guild-ul este obligatoriu.' }, 400);
    const { data: guild } = await db.from('organization_guilds').select('organization_id').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
    if (!guild) return reply({ error: 'Guild-ul nu este configurat în Panel Pro.' }, 404);
    const { data: modules, error } = await db.from('platform_module_templates').select('module_key,label,description,definition').eq('enabled', true).order('label');
    if (error) throw error;
    const applicationId = await getPlatformSecret(db, 'discord_client_id');
    const botToken = await getPlatformSecret(db, 'discord_bot_token');
    if (!applicationId || !botToken) return reply({ error: 'DISCORD_CLIENT_ID sau DISCORD_BOT_TOKEN lipsește din Supabase.' }, 500);
    const discordHeaders = { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' };
    const existingResponse = await fetch(`https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`, { headers: discordHeaders });
    const existing = await existingResponse.json().catch(() => []);
    if (!existingResponse.ok) return reply({ error: String(existing?.message || `Discord HTTP ${existingResponse.status}`) }, existingResponse.status === 403 ? 403 : 400);
    const commands = (modules || []).filter((module: any) => module?.definition?.slash_command?.enabled === true).map((module: any) => ({ name: String(module.module_key).slice(0, 32), description: String(module.description || module.label || 'Modul Panel Pro').replace(/\s+/g, ' ').slice(0, 100), type: 1 }));
    const preserved = Array.isArray(existing) ? existing.filter((command: any) => !/^custom_[a-z0-9_]+$/i.test(String(command?.name || ''))).map((command: any) => ({ name: command.name, description: command.description, type: command.type, options: command.options, default_member_permissions: command.default_member_permissions, dm_permission: command.dm_permission, nsfw: command.nsfw })) : [];
    const response = await fetch(`https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`, { method: 'PUT', headers: discordHeaders, body: JSON.stringify([...preserved, ...commands]) });
    const details = await response.json().catch(() => ({}));
    if (!response.ok) return reply({ error: String(details?.message || `Discord HTTP ${response.status}`) }, response.status === 403 ? 403 : 400);
    await db.from('platform_module_events').insert({ organization_id: guild.organization_id, guild_id: guildId, discord_id: session.discord_id, event_type: 'slash_commands_synced', payload: { count: commands.length } });
    return reply({ ok: true, count: commands.length });
  } catch (error) { return reply({ error: error instanceof Error ? error.message : 'Eroare internă.' }, 400); }
});
