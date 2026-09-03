import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { requirePanelSession } from '../_shared/panel-session.ts';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';
import { isPlatformAdminAccount } from '../_shared/platform-admin.ts';

const headers = { 'Access-Control-Allow-Origin': 'https://panel-pro.ro', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const routeChoices = [
  ['Anunțuri organizație', 'organization'], ['Anunțuri angajați', 'departments'], ['Pontaj', 'pontaj'], ['Log pontaj', 'log_pontaj'],
  ['Învoiri organizație', 'requests_organization'], ['Învoiri angajați', 'requests_departments'], ['Log învoiri organizație', 'log_requests_organization'], ['Log învoiri angajați', 'log_requests_departments'],
  ['Contracte', 'contracts'], ['Log contracte', 'log_contracts'], ['Acțiuni organizație', 'actions_organization'], ['Log acțiuni', 'actions_organization_weekly'], ['Status live', 'status_live'],
  ['Stash', 'stash'], ['Log Stash', 'log_stash'], ['Cereri Stash', 'stash_requests'], ['Log cereri Stash', 'log_stash_requests'], ['Donații Stash', 'stash_donations'], ['Log donații Stash', 'log_stash_donations'],
].map(([name, value]) => ({ name, value }));
const commands = [{
  name: 'panel', description: 'Afișează meniul și administrează Panel Pro', options: [
    { type: 1, name: 'status', description: 'Verifică toate canalele configurate' },
    { type: 1, name: 'publica', description: 'Publică un embed cu butoane', options: [{ type: 3, name: 'modul', description: 'Embedul de publicat', required: true, choices: [['Anunțuri organizație', 'organization'], ['Anunțuri angajați', 'departments'], ['Pontaj', 'pontaj'], ['Învoiri organizație', 'requests_organization'], ['Învoiri angajați', 'requests_departments'], ['Contracte', 'contracts'], ['Stash', 'stash'], ['Acțiuni organizație', 'actions_organization']].map(([name, value]) => ({ name, value })) }] },
    { type: 1, name: 'config', description: 'Configurează canalul unui modul', options: [{ type: 3, name: 'modul', description: 'Modulul pentru canal', required: true, choices: routeChoices }, { type: 7, name: 'canal', description: 'Canalul Discord', required: true, channel_types: [0] }] },
  ],
}];

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);
  try {
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    if (!key) throw new Error('Cheia secretă Supabase lipsește.');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    const session = await requirePanelSession(db, request, 0, true);
    if (!(await isPlatformAdminAccount(db, session.discord_id))) return reply({ error: 'Acces permis doar administratorului platformei.' }, 403);
    const botToken = await getPlatformSecret(db, 'discord_bot_token');
    if (!botToken) return reply({ error: 'Tokenul botului Discord nu este configurat.' }, 409);
    let applicationId = String(Deno.env.get('DISCORD_APPLICATION_ID') || '').trim();
    if (!/^\d{15,22}$/.test(applicationId)) {
      const { data: setting, error } = await db.from('organization_settings').select('discord_client_id').not('discord_client_id', 'is', null).neq('discord_client_id', '').limit(1).maybeSingle();
      if (error) throw error;
      applicationId = String(setting?.discord_client_id || '').trim();
    }
    if (!/^\d{15,22}$/.test(applicationId)) return reply({ error: 'Discord Application ID nu este configurat.' }, 409);
    const requestInit = { method: 'PUT', headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(commands) };
    const globalResponse = await fetch(`https://discord.com/api/v10/applications/${applicationId}/commands`, requestInit);
    if (!globalResponse.ok) return reply({ error: `Discord a respins comenzile globale (HTTP ${globalResponse.status}).`, details: await globalResponse.text() }, 400);
    const { data: guilds, error: guildsError } = await db.from('organization_guilds').select('guild_id').eq('enabled', true);
    if (guildsError) throw guildsError;
    const guildResults = [];
    for (const guild of guilds || []) {
      const guildId = String(guild.guild_id || '').trim();
      if (!/^\d{15,22}$/.test(guildId)) continue;
      const response = await fetch(`https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`, requestInit);
      guildResults.push({ guild_id: guildId, ok: response.ok, status: response.status });
    }
    await db.from('admin_audit_log').insert({ organization_id: session.organization_id, actor_discord_id: session.discord_id, action: 'discord_commands_synced', target_type: 'discord_application', target_id: applicationId, details: { command_count: commands.length, scope: 'global_and_configured_guilds', guild_count: guildResults.length } });
    const failedGuilds = guildResults.filter((item) => !item.ok).length;
    return reply({ ok: true, application_id: applicationId, command_count: commands.length, guild_count: guildResults.length, failed_guilds: failedGuilds, scope: 'global_and_configured_guilds', message: `Comenzile au fost sincronizate global și pe ${guildResults.length} server${guildResults.length === 1 ? '' : 'e'} configurat${guildResults.length === 1 ? '' : 'e'}. Pe serverele configurate ar trebui să apară imediat.` });
  } catch (error) { return reply({ error: error instanceof Error ? error.message : 'Eroare internă.' }, 400); }
});
