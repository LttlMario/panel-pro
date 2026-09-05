import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { isPlatformAdminAccount } from '../_shared/platform-admin.ts';
import { resolvePackageFeatures } from '../_shared/package-features.ts';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';
import { deliverDiscordRoute, requestDiscordTarget, routeCandidates } from '../_shared/discord-delivery.ts';
import { discordPremiumAccess, discordPremiumButton, discordPremiumConfigured, discordPremiumMessage, discordPremiumModule } from '../_shared/discord-premium.ts';

const DISCORD_API = 'https://discord.com/api/v10';
const serviceKey = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
let discordPublicKeyCache = '';
async function discordPublicKey(db?: any) {
  const direct = String(Deno.env.get('DISCORD_PUBLIC_KEY') || Deno.env.get('DISCORD_APPLICATION_PUBLIC_KEY') || '').trim();
  if (direct) return direct;
  if (discordPublicKeyCache) return discordPublicKeyCache;
  if (!db) return '';
  discordPublicKeyCache = await getPlatformSecret(db, 'discord_public_key') || await getPlatformSecret(db, 'discord_application_public_key');
  return discordPublicKeyCache;
}
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const interactionMessage = (content: string, extra: Record<string, unknown> = {}) => ({ type: 4, data: { content, flags: 64, ...extra } });
const commandSubcommand = (interaction: any) => Array.isArray(interaction?.data?.options) ? interaction.data.options.find((option: any) => option?.type === 1) : null;
const commandOptions = (interaction: any) => Array.isArray(commandSubcommand(interaction)?.options) ? commandSubcommand(interaction).options : (Array.isArray(interaction?.data?.options) ? interaction.data.options : []);
const commandOption = (interaction: any, name: string) => commandOptions(interaction).find((option: any) => option?.name === name)?.value;
const PANEL_ROUTE_LABELS: Record<string, string> = {
  organization: 'Anunțuri organizație', departments: 'Anunțuri angajați', pontaj: 'Pontaj', log_pontaj: 'Log pontaj',
  requests_organization: 'Învoiri organizație', requests_departments: 'Învoiri angajați', log_requests_organization: 'Log învoiri organizație', log_requests_departments: 'Log învoiri angajați',
  contracts: 'Contracte', log_contracts: 'Log contracte', log_actions_organization: 'Log acțiuni organizație', actions_organization_weekly: 'Log acțiuni', status_live: 'Status live',
  stash: 'Stash', log_stash: 'Log Stash', stash_requests: 'Cereri Stash', log_stash_requests: 'Log cereri Stash', stash_donations: 'Donații Stash', log_stash_donations: 'Log donații Stash',
};
const panelRouteKeys = Object.keys(PANEL_ROUTE_LABELS);
const PANEL_LOG_ROUTES: Record<string, string> = {
  organization: 'log_announcements_organization', departments: 'log_announcements_departments', pontaj: 'log_pontaj',
  requests_organization: 'log_requests_organization', requests_departments: 'log_requests_departments', contracts: 'log_contracts',
  actions_organization: 'log_actions_organization', stash: 'log_stash', stash_requests: 'log_stash_requests', stash_donations: 'log_stash_donations',
};
const isDiscordManager = (interaction: any) => {
  try { return (BigInt(String(interaction?.member?.permissions || '0')) & 40n) !== 0n; } catch { return false; }
};

async function ensureDiscordOnlyOrganization(db: any, interaction: any) {
  const guildId = String(interaction?.guild_id || '').trim();
  const discordId = String(interaction?.member?.user?.id || interaction?.user?.id || '').trim();
  if (!/^\d{15,22}$/.test(guildId) || !/^\d{15,22}$/.test(discordId)) throw new Error('Serverul Discord nu a putut fi identificat.');
  const { data: existing, error: existingError } = await db.from('organization_guilds').select('organization_id,kind').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
  if (existingError) throw existingError;
  if (existing?.organization_id) {
    const { data: existingSettings, error: packageError } = await db.from('app_settings').select('key,value').eq('organization_id', existing.organization_id).in('key', ['organization_package', 'discord_trial']);
    if (packageError) throw packageError;
    const packageSetting = (existingSettings || []).find((item: any) => item.key === 'organization_package');
    if (packageSetting?.value?.code === 'discord') {
      if (!(existingSettings || []).some((item: any) => item.key === 'discord_trial')) {
        const startsAt = new Date().toISOString();
        const { error: trialError } = await db.from('app_settings').insert({ organization_id: existing.organization_id, key: 'discord_trial', value: { starts_at: startsAt, ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), duration_days: 30 }, updated_at: startsAt });
        if (trialError) throw trialError;
      }
      const manager = isDiscordManager(interaction);
      const { error: memberError } = await db.from('organization_members').upsert({ organization_id: existing.organization_id, discord_id: discordId, panel_role: manager ? 'Administrator' : 'Membru', permission_level: manager ? 99 : 1, active: true, last_verified_at: new Date().toISOString() }, { onConflict: 'organization_id,discord_id' });
      if (memberError) throw memberError;
    }
    return existing;
  }
  if (!isDiscordManager(interaction)) throw new Error('Serverul nu este configurat pentru Panel Pro. Ownerul serverului sau un administrator cu Manage Server trebuie să ruleze mai întâi /panel config.');

  const applicationId = String(interaction?.application_id || '').trim();
  const guildName = String(interaction?.guild?.name || interaction?.guild_name || `Server Discord ${guildId}`).trim().slice(0, 120);
  const slug = `discord-${guildId}`;
  const now = new Date().toISOString();
  const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: organization, error: organizationError } = await db.from('organizations').insert({
    slug, name: guildName, access_mode: 'discord_only', lifecycle_status: 'active', active: true, updated_at: now,
  }).select('id,name,address,active').single();
  if (organizationError) {
    if (organizationError.code === '23505') {
      const { data: retry, error: retryError } = await db.from('organization_guilds').select('organization_id,kind').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
      if (retryError) throw retryError;
      if (retry?.organization_id) return retry;
    }
    throw organizationError;
  }
  const organizationId = String(organization.id);
  const [guildResult, settingsResult, packageResult, memberResult, trialResult] = await Promise.all([
    db.from('organization_guilds').insert({ organization_id: organizationId, guild_id: guildId, guild_name: guildName, kind: 'primary', enabled: true }),
    db.from('organization_settings').insert({ organization_id: organizationId, discord_client_id: applicationId || '0', panel_public_url: '', discord_channel_routes: {}, updated_at: now, updated_by_discord_id: discordId }),
    db.from('app_settings').insert({ organization_id: organizationId, key: 'organization_package', value: { code: 'discord', unlimited: true, expires_at: null }, updated_at: now }),
    db.from('organization_members').insert({ organization_id: organizationId, discord_id: discordId, panel_role: 'Administrator', permission_level: 99, active: true, last_verified_at: now }),
    db.from('app_settings').insert({ organization_id: organizationId, key: 'discord_trial', value: { starts_at: now, ends_at: trialEndsAt, duration_days: 30 }, updated_at: now }),
  ]);
  const failed = [guildResult, settingsResult, packageResult, memberResult, trialResult].find((result: any) => result?.error);
  if (failed?.error) throw failed.error;
  await db.from('organization_lifecycle_events').insert({ organization_id: organizationId, event_type: 'discord_only_initialized', actor_discord_id: discordId, details: { guild_id: guildId } });
  return { organization_id: organizationId, kind: 'primary' };
}
const controlPayload = (routeKey: string, trialText = '', includeDonation = true) => {
  const definitions: Record<string, { title: string; description: string; color: number; buttons: any[] }> = {
    organization: { title: '📢 Anunțuri · Organizație', description: 'Publică anunțuri, întrebări și sondaje pentru organizație.', color: 0x8b5cf6, buttons: [{ label: 'Publică anunț', style: 1, id: 'panel:announcements:organization:create:announcement' }, { label: 'Pune întrebare', style: 2, id: 'panel:announcements:organization:create:question' }, { label: 'Creează sondaj', style: 3, id: 'panel:announcements:organization:create:poll' }] },
    departments: { title: '📢 Anunțuri · Angajați', description: 'Publică anunțuri, întrebări și sondaje pentru angajați.', color: 0x8b5cf6, buttons: [{ label: 'Publică anunț', style: 1, id: 'panel:announcements:departments:create:announcement' }, { label: 'Pune întrebare', style: 2, id: 'panel:announcements:departments:create:question' }, { label: 'Creează sondaj', style: 3, id: 'panel:announcements:departments:create:poll' }] },
    pontaj: { title: '🕒 Pontaj · Panel Pro', description: 'Alege tura și folosește butoanele pentru Start, Pauză și Stop.', color: 0x22c55e, buttons: [{ label: 'Tura de zi', style: 1, id: 'panel:pontaj:shift_day' }, { label: 'Tura de noapte', style: 1, id: 'panel:pontaj:shift_night' }, { label: 'Start', style: 3, id: 'panel:pontaj:start' }, { label: 'Pauză', style: 2, id: 'panel:pontaj:pause' }, { label: 'Stop', style: 4, id: 'panel:pontaj:stop' }, { label: 'Pontajul meu', style: 1, id: 'panel:pontaj:my_stats' }] },
    requests_organization: { title: '📝 Învoiri · Organizație', description: 'Trimite și consultă învoirile organizației.', color: 0xf59e0b, buttons: [{ label: 'Trimite învoire', style: 1, id: 'panel:requests:organization:new' }, { label: 'Învoirile mele', style: 2, id: 'panel:requests:organization:mine' }] },
    requests_departments: { title: '📝 Învoiri · Angajați', description: 'Trimite și consultă învoirile angajaților.', color: 0xf59e0b, buttons: [{ label: 'Trimite învoire', style: 1, id: 'panel:requests:departments:new' }, { label: 'Învoirile mele', style: 2, id: 'panel:requests:departments:mine' }] },
      contracts: { title: '📄 Contracte · Panel Pro', description: 'Generează și trimite contracte folosind șablonul organizației.', color: 0x14b8a6, buttons: [{ label: 'Creează contract', style: 1, id: 'panel:contracts:create' }, { label: 'Setează contractul', style: 2, id: 'panel:contracts:settings' }, { label: 'Info contract', style: 1, id: 'panel:contracts:info' }] },
      status_live: { title: '📡 Status live · Panel Pro', description: 'Acest embed este actualizat automat la fiecare minut cu pontajele și pauzele active. Configurează canalul Status live, apoi pornește sincronizarea din pagina Status live.', color: 0x06b6d4, buttons: [] },
    stash: { title: '📦 Stash · Administrare', description: 'Gestionează articolele, cererile și donațiile Stash.', color: 0x22c55e, buttons: [{ label: 'Adaugă în Stash', style: 3, id: 'panel:stash:create' }, { label: 'Cereri în așteptare', style: 1, id: 'panel:stash:pending_requests' }, { label: 'Donații în așteptare', style: 1, id: 'panel:stash:pending_donations' }] },
    actions_organization: { title: '🎯 Acțiuni · Organizație', description: 'Înregistrează și consultă acțiunile organizației.', color: 0x3b82f6, buttons: [{ label: 'Acțiune', style: 1, id: 'panel:actions:organization:create' }, { label: 'Clasament acțiuni', style: 2, id: 'panel:actions:organization:stats' }] },
  };
  const definition = definitions[routeKey] || { title: `⚙️ ${PANEL_ROUTE_LABELS[routeKey] || 'Panel Pro'}`, description: 'Embed de administrare Panel Pro.', color: 0x5865f2, buttons: [] };
    const components: any[] = [];
    for (let index = 0; index < definition.buttons.length && components.length < 4; index += 5) {
      components.push({ type: 1, components: definition.buttons.slice(index, index + 5).map((button: any) => ({ type: 2, style: button.style, label: button.label, custom_id: button.id })) });
    }
  if (includeDonation) components.push({ type: 1, components: [{ type: 2, style: 5, label: 'Donează pentru dezvoltare', url: 'https://revolut.me/mariomihail' }] });
  if (discordPremiumConfigured()) components.push(...discordPremiumButton());
  return { allowed_mentions: { parse: [] }, embeds: [{ title: definition.title, description: [definition.description, trialText].filter(Boolean).join('\n\n'), color: definition.color, footer: { text: 'Panel Pro · configurat din Discord' } }], components };
};
const readableError = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object') {
    const value = error as Record<string, unknown>;
    const message = String(value.message || value.details || value.hint || '').trim();
    if (message) return message;
  }
  return fallback;
};

async function discordTrialNotice(db: any, organizationId: string) {
  const { data, error } = await db.from('app_settings').select('value').eq('organization_id', organizationId).eq('key', 'discord_trial').maybeSingle();
  if (error) throw error;
  const startsAt = Date.parse(String(data?.value?.starts_at || ''));
  const endsAt = Date.parse(String(data?.value?.ends_at || ''));
  if (!Number.isFinite(endsAt)) return '';
  if (endsAt <= Date.now()) return '⚪ Perioada de probă Premium a expirat. Pontajul și Învoirile rămân gratuite.';
  const days = Math.max(1, Math.ceil((endsAt - Date.now()) / (24 * 60 * 60 * 1000)));
  const startText = Number.isFinite(startsAt) ? new Date(startsAt).toLocaleDateString('ro-RO') : '—';
  const endText = new Date(endsAt).toLocaleDateString('ro-RO');
  return `🟢 Trial Premium activ: **${days} zile rămase** (${startText} – ${endText}). Poți activa abonamentul Premium oricând folosind butonul de mai jos.`;
}

async function deferInteraction(interaction: any, updateOnly = false) {
  const interactionId = String(interaction?.id || '').trim();
  const applicationId = String(interaction?.application_id || '').trim();
  const interactionToken = String(interaction?.token || '').trim();
  if (!/^\d{15,22}$/.test(interactionId) || !/^\d{15,22}$/.test(applicationId) || !interactionToken) throw new Error('Interacțiunea Discord nu are un token valid.');
  const response = await fetch(`${DISCORD_API}/interactions/${interactionId}/${encodeURIComponent(interactionToken)}/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updateOnly ? { type: 6 } : { type: 5, data: { flags: 64 } }),
  });
  if (!response.ok && response.status !== 204) throw new Error(`Discord nu a confirmat interacțiunea (HTTP ${response.status}).`);
  return { applicationId, interactionToken };
}

async function sendFollowup(applicationId: string, interactionToken: string, data: any) {
  const response = await fetch(`${DISCORD_API}/webhooks/${applicationId}/${encodeURIComponent(interactionToken)}?wait=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...(data?.data || {}), flags: 64 }),
  });
  if (!response.ok) {
    console.error('[discord-interactions] follow-up failed', response.status, await response.text().catch(() => ''));
    return '';
  }
  const message = await response.json().catch(() => ({}));
  return String(message?.id || '').trim();
}

async function deleteFollowup(applicationId: string, interactionToken: string, messageId: string) {
  if (!messageId) return;
  const response = await fetch(`${DISCORD_API}/webhooks/${applicationId}/${encodeURIComponent(interactionToken)}/messages/${encodeURIComponent(messageId)}`, { method: 'DELETE' });
  if (!response.ok && response.status !== 404) console.error('[discord-interactions] follow-up delete failed', response.status, await response.text().catch(() => ''));
}

async function runDeferredCommand(interaction: any, work: () => Promise<any>, fallback: string) {
  const deferred = await deferInteraction(interaction, false);
  let result;
  try { result = await work(); } catch (error) { console.error('[discord-interactions] command failed', error); result = interactionMessage(readableError(error, fallback)); }
  await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
  return new Response(null, { status: 204 });
}

const hexBytes = (value: string, length: number) => {
  if (!new RegExp(`^[0-9a-f]{${length * 2}}$`, 'i').test(value)) return null;
  const bytes = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  return bytes;
};

async function verifyDiscordSignature(request: Request, rawBody: string, configuredPublicKey: string) {
  const publicKey = hexBytes(configuredPublicKey, 32);
  const signature = hexBytes(String(request.headers.get('x-signature-ed25519') || '').trim(), 64);
  const timestamp = String(request.headers.get('x-signature-timestamp') || '').trim();
  if (!publicKey || !signature || !/^\d{1,20}$/.test(timestamp)) return false;
  try {
    const key = await crypto.subtle.importKey('raw', publicKey, { name: 'Ed25519' }, false, ['verify']);
    return await crypto.subtle.verify({ name: 'Ed25519' }, key, signature, new TextEncoder().encode(`${timestamp}${rawBody}`));
  } catch (error) {
    console.error('[discord-interactions] signature verification failed', error);
    return false;
  }
}

function romanianParts(date = new Date()) {
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day), hour: Number(values.hour), minute: Number(values.minute), second: Number(values.second) };
}

function romanianDate(date = new Date()) {
  const parts = romanianParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function romanianTime(date = new Date()) {
  const parts = romanianParts(date);
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}:${String(parts.second).padStart(2, '0')}`;
}

function zonedDateAt(year: number, month: number, day: number, hour: number, minute: number) {
  const wanted = Date.UTC(year, month - 1, day, hour, minute, 0);
  const observed = romanianParts(new Date(wanted));
  const observedUtc = Date.UTC(observed.year, observed.month - 1, observed.day, observed.hour, observed.minute, observed.second);
  return new Date(wanted + (wanted - observedUtc));
}

function shiftDeadline(shiftType: string, now = new Date()) {
  const parts = romanianParts(now);
  const configured = shiftType === 'noapte' ? [23, 0] : [19, 59];
  let marker = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  let deadline = zonedDateAt(marker.getUTCFullYear(), marker.getUTCMonth() + 1, marker.getUTCDate(), configured[0], configured[1]);
  if (deadline.getTime() <= now.getTime()) {
    marker.setUTCDate(marker.getUTCDate() + 1);
    deadline = zonedDateAt(marker.getUTCFullYear(), marker.getUTCMonth() + 1, marker.getUTCDate(), configured[0], configured[1]);
  }
  return deadline;
}

function shiftAllowed(shiftType: string, now = new Date()) {
  const parts = romanianParts(now);
  const current = parts.hour * 100 + parts.minute;
  if (shiftType === 'zi') return current > 2300 || current < 1959;
  if (shiftType === 'noapte') return current >= 2000 && current < 2300;
  return false;
}

function workedSeconds(shift: any, now = new Date()) {
  const started = new Date(String(shift.started_at || '')).getTime();
  if (!Number.isFinite(started)) return 0;
  let paused = Number(shift.paused_seconds) || 0;
  if (shift.status === 'paused' && shift.paused_at) paused += Math.max(0, Math.floor((now.getTime() - new Date(String(shift.paused_at)).getTime()) / 1000));
  return Math.max(0, Math.floor((now.getTime() - started) / 1000) - paused);
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(safe / 3600).toString().padStart(2, '0')}:${Math.floor((safe % 3600) / 60).toString().padStart(2, '0')}:${(safe % 60).toString().padStart(2, '0')}`;
}

async function resolveContext(db: any, interaction: any) {
  const guildId = String(interaction.guild_id || '').trim();
  const channelId = String(interaction.channel_id || '').trim();
  const user = interaction.member?.user || interaction.user || {};
  const discordId = String(user.id || '').trim();
  if (!/^\d{15,22}$/.test(guildId) || !/^\d{15,22}$/.test(channelId) || !/^\d{15,22}$/.test(discordId)) throw new Error('Interacțiunea Discord nu conține date valide.');

  const { data: guild, error: guildError } = await db.from('organization_guilds').select('organization_id,guild_id,kind,enabled').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
  if (guildError) throw guildError;
  if (!guild) throw new Error('Serverul Discord nu este asociat unei organizații Panel Pro.');
  const { data: organization, error: organizationError } = await db.from('organizations').select('id,name,active').eq('id', guild.organization_id).maybeSingle();
  if (organizationError) throw organizationError;
  if (!organization?.active) throw new Error('Organizația este dezactivată.');

  const { data: settings, error: settingsError } = await db.from('organization_settings').select('discord_channel_routes').eq('organization_id', guild.organization_id).maybeSingle();
  if (settingsError) throw settingsError;
  const target = String(guild.kind || '') === 'secondary' ? 'secondary' : 'primary';
  const configuredChannel = settings?.discord_channel_routes?.pontaj?.[target];
  if (configuredChannel?.enabled === false || String(configuredChannel?.channel_id || '') !== channelId) throw new Error('Acest canal nu este configurat pentru panoul Pontaj al organizației.');

  const memberRoles = new Set((interaction.member?.roles || []).map((role: unknown) => String(role)));
  const { data: mappings, error: mappingsError } = await db.from('organization_role_mappings').select('discord_role_id,panel_role,permission_level,priority').eq('organization_id', guild.organization_id).eq('guild_id', guildId).eq('enabled', true);
  if (mappingsError) throw mappingsError;
  const matchedMapping = (mappings || []).filter((mapping: any) => memberRoles.has(String(mapping.discord_role_id))).sort((left: any, right: any) => Number(right.priority || right.permission_level || 0) - Number(left.priority || left.permission_level || 0))[0] || null;
  const { data: organizationMember, error: memberError } = await db.from('organization_members').select('panel_role,permission_level,active').eq('organization_id', guild.organization_id).eq('discord_id', discordId).eq('active', true).maybeSingle();
  if (memberError) throw memberError;
  const platformAdmin = await isPlatformAdminAccount(db, discordId);
  if (!platformAdmin && !matchedMapping && !organizationMember) throw new Error('Nu ai un rol configurat pentru Pontaj în această organizație.');
  const displayName = String(interaction.member?.nick || user.global_name || user.username || discordId).trim().slice(0, 120) || discordId;
  return { guildId, channelId, target, discordId, displayName, organization, settings, platformAdmin, role: matchedMapping?.panel_role || organizationMember?.panel_role || 'Membru' };
}

async function resolveRequestContext(db: any, interaction: any, audience: 'organization' | 'departments') {
  const guildId = String(interaction.guild_id || '').trim();
  const channelId = String(interaction.channel_id || '').trim();
  const user = interaction.member?.user || interaction.user || {};
  const discordId = String(user.id || '').trim();
  if (!/^\d{15,22}$/.test(guildId) || !/^\d{15,22}$/.test(channelId) || !/^\d{15,22}$/.test(discordId)) throw new Error('Interacțiunea Discord nu conține date valide.');
  const { data: guild, error: guildError } = await db.from('organization_guilds').select('organization_id,guild_id,kind,enabled').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
  if (guildError) throw guildError;
  if (!guild) throw new Error('Serverul Discord nu este asociat unei organizații Panel Pro.');
  const { data: organization, error: organizationError } = await db.from('organizations').select('id,name,active').eq('id', guild.organization_id).maybeSingle();
  if (organizationError) throw organizationError;
  if (!organization?.active) throw new Error('Organizația este dezactivată.');
  const { data: settings, error: settingsError } = await db.from('organization_settings').select('discord_channel_routes').eq('organization_id', guild.organization_id).maybeSingle();
  if (settingsError) throw settingsError;
  const target = String(guild.kind || '') === 'secondary' ? 'secondary' : 'primary';
  const routeKey = audience === 'organization' ? 'requests_organization' : 'requests_departments';
  const logRouteKey = audience === 'organization' ? 'log_requests_organization' : 'log_requests_departments';
  const alternateRouteKey = audience === 'organization' ? 'requests_departments' : 'requests_organization';
  const configuredChannel = settings?.discord_channel_routes?.[routeKey]?.[target]
    || settings?.discord_channel_routes?.requests?.[target]
    || settings?.discord_channel_routes?.[alternateRouteKey]?.[target];
  if (configuredChannel?.enabled === false || String(configuredChannel?.channel_id || '') !== channelId) throw new Error(`Acest canal nu este configurat pentru panoul Învoiri · ${audience === 'organization' ? 'Organizație' : 'Angajați'}.`);
  const memberRoles = new Set((interaction.member?.roles || []).map((role: unknown) => String(role)));
  const { data: mappings, error: mappingsError } = await db.from('organization_role_mappings').select('discord_role_id,panel_role,permission_level,priority').eq('organization_id', guild.organization_id).eq('guild_id', guildId).eq('enabled', true);
  if (mappingsError) throw mappingsError;
  const matchedMapping = (mappings || []).filter((mapping: any) => memberRoles.has(String(mapping.discord_role_id))).sort((left: any, right: any) => Number(right.priority || right.permission_level || 0) - Number(left.priority || left.permission_level || 0))[0] || null;
  const { data: organizationMember, error: memberError } = await db.from('organization_members').select('panel_role,permission_level,active').eq('organization_id', guild.organization_id).eq('discord_id', discordId).eq('active', true).maybeSingle();
  if (memberError) throw memberError;
  const platformAdmin = await isPlatformAdminAccount(db, discordId);
  const { data: actionSettings, error: actionError } = await db.from('app_settings').select('key,value').eq('organization_id', guild.organization_id).in('key', ['action_permissions', 'organization_package']);
  if (actionError) throw actionError;
  const actionSetting = (actionSettings || []).find((item: any) => item.key === 'action_permissions');
  const discordOnly = (actionSettings || []).find((item: any) => item.key === 'organization_package')?.value?.code === 'discord';
  const permissionKey = audience === 'organization' ? 'cereri.organization' : 'cereri.departments';
  const allowedRoles = Array.isArray(actionSetting?.value?.[permissionKey]) ? actionSetting.value[permissionKey].map(String) : [];
  if (!platformAdmin && !discordOnly && !memberRolesHasAny(memberRoles, allowedRoles)) throw new Error(`Nu ai permisiunea configurată pentru Învoiri · ${audience === 'organization' ? 'Organizație' : 'Angajați'}.`);
  if (!platformAdmin && !matchedMapping && !organizationMember) throw new Error('Contul tău nu este membru activ al acestei organizații.');
  const displayName = String(interaction.member?.nick || user.global_name || user.username || discordId).trim().slice(0, 120) || discordId;
  return { guildId, channelId, target, discordId, displayName, organization, settings, platformAdmin, audience, routeKey, logRouteKey, role: matchedMapping?.panel_role || organizationMember?.panel_role || 'Membru' };
}

function memberRolesHasAny(memberRoles: Set<string>, allowedRoles: string[]) {
  return allowedRoles.some((role) => memberRoles.has(String(role)));
}

function announcementRoutes(audience: 'organization' | 'departments') {
  return audience === 'organization'
    ? { control: 'organization', log: 'log_announcements_organization' }
    : { control: 'departments', log: 'log_announcements_departments' };
}

function channelMatches(settings: any, routeKey: string, target: string, channelId: string) {
  const configured = settings?.discord_channel_routes?.[routeKey]?.[target];
  return configured?.enabled !== false && String(configured?.channel_id || '') === String(channelId || '');
}

async function resolveAnnouncementContext(db: any, interaction: any, audience: 'organization' | 'departments', permission: 'read' | 'write') {
  const guildId = String(interaction.guild_id || '').trim();
  const channelId = String(interaction.channel_id || '').trim();
  const user = interaction.member?.user || interaction.user || {};
  const discordId = String(user.id || '').trim();
  if (!/^\d{15,22}$/.test(guildId) || !/^\d{15,22}$/.test(channelId) || !/^\d{15,22}$/.test(discordId)) throw new Error('Interacțiunea Discord nu conține date valide.');

  const { data: guild, error: guildError } = await db.from('organization_guilds').select('organization_id,guild_id,kind,enabled').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
  if (guildError) throw guildError;
  if (!guild) throw new Error('Serverul Discord nu este asociat unei organizații Panel Pro.');
  const { data: organization, error: organizationError } = await db.from('organizations').select('id,name,active').eq('id', guild.organization_id).maybeSingle();
  if (organizationError) throw organizationError;
  if (!organization?.active) throw new Error('Organizația este dezactivată.');
  const { data: settings, error: settingsError } = await db.from('organization_settings').select('discord_channel_routes,panel_public_url').eq('organization_id', guild.organization_id).maybeSingle();
  if (settingsError) throw settingsError;
  const target = String(guild.kind || '') === 'secondary' ? 'secondary' : 'primary';
  const routes = announcementRoutes(audience);
  if (!channelMatches(settings, routes.control, target, channelId) && !channelMatches(settings, routes.log, target, channelId)) throw new Error(`Acest canal nu este configurat pentru panoul ${audience === 'organization' ? 'Anunțuri · Organizație' : 'Anunțuri · Angajați'}.`);

  const { data: permissionSettings, error: permissionError } = await db.from('app_settings').select('key,value').eq('organization_id', guild.organization_id).in('key', ['communication_permissions', 'page_permissions', 'action_permissions', 'organization_package']);
  if (permissionError) throw permissionError;
  const byKey = new Map((permissionSettings || []).map((item: any) => [String(item.key), item.value]));
  const communication = byKey.get('communication_permissions');
  const communicationConfigured = communication && typeof communication === 'object';
  const pagePermissions = byKey.get('page_permissions') && typeof byKey.get('page_permissions') === 'object' ? byKey.get('page_permissions') : {};
  const actionPermissions = byKey.get('action_permissions') && typeof byKey.get('action_permissions') === 'object' ? byKey.get('action_permissions') : {};
  const packageFeatures = resolvePackageFeatures(byKey.get('organization_package') || {});
  const discordOnly = byKey.get('organization_package')?.code === 'discord';
  const feature = audience === 'organization' ? 'announcements_organization' : 'announcements_departments';

  const memberRoles = new Set((interaction.member?.roles || []).map((role: unknown) => String(role)));
  const { data: mappings, error: mappingsError } = await db.from('organization_role_mappings').select('discord_role_id,panel_role,permission_level,priority').eq('organization_id', guild.organization_id).eq('guild_id', guildId).eq('enabled', true);
  if (mappingsError) throw mappingsError;
  const matchedMapping = (mappings || []).filter((mapping: any) => memberRoles.has(String(mapping.discord_role_id))).sort((left: any, right: any) => Number(right.priority || right.permission_level || 0) - Number(left.priority || left.permission_level || 0))[0] || null;
  const { data: organizationMember, error: memberError } = await db.from('organization_members').select('panel_role,permission_level,active').eq('organization_id', guild.organization_id).eq('discord_id', discordId).eq('active', true).maybeSingle();
  if (memberError) throw memberError;
  const platformAdmin = await isPlatformAdminAccount(db, discordId);
  const activePanelRole = String(organizationMember?.panel_role || '').trim().toLowerCase();
  const effectiveRoleIds = new Set<string>([...memberRoles]);
  for (const mapping of mappings || []) {
    if (activePanelRole && String(mapping.panel_role || '').trim().toLowerCase() === activePanelRole) effectiveRoleIds.add(String(mapping.discord_role_id));
  }
  const configuredRoles = communicationConfigured
    ? (Array.isArray(communication?.[audience]?.[permission]) ? communication[audience][permission].map(String) : [])
    : (permission === 'read' ? (Array.isArray(pagePermissions['anunturi.html']) ? pagePermissions['anunturi.html'].map(String) : []) : (Array.isArray(actionPermissions['anunturi.publish']) ? actionPermissions['anunturi.publish'].map(String) : []));
  const hasAccess = platformAdmin || discordOnly || (packageFeatures.includes(feature) && [...effectiveRoleIds].some((roleId) => configuredRoles.includes(roleId)));
  if (!hasAccess) throw new Error(`Nu ai permisiunea de ${permission === 'read' ? 'citire' : 'scriere'} pentru ${audience === 'organization' ? 'Anunțuri · Organizație' : 'Anunțuri · Angajați'}.`);
  if (!platformAdmin && !matchedMapping && !organizationMember) throw new Error('Contul tău nu este membru activ al acestei organizații.');
  const displayName = String(interaction.member?.nick || user.global_name || user.username || discordId).trim().slice(0, 120) || discordId;
  return { guildId, channelId, target, discordId, displayName, organization, settings, platformAdmin, audience, routeKey: routes.log, controlRouteKey: routes.control, logRouteKey: routes.log, role: matchedMapping?.panel_role || organizationMember?.panel_role || 'Membru' };
}

async function resolveManagementContext(db: any, interaction: any, audience: 'organization' | 'departments', permission: 'read' | 'write' | 'sanction', routeKey: string, feature: string, permissionSettingKey: string, permissionKey: string) {
  const guildId = String(interaction.guild_id || '').trim();
  const channelId = String(interaction.channel_id || '').trim();
  const user = interaction.member?.user || interaction.user || {};
  const discordId = String(user.id || '').trim();
  if (!/^\d{15,22}$/.test(guildId) || !/^\d{15,22}$/.test(channelId) || !/^\d{15,22}$/.test(discordId)) throw new Error('Interacțiunea Discord nu conține date valide.');
  const { data: guild, error: guildError } = await db.from('organization_guilds').select('organization_id,guild_id,kind,enabled').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
  if (guildError) throw guildError;
  if (!guild) throw new Error('Serverul Discord nu este asociat unei organizații Panel Pro.');
  const { data: organization, error: organizationError } = await db.from('organizations').select('id,name,active').eq('id', guild.organization_id).maybeSingle();
  if (organizationError) throw organizationError;
  if (!organization?.active) throw new Error('Organizația este dezactivată.');
  const { data: settings, error: settingsError } = await db.from('organization_settings').select('discord_channel_routes,panel_public_url').eq('organization_id', guild.organization_id).maybeSingle();
  if (settingsError) throw settingsError;
  const target = String(guild.kind || '') === 'secondary' ? 'secondary' : 'primary';
  const routes = announcementRoutes(audience);
  if (!channelMatches(settings, routeKey, target, channelId) && !channelMatches(settings, routes.log, target, channelId)) throw new Error(`Acest canal nu este configurat pentru ${routeKey}.`);
  const { data: permissionSettings, error: permissionError } = await db.from('app_settings').select('key,value').eq('organization_id', guild.organization_id).in('key', ['discipline_permissions', 'action_permissions', 'organization_package']);
  if (permissionError) throw permissionError;
  const byKey = new Map((permissionSettings || []).map((item: any) => [String(item.key), item.value]));
  const permissionConfig = byKey.get(permissionSettingKey);
  const packageFeatures = resolvePackageFeatures(byKey.get('organization_package') || {});
  const discordOnly = byKey.get('organization_package')?.code === 'discord';
  const memberRoles = new Set((interaction.member?.roles || []).map((role: unknown) => String(role)));
  const { data: mappings, error: mappingsError } = await db.from('organization_role_mappings').select('discord_role_id,panel_role,priority,permission_level').eq('organization_id', guild.organization_id).eq('guild_id', guildId).eq('enabled', true);
  if (mappingsError) throw mappingsError;
  const { data: organizationMember, error: memberError } = await db.from('organization_members').select('panel_role,active').eq('organization_id', guild.organization_id).eq('discord_id', discordId).eq('active', true).maybeSingle();
  if (memberError) throw memberError;
  const activePanelRole = String(organizationMember?.panel_role || '').trim().toLowerCase();
  const effectiveRoleIds = new Set<string>([...memberRoles]);
  for (const mapping of mappings || []) if (activePanelRole && String(mapping.panel_role || '').trim().toLowerCase() === activePanelRole) effectiveRoleIds.add(String(mapping.discord_role_id));
  const configuredRoles = Array.isArray(permissionConfig?.[audience]?.[permission])
    ? permissionConfig[audience][permission].map(String)
    : Array.isArray(permissionConfig?.[permissionKey]) ? permissionConfig[permissionKey].map(String) : [];
  const platformAdmin = await isPlatformAdminAccount(db, discordId);
  if (!platformAdmin && !discordOnly && (!packageFeatures.includes(feature) || ![...effectiveRoleIds].some((roleId) => configuredRoles.includes(roleId)))) throw new Error(`Nu ai permisiunea necesară pentru ${audience === 'organization' ? 'Organizație' : 'Angajați'}.`);
  const displayName = String(interaction.member?.nick || user.global_name || user.username || discordId).trim().slice(0, 120) || discordId;
  return { guildId, channelId, target, discordId, displayName, organization, settings, platformAdmin, audience, logRouteKey: routes.log, role: mappings?.find((mapping: any) => effectiveRoleIds.has(String(mapping.discord_role_id)))?.panel_role || organizationMember?.panel_role || 'Membru' };
}

async function resolveContractContext(db: any, interaction: any, routeKey = 'contracts') {
  const guildId = String(interaction.guild_id || '').trim();
  const channelId = String(interaction.channel_id || '').trim();
  const user = interaction.member?.user || interaction.user || {};
  const discordId = String(user.id || '').trim();
  if (!/^\d{15,22}$/.test(guildId) || !/^\d{15,22}$/.test(channelId) || !/^\d{15,22}$/.test(discordId)) throw new Error('Interacțiunea Discord nu conține date valide.');
  const { data: guild, error: guildError } = await db.from('organization_guilds').select('organization_id,guild_id,kind,enabled').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
  if (guildError) throw guildError;
  if (!guild) throw new Error('Serverul Discord nu este asociat unei organizații Panel Pro.');
  const [{ data: resolvedOrganization, error: resolvedOrganizationError }, { data: resolvedSettings, error: resolvedSettingsError }] = await Promise.all([
    db.from('organizations').select('id,name,address,active').eq('id', guild.organization_id).maybeSingle(),
    db.from('organization_settings').select('discord_channel_routes,panel_public_url').eq('organization_id', guild.organization_id).maybeSingle(),
  ]);
  if (resolvedOrganizationError) throw resolvedOrganizationError;
  if (!resolvedOrganization?.active) throw new Error('Organizația este dezactivată.');
  if (resolvedSettingsError) throw resolvedSettingsError;
  const target = String(guild.kind || '') === 'secondary' ? 'secondary' : 'primary';
  if (!channelMatches(resolvedSettings, routeKey, target, channelId)) throw new Error(`Acest canal nu este configurat pentru panoul ${routeKey === 'log_contracts' ? 'Log contracte' : 'Contracte'}.`);
  const [{ data: packageSetting, error: packageError }, { data: permissionSetting, error: permissionError }, { data: mappings, error: mappingsError }, { data: organizationMember, error: memberError }, platformAdmin] = await Promise.all([
    db.from('app_settings').select('value').eq('organization_id', guild.organization_id).eq('key', 'organization_package').maybeSingle(),
    db.from('app_settings').select('value').eq('organization_id', guild.organization_id).eq('key', 'page_permissions').maybeSingle(),
    db.from('organization_role_mappings').select('discord_role_id,panel_role,permission_level,priority').eq('organization_id', guild.organization_id).eq('guild_id', guildId).eq('enabled', true),
    db.from('organization_members').select('panel_role,active').eq('organization_id', guild.organization_id).eq('discord_id', discordId).eq('active', true).maybeSingle(),
    isPlatformAdminAccount(db, discordId),
  ]);
  if (packageError) throw packageError;
  if (permissionError) throw permissionError;
  if (mappingsError) throw mappingsError;
  if (memberError) throw memberError;
  const packageFeatures = resolvePackageFeatures(packageSetting?.value || {});
  const discordOnly = packageSetting?.value?.code === 'discord';
  if (!packageFeatures.includes('contracts')) throw new Error('Contractele nu sunt incluse în pachetul organizației.');
  const memberRoles = new Set((interaction.member?.roles || []).map((role: unknown) => String(role)));
  const matchedMapping = (mappings || []).filter((mapping: any) => memberRoles.has(String(mapping.discord_role_id))).sort((left: any, right: any) => Number(right.priority || right.permission_level || 0) - Number(left.priority || left.permission_level || 0))[0] || null;
  const allowedRoles = Array.isArray(permissionSetting?.value?.['contracte.html']) ? permissionSetting.value['contracte.html'].map(String) : [];
  const effectiveRoleIds = new Set<string>([...memberRoles]);
  const activePanelRole = String(organizationMember?.panel_role || '').trim().toLowerCase();
  for (const mapping of mappings || []) if (activePanelRole && String(mapping.panel_role || '').trim().toLowerCase() === activePanelRole) effectiveRoleIds.add(String(mapping.discord_role_id));
  if (!platformAdmin && !discordOnly && allowedRoles.length && ![...effectiveRoleIds].some((roleId) => allowedRoles.includes(roleId))) throw new Error('Nu ai permisiunea configurată pentru pagina Contracte.');
  if (!platformAdmin && !matchedMapping && !organizationMember) throw new Error('Contul tău nu este membru activ al acestei organizații.');
  const displayName = String(interaction.member?.nick || user.global_name || user.username || discordId).trim().slice(0, 120) || discordId;
  return { guildId, channelId, target, discordId, displayName, organization: resolvedOrganization, settings: resolvedSettings, platformAdmin, role: matchedMapping?.panel_role || organizationMember?.panel_role || 'Membru', logRouteKey: 'log_contracts' };
}

async function resolveContractActionContext(db: any, interaction: any) {
  try { return await resolveContractContext(db, interaction, 'contracts'); }
  catch (_) { return await resolveContractContext(db, interaction, 'log_contracts'); }
}

function modalValues(interaction: any) {
  const values: Record<string, any> = {};
  for (const row of interaction?.data?.components || []) {
    const components = row?.components || (row?.component ? [row.component] : []);
    for (const component of components) {
      const id = String(component?.custom_id || '').trim();
      if (!id) continue;
      if (Array.isArray(component?.values)) values[id] = component.values.map((value: unknown) => String(value));
      else if (Array.isArray(component?.component?.values)) values[id] = component.component.values.map((value: unknown) => String(value));
      else values[id] = String(component?.value || '').trim();
    }
  }
  return values;
}

const communityReactionChoices = ['✅', '❌', '👍', '❤️', '🤔'];

function communityPostComponents(post: any, options: any[] = []) {
  const audience = post.audience === 'departments' ? 'departments' : 'organization';
  const rows: any[] = [{ type: 1, components: communityReactionChoices.map((reaction, index) => ({ type: 2, style: 2, label: reaction, custom_id: `panel:announcements:${audience}:react:${post.id}:${index}` })) }];
  if (post.post_type === 'poll') {
    const pollOptions = options.slice(0, 10);
    for (let index = 0; index < pollOptions.length; index += 5) {
      rows.push({ type: 1, components: pollOptions.slice(index, index + 5).map((option: any) => ({ type: 2, style: 1, label: String(option.option_text || `Opțiunea ${option.position + 1}`).slice(0, 80), custom_id: `panel:announcements:${audience}:vote:${post.id}:${option.position}` })) });
    }
  }
  rows.push({ type: 1, components: [
    { type: 2, style: 2, label: 'Editează', custom_id: `panel:announcements:${audience}:edit:${post.id}` },
    { type: 2, style: 4, label: 'Șterge', custom_id: `panel:announcements:${audience}:delete:${post.id}` },
  ] });
  return rows.slice(0, 5);
}

function communityPostEmbed(post: any, options: any[] = [], votes: any[] = [], reactions: any[] = [], settings: any = {}) {
  const audience = post.audience === 'departments' ? 'Angajați' : 'Organizație';
  const site = String(settings?.panel_public_url || 'https://panel-pro.ro').replace(/\/$/, '');
  const postUrl = `${site}/anunturi.html?post=${post.id}`;
  const fields: any[] = [];
  if (post.post_type === 'poll') {
    const total = votes.length;
    fields.push({ name: `🗳️ Rezultate · ${total} vot${total === 1 ? '' : 'uri'}`, value: options.map((option: any) => {
      const count = votes.filter((vote: any) => String(vote.option_id) === String(option.id)).length;
      const percentage = total ? Math.round((count * 100) / total) : 0;
      return `▫️ ${String(option.option_text || 'Opțiune').slice(0, 80)} — ${count} (${percentage}%)`;
    }).join('\n').slice(0, 1024) || 'Încă nu există opțiuni.' });
  }
  fields.push({ name: 'Reacții', value: communityReactionChoices.map((reaction) => `${reaction} ${reactions.filter((item: any) => item.reaction === reaction).length}`).join(' · '), inline: false });
  fields.push({ name: post.post_type === 'poll' ? 'Votare' : 'Interacțiuni', value: post.post_type === 'poll' ? 'Alege o opțiune de mai jos.' : 'Folosește reacțiile de mai jos pentru a răspunde.', inline: false });
  return {
    title: String(post.title || 'Comunicare').slice(0, 256),
    description: String(post.content || '—').slice(0, 4096),
    color: post.post_type === 'poll' ? 0x8b5cf6 : post.audience === 'organization' ? 0x22d3ee : 0x5865f2,
    url: postUrl,
    fields,
    footer: { text: `${post.post_type === 'poll' ? 'Sondaj' : post.post_type === 'question' ? 'Întrebare' : 'Anunț'} · ${audience} · ${String(post.author_name || 'Panel Pro').slice(0, 60)}` },
    timestamp: post.updated_at || post.created_at || new Date().toISOString(),
  };
}

async function loadCommunityPost(db: any, organizationId: string, postId: string) {
  const { data: post, error: postError } = await db.from('community_posts').select('*').eq('organization_id', organizationId).eq('id', postId).maybeSingle();
  if (postError) throw postError;
  if (!post) throw new Error('Postarea nu mai există în organizația activă.');
  const [optionsResult, votesResult, reactionsResult] = await Promise.all([
    db.from('community_poll_options').select('id,post_id,option_text,position').eq('organization_id', organizationId).eq('post_id', postId).order('position'),
    db.from('community_poll_votes').select('post_id,option_id,user_discord_id').eq('organization_id', organizationId).eq('post_id', postId),
    db.from('community_reactions').select('post_id,user_discord_id,reaction').eq('organization_id', organizationId).eq('post_id', postId),
  ]);
  if (optionsResult.error) throw optionsResult.error;
  if (votesResult.error) throw votesResult.error;
  if (reactionsResult.error) throw reactionsResult.error;
  return { post, options: optionsResult.data || [], votes: votesResult.data || [], reactions: reactionsResult.data || [] };
}

function communityPayload(data: any) {
  return JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [communityPostEmbed(data.post, data.options, data.votes, data.reactions, data.settings)], components: communityPostComponents(data.post, data.options) });
}

function communityMessageRefs(post: any) {
  const refs = Array.isArray(post?.discord_message_ids) ? post.discord_message_ids : [];
  const map: Record<string, string> = {};
  for (const ref of refs) {
    if (ref?.target && /^\d{15,22}$/.test(String(ref.id || ''))) map[String(ref.target)] = String(ref.id);
  }
  if (!Object.keys(map).length && /^\d{15,22}$/.test(String(post?.discord_message_id || ''))) map.primary = String(post.discord_message_id);
  return map;
}

async function saveCommunityMessageRefs(db: any, organizationId: string, postId: string, results: any[]) {
  if (!results.length) return;
  const refs = results.filter((item: any) => item.id).map((item: any) => ({ target: String(item.target || ''), channel_id: String(item.channel_id || ''), id: String(item.id) }));
  const first = refs[0];
  const { error } = await db.from('community_posts').update({ discord_message_id: first?.id || null, discord_message_ids: refs, updated_at: new Date().toISOString() }).eq('organization_id', organizationId).eq('id', postId);
  if (error) throw error;
}

async function syncCommunityPostDiscord(db: any, context: any, data: any) {
  const messageIds = communityMessageRefs(data.post);
  const delivery = await deliverDiscordRoute(db, context.settings, context.routeKey, communityPayload({ ...data, settings: context.settings }), { messageIds });
  await saveCommunityMessageRefs(db, String(context.organization.id), String(data.post.id), delivery.results || []);
  return delivery;
}

function announcementModal(audience: 'organization' | 'departments', postType: 'announcement' | 'question' | 'poll', post: any = null, options: any[] = []) {
  const label = audience === 'organization' ? 'Organizație' : 'Angajați';
  const input = (custom_id: string, labelText: string, style: number, required: boolean, placeholder: string, max_length: number, value = '') => ({ type: 4, custom_id, label: labelText, style, required, placeholder, max_length, ...(value ? { value } : {}) });
  const editing = Boolean(post?.id);
  const customId = editing ? `panel:announcements:${audience}:edit_submit:${post.id}:${postType}` : `panel:announcements:${audience}:submit:${postType}`;
  const components: any[] = [
    { type: 1, components: [input('title', 'Titlu', 1, true, 'Titlul comunicării', 140, String(post?.title || ''))] },
    { type: 1, components: [input('content', 'Conținut', 2, false, 'Scrie mesajul...', 4000, String(post?.content || ''))] },
  ];
  if (postType === 'poll') components.push({ type: 1, components: [input('poll_options', 'Opțiuni sondaj', 2, true, 'Câte o opțiune pe fiecare rând', 1000, options.map((option: any) => option.option_text).join('\n'))] });
  return { type: 9, data: { custom_id: customId, title: `${editing ? 'Editează' : 'Creează'} ${postType === 'poll' ? 'sondaj' : postType === 'question' ? 'întrebare' : 'anunț'} · ${label}`, components } };
}

function parseCommunityOptions(value: string) {
  return [...new Set(String(value || '').split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean))].slice(0, 10);
}

async function sendAnnouncementLog(db: any, context: any, post: any, action: string) {
  const title = String(post?.title || 'Comunicare').slice(0, 256);
  const content = String(post?.content || '—').slice(0, 1024);
  const type = post?.post_type === 'poll' ? 'Sondaj' : post?.post_type === 'question' ? 'Întrebare' : 'Anunț';
  const audience = context.audience === 'organization' ? 'Organizație' : 'Angajați';
  try {
    const delivery = await deliverDiscordRoute(db, context.settings, context.logRouteKey, JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [{
      title: `📝 ${action} · ${audience}`,
      color: action.toLowerCase().includes('șters') ? 0xef4444 : 0x64748b,
      fields: [
        { name: '👤 Autor', value: String(post.author_name || context.displayName || 'Utilizator').slice(0, 1024), inline: true },
        { name: '📌 Tip', value: type, inline: true },
        { name: '🧾 Titlu', value: title, inline: false },
        { name: '💬 Conținut', value: content, inline: false },
      ],
      footer: { text: `Panel Pro · Log anunțuri · ${audience}` },
      timestamp: new Date().toISOString(),
    }] }));
    return delivery;
  } catch (error) {
    console.error('[discord-interactions] announcement log failed', error);
    return { results: [], failures: [error instanceof Error ? error.message : 'Logul Anunțuri nu a putut fi trimis.'] };
  }
}

function disciplineTargetPicker(audience: 'organization' | 'departments', kind: 'warning' | 'sanction') {
  const label = audience === 'organization' ? 'Organizație' : 'Angajați';
  return { type: 4, data: { content: `Selectează utilizatorul Discord vizat pentru ${kind === 'warning' ? 'avertisment' : 'sancțiune'} · ${label}.`, flags: 64, components: [{ type: 1, components: [{ type: 5, custom_id: `panel:discipline:${audience}:${kind}:target`, placeholder: 'Selectează utilizatorul de pe server', min_values: 1, max_values: 1 }]}] } };
}

function contractModal() {
  const input = (custom_id: string, label: string, placeholder: string, max_length: number) => ({ type: 4, custom_id, label, style: 1, required: true, placeholder, max_length });
  return { type: 9, data: { custom_id: 'panel:contracts:submit', title: 'Generează contract', components: [
    { type: 1, components: [input('employee_name', 'Nume și prenume', 'Introdu numele și prenumele', 120)] },
    { type: 1, components: [input('cnp', 'CNP angajat', 'Introdu CNP-ul angajatului', 120)] },
    { type: 1, components: [input('phone', 'Număr de telefon', '07xx xxx xxx', 80)] },
  ] } };
}

function contractSettingsModal() {
  const input = (custom_id: string, label: string, style: number, required: boolean, placeholder: string, max_length: number) => ({ type: 4, custom_id, label, style, required, placeholder, max_length });
  return { type: 9, data: { custom_id: 'panel:contracts:settings_submit', title: 'Setează contractul', components: [
    { type: 1, components: [input('title', 'Numele contractului', 1, true, 'Ex: Contract de colaborare', 100)] },
    { type: 1, components: [input('position', 'Funcție implicită', 1, false, 'Ex: Angajat', 100)] },
    { type: 1, components: [input('salary', 'Salariu implicit', 1, false, 'Ex: 100 lei/lună', 120)] },
    { type: 1, components: [input('schedule', 'Program implicit', 1, false, 'Ex: 20:00-23:00', 120)] },
    { type: 1, components: [input('template', 'Șablonul contractului', 2, true, 'Lipește textul contractului și folosește variabilele de mai jos', 4000)] },
  ] } };
}

function contractInfoMessage() {
  return interactionMessage('', { embeds: [{ title: 'ℹ️ Cum configurezi contractul', description: 'În șablon, folosește exact variabilele de mai jos între acolade duble. La generare, botul le înlocuiește automat cu datele organizației și ale angajatului.', color: 0x14b8a6, fields: [
    { name: 'Date completate automat', value: '`{{COMPANY}}` companie\n`{{ADDRESS}}` adresă\n`{{MANAGER}}` manager\n`{{POSITION}}` funcție\n`{{SALARY}}` salariu\n`{{PROGRAM}}` program\n`{{START_DATE}}` data începerii\n`{{CONTRACT_NUMBER}}` număr contract', inline: true },
    { name: 'Date cerute la generare', value: '`{{EMPLOYEE_NAME}}` nume și prenume\n`{{CNP}}` CNP\n`{{PHONE}}` număr de telefon', inline: true },
    { name: 'Exemplu', value: 'Angajat: `{{EMPLOYEE_NAME}}`\nCNP: `{{CNP}}`\nTelefon: `{{PHONE}}`\nSalariu: `{{SALARY}}`', inline: false },
  ], footer: { text: 'Panel Pro · Contracte Discord' } }] });
}

function contractTemplateVariables() {
  return new Set(['{{COMPANY}}', '{{ADDRESS}}', '{{MANAGER}}', '{{EMPLOYEE_NAME}}', '{{CNP}}', '{{PHONE}}', '{{POSITION}}', '{{SALARY}}', '{{PROGRAM}}', '{{START_DATE}}', '{{CONTRACT_NUMBER}}']);
}

async function handleContractSettingsSubmit(db: any, context: any, interaction: any, values: Record<string, any>) {
  if (!isDiscordManager(interaction) && !context.platformAdmin) throw new Error('Doar ownerul serverului sau un administrator cu Manage Server poate seta contractul.');
  const title = contractValue(values.title, '');
  const template = String(values.template ?? '').trim().slice(0, 50000);
  const position = contractValue(values.position, 'Angajat');
  const salary = contractValue(values.salary, '');
  const schedule = contractValue(values.schedule, '20:00-23:00');
  if (title.length < 2) return interactionMessage('Numele contractului este obligatoriu.');
  if (template.length < 20) return interactionMessage('Șablonul contractului este prea scurt.');
  const unknown = [...template.matchAll(/{{[A-Z0-9_]+}}/g)].map((match) => match[0]).filter((value) => !contractTemplateVariables().has(value));
  if (unknown.length) return interactionMessage(`Variabile necunoscute în șablon: ${[...new Set(unknown)].join(', ')}`);
  const { error } = await db.from('app_settings').upsert({ organization_id: context.organization.id, key: 'contract_template', value: { title, template, defaults: { position, salary: salary || null, schedule } }, updated_at: new Date().toISOString() }, { onConflict: 'organization_id,key' });
  if (error) throw error;
  return interactionMessage(`Șablonul **${title}** a fost salvat. La generare se completează automat organizația, managerul, funcția, salariul, programul, data și numărul contractului; angajatul completează numele, CNP-ul și telefonul.`);
}

function disciplineModal(audience: 'organization' | 'departments', kind: 'warning' | 'sanction', targetId = '') {
  const label = audience === 'organization' ? 'Organizație' : 'Angajați';
  const input = (custom_id: string, labelText: string, style: number, required: boolean, placeholder: string, max_length: number) => ({ type: 4, custom_id, label: labelText, style, required, placeholder, max_length });
  const components: any[] = [{ type: 1, components: [input('reason', 'Motiv', 2, true, 'Explică motivul...', 4000)] }, { type: 1, components: [input('notes', 'Note (opțional)', 2, false, 'Detalii suplimentare...', 4000)] }];
  if (kind === 'warning') components.push({ type: 1, components: [input('evidence_url', 'Dovadă (opțional)', 1, false, 'https://...', 500)] });
  else components.push(
    { type: 1, components: [input('amount_currency', 'Sumă și monedă', 1, true, 'Exemplu: 500 USD', 40)] },
    { type: 1, components: [input('due_at', 'Scadență (opțional)', 1, false, 'zz.ll.aaaa', 10)] },
    { type: 1, components: [input('evidence_url', 'Dovadă (opțional)', 1, false, 'https://...', 500)] },
  );
  return { type: 9, data: { custom_id: `panel:discipline:${audience}:submit:${kind}:${targetId}`, title: `${kind === 'warning' ? 'Avertisment' : 'Sancțiune'} · ${label}`, components } };
}

function actionModal() {
  const input = (custom_id: string, label: string, style: number, required: boolean, placeholder: string, max_length: number) => ({ type: 4, custom_id, label, style, required, placeholder, max_length });
  return { type: 9, data: { custom_id: 'panel:actions:organization:details', title: 'Acțiune · Organizație', components: [
    { type: 1, components: [input('action_type', 'Tip acțiune', 1, true, 'Minat, Farmat, Patrulă...', 40)] },
    { type: 1, components: [input('action_label', 'Denumire', 1, true, 'Exemplu: Car meet', 120)] },
    { type: 1, components: [input('description', 'Descriere', 2, false, 'Ce s-a făcut...', 4000)] },
    { type: 1, components: [input('notes', 'Note (opțional)', 2, false, 'Detalii suplimentare...', 4000)] },
  ] } };
}

function actionParticipantPicker(draftId: string) {
  return interactionMessage('Alege participanții direct din lista serverului. Poți selecta până la 25 de persoane.', {
    components: [
      { type: 1, components: [{ type: 5, custom_id: `panel:actions:organization:participants:${draftId}`, placeholder: 'Caută și selectează participanții', min_values: 1, max_values: 25 }] },
      { type: 1, components: [{ type: 2, style: 2, label: 'Salvează fără participanți', custom_id: `panel:actions:organization:participants_skip:${draftId}` }] },
    ],
  });
}

function disciplineComponents(audience: 'organization' | 'departments', kind: 'warning' | 'sanction', id: string) {
  const prefix = `panel:discipline:${audience}`;
  return [{ type: 1, components: kind === 'warning' ? [
    { type: 2, style: 3, label: 'Marchează rezolvat', custom_id: `${prefix}:resolve:warning:${id}` },
    { type: 2, style: 4, label: 'Șterge', custom_id: `${prefix}:delete:warning:${id}` },
  ] : [
    { type: 2, style: 3, label: 'Marchează achitată', custom_id: `${prefix}:resolve:sanction:${id}` },
    { type: 2, style: 2, label: 'Anulează', custom_id: `${prefix}:cancel:sanction:${id}` },
    { type: 2, style: 4, label: 'Șterge', custom_id: `${prefix}:delete:sanction:${id}` },
  ] }];
}

function disciplineEmbed(record: any, kind: 'warning' | 'sanction', context: any, action = 'nou') {
  const audience = context.audience === 'organization' ? 'Organizație' : 'Angajați';
  const resolved = kind === 'warning' ? ['resolved', 'revoked'].includes(String(record.status)) : ['paid', 'waived', 'cancelled'].includes(String(record.status));
  const status = kind === 'warning' ? (record.status === 'resolved' ? 'Rezolvat' : record.status === 'revoked' ? 'Revocat' : 'Activ') : ({ paid: 'Achitată', waived: 'Anulată', cancelled: 'Anulată' } as any)[record.status] || 'Emisă';
  const fields: any[] = [
    { name: '👤 Vizat', value: String(record.target_name || context.organization.name).slice(0, 1024), inline: true },
    { name: '📌 Status', value: status, inline: true },
    { name: '💬 Motiv', value: String(record.reason || '—').slice(0, 1024), inline: false },
  ];
  if (kind === 'sanction') fields.splice(2, 0, { name: '💰 Sumă', value: `${record.amount} ${record.currency}`, inline: true }, { name: '📊 Avertismente active', value: String(record.warning_count_snapshot || 0), inline: true });
  if (record.notes) fields.push({ name: '📝 Note', value: String(record.notes).slice(0, 1024), inline: false });
  if (record.evidence_url) fields.push({ name: '📎 Dovadă', value: String(record.evidence_url).slice(0, 1024), inline: false });
  if (record.due_at) fields.push({ name: '📅 Scadență', value: new Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', dateStyle: 'short' }).format(new Date(record.due_at)), inline: true });
  return { title: `${kind === 'warning' ? '⚠️ Avertisment' : '💰 Sancțiune'} ${action === 'nou' ? 'nou(ă)' : action} · ${audience}`, description: `Înregistrare salvată în Panel Pro pentru organizația **${context.organization.name}**.`, color: resolved ? 0x64748b : kind === 'warning' ? 0xf59e0b : 0xef4444, fields, footer: { text: `Panel Pro · ${kind === 'warning' ? 'Avertismente' : 'Sancțiuni'} · ${record.issued_by_name || context.displayName}` }, timestamp: new Date().toISOString() };
}

function actionComponents(id: string) {
  return [{ type: 1, components: [{ type: 2, style: 4, label: 'Șterge acțiunea', custom_id: `panel:actions:organization:delete:${id}` }] }];
}

function actionEmbed(record: any, context: any) {
  const participants = Array.isArray(record.participants) ? record.participants : [];
  return { title: `✅ Acțiune nouă · ${String(record.action_label || 'Acțiune').slice(0, 120)}`, description: String(record.description || 'A fost înregistrată o acțiune a organizației.').slice(0, 4096), color: 0x22c55e, fields: [
    { name: '📌 Tip', value: String(record.action_type || 'Personalizat'), inline: true },
    { name: '👥 Participanți', value: participants.length ? participants.map((item: any) => `• ${item.name || item.discord_id}`).join('\n').slice(0, 1024) : 'Nespecificați', inline: false },
    ...(record.notes ? [{ name: '📝 Note', value: String(record.notes).slice(0, 1024), inline: false }] : []),
  ], footer: { text: `Panel Pro · Acțiuni · ${record.created_by_name || context.displayName}` }, timestamp: new Date().toISOString() };
}

async function actionStats(db: any, context: any, days = 7) {
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - (Math.max(1, Math.min(365, days)) - 1) * 86400000);
  const { data, error } = await db.from('organization_actions').select('action_label,participants,created_at').eq('organization_id', context.organization.id).gte('created_at', periodStart.toISOString()).lte('created_at', periodEnd.toISOString()).order('created_at', { ascending: false });
  if (error) throw error;
  const people = new Map<string, { name: string; count: number }>();
  const types = new Map<string, number>();
  for (const row of data || []) {
    const label = String(row.action_label || 'Acțiune');
    types.set(label, (types.get(label) || 0) + 1);
    for (const participant of Array.isArray(row.participants) ? row.participants : []) {
      const id = String(participant?.discord_id || '').trim();
      if (!id) continue;
      const current = people.get(id) || { name: String(participant?.name || id), count: 0 };
      current.count += 1;
      people.set(id, current);
    }
  }
  const ranking = [...people.values()].sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, 'ro')).slice(0, 10);
  const rankingText = ranking.length ? ranking.map((person, index) => `${index + 1}. **${person.name}** — ${person.count} participări`).join('\n') : 'Nu există participări în perioada aleasă.';
  const typesText = [...types.entries()].sort((left, right) => right[1] - left[1]).map(([label, count]) => `${label}: ${count}`).join(' · ') || '—';
  return interactionMessage('', { embeds: [{ title: `📊 Clasament acțiuni · ${context.organization.name}`, color: 0x22c55e, fields: [
    { name: 'Perioadă', value: `Ultimele ${days} zile`, inline: true },
    { name: 'Acțiuni', value: String((data || []).length), inline: true },
    { name: 'Tipuri', value: typesText.slice(0, 1024), inline: false },
    { name: 'Top participanți', value: rankingText.slice(0, 1024), inline: false },
  ], footer: { text: 'Panel Pro · clasament salvat în Supabase' }, timestamp: new Date().toISOString() }] });
}

async function loadDiscordMember(discordId: string, guildId: string, db: any) {
  const token = await getPlatformSecret(db, 'discord_bot_token');
  if (!token) throw new Error('Botul Discord nu este configurat.');
  const response = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${discordId}`, { headers: { Authorization: `Bot ${token}` } });
  if (!response.ok) throw new Error(`Membrul Discord nu a putut fi citit (HTTP ${response.status}).`);
  const member = await response.json();
  const user = member?.user || {};
  return { discord_id: String(user.id || discordId), name: String(member?.nick || user.global_name || user.username || discordId).trim(), username: String(user.username || '').trim(), role_ids: Array.isArray(member?.roles) ? member.roles.map((id: any) => String(id)) : [] };
}

function contractTemplateFallback() {
  return `CONTRACT INDIVIDUAL DE MUNCĂ

Angajator: {{COMPANY}}, reprezentată de {{MANAGER}}.
Adresă: {{ADDRESS}}.

Angajat: {{EMPLOYEE_NAME}}
CNP: {{CNP}}
Telefon: {{PHONE}}

Funcție: {{POSITION}}
Salariu: {{SALARY}}
Program: {{PROGRAM}}
Data începerii: {{START_DATE}}
Număr contract: {{CONTRACT_NUMBER}}

Contractul este încheiat pe perioadă nedeterminată, iar orice modificare se face prin act adițional semnat de ambele părți.

ANGAJATOR: {{MANAGER}}
ANGAJAT: {{EMPLOYEE_NAME}}`;
}

function contractValue(value: unknown, fallback = '') {
  return String(value ?? fallback).trim().slice(0, 1000);
}

function replaceContractPlaceholders(template: string, values: Record<string, string>) {
  return String(template || '').replace(/{{([A-Z0-9_]+)}}/g, (match, key) => values[key] ?? match).slice(0, 50000);
}

async function nextContractNumber(db: any, organizationId: string, dateText: string) {
  const { data, error } = await db.from('organization_contracts').select('contract_number').eq('organization_id', organizationId).ilike('contract_number', `CN-${dateText}-%`).order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  const prefix = `CN-${dateText}-`;
  const highest = (data || []).reduce((max: number, item: any) => {
    const value = String(item?.contract_number || '');
    if (!value.startsWith(prefix)) return max;
    const number = Number.parseInt(value.slice(prefix.length), 10);
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(5, '0')}`;
}

function contractEmbed(contract: any, organization: any, title: string, instructionText = '') {
  const fields = [
    { name: '👤 Angajat', value: contract.employee_name, inline: true },
    { name: '🪪 CNP', value: contract.cnp, inline: true },
    { name: '📞 Telefon', value: contract.phone, inline: true },
    { name: '💼 Funcție', value: contract.position, inline: true },
    { name: '💰 Salariu', value: contract.salary, inline: true },
    { name: '🕒 Program', value: contract.schedule, inline: true },
    { name: '📅 Data începerii', value: contract.start_date, inline: true },
    { name: '🔢 Număr contract', value: contract.contract_number, inline: true },
    { name: '👔 Manager', value: contract.manager, inline: true },
  ];
  if (instructionText) fields.push({ name: '📎 Imagini necesare', value: instructionText, inline: false });
  return {
    title: `📄 ${title} · ${organization.name}`.slice(0, 256),
    description: 'Contractul a fost generat din șablonul configurat în Panel Pro și salvat în istoricul organizației.',
    color: 0x14b8a6,
    fields,
    footer: { text: 'Panel Pro · Log contracte · datele sunt salvate în Supabase' },
    timestamp: new Date().toISOString(),
  };
}

function contractComponents(contractId: string, includePublish = true) {
  const components: any[] = [{ type: 2, style: 1, label: 'Copiază contractul', custom_id: `panel:contracts:copy:${contractId}` }];
  if (includePublish) components.push({ type: 2, style: 3, label: 'Trimite contractul', custom_id: `panel:contracts:publish:${contractId}` });
  return [{ type: 1, components }];
}

function contractCopyModal(contract: any) {
  const text = String(contract?.contract_text || '').trim().slice(0, 4000);
  return { type: 9, data: { custom_id: `panel:contracts:copy:modal:${String(contract?.id || '')}`, title: `Contract ${String(contract?.contract_number || '').slice(0, 28)}`, components: [{ type: 1, components: [{ type: 4, custom_id: 'contract_text', label: 'Contract generat · Ctrl+A / Ctrl+C', style: 2, required: true, value: text, max_length: 4000 }]}] } };
}

async function loadSavedContract(db: any, context: any, contractId: string) {
  const { data: contract, error: contractError } = await db.from('organization_contracts').select('id,employee_id,contract_number,contract_text,phone,position,salary,schedule,start_date,created_by_discord_id,discord_message_id,discord_message_ids').eq('organization_id', context.organization.id).eq('id', contractId).maybeSingle();
  if (contractError) throw contractError;
  if (!contract) return null;
  const { data: employee, error: employeeError } = await db.from('organization_employees').select('full_name,cnp,discord_id').eq('organization_id', context.organization.id).eq('id', contract.employee_id).maybeSingle();
  if (employeeError) throw employeeError;
  return { ...contract, employee_name: employee?.full_name || 'Angajat', cnp: employee?.cnp || '—', manager: context.displayName };
}

async function handleContractSubmit(db: any, context: any, values: Record<string, any>) {
  const employeeName = contractValue(values.employee_name, '');
  const cnp = contractValue(values.cnp, '');
  const phone = contractValue(values.phone, '');
  if (!employeeName) return interactionMessage('Numele și prenumele sunt obligatorii.');
  if (!cnp) return interactionMessage('CNP-ul angajatului este obligatoriu.');
  if (!phone) return interactionMessage('Numărul de telefon al angajatului este obligatoriu.');
  const { data: templateSetting, error: templateError } = await db.from('app_settings').select('value').eq('organization_id', context.organization.id).eq('key', 'contract_template').maybeSingle();
  if (templateError) throw templateError;
  const custom = templateSetting?.value && typeof templateSetting.value === 'object' ? templateSetting.value : {};
  const defaults = custom.defaults && typeof custom.defaults === 'object' ? custom.defaults : {};
  const today = romanianDisplayDate();
  const contractNumber = await nextContractNumber(db, String(context.organization.id), today);
  const contract = {
    employee_name: employeeName,
    cnp,
    phone,
    position: contractValue(defaults.position, 'Angajat'),
    salary: contractValue(defaults.salary, '100 lei/lună'),
    schedule: contractValue(defaults.schedule, '20:00-23:00'),
    start_date: contractValue(defaults.start_date, today),
    contract_number: contractNumber,
    manager: context.displayName,
  };
  const template = String(custom.template || contractTemplateFallback()).trim().slice(0, 50000);
  const contractText = replaceContractPlaceholders(template, {
    COMPANY: contractValue(context.organization.name, 'Organizație'),
    ADDRESS: contractValue(context.organization.address, '—'),
    MANAGER: contract.manager,
    EMPLOYEE_NAME: contract.employee_name,
    CNP: contract.cnp,
    PHONE: contract.phone,
    POSITION: contract.position,
    SALARY: contract.salary,
    PROGRAM: contract.schedule,
    START_DATE: contract.start_date,
    CONTRACT_NUMBER: contract.contract_number,
  });
  const now = new Date().toISOString();
  const { data: existingEmployee, error: existingEmployeeError } = await db.from('organization_employees').select('id').eq('organization_id', context.organization.id).eq('cnp', contract.cnp).maybeSingle();
  if (existingEmployeeError) throw existingEmployeeError;
  let employee: any;
  if (existingEmployee?.id) {
    const { data: updatedEmployee, error: updateEmployeeError } = await db.from('organization_employees').update({ full_name: contract.employee_name, status: 'active', left_at: null, archived_at: null, updated_at: now }).eq('organization_id', context.organization.id).eq('id', existingEmployee.id).select('id').single();
    if (updateEmployeeError) throw updateEmployeeError;
    employee = updatedEmployee;
  } else {
    const { data: upsertedEmployee, error: employeeError } = await db.from('organization_employees').upsert({ organization_id: context.organization.id, full_name: contract.employee_name, cnp: contract.cnp, status: 'active', left_at: null, archived_at: null, updated_at: now }, { onConflict: 'organization_id,cnp' }).select('id').single();
    if (employeeError) throw employeeError;
    employee = upsertedEmployee;
  }
  const { data: saved, error: contractError } = await db.from('organization_contracts').insert({ organization_id: context.organization.id, employee_id: employee.id, contract_number: contract.contract_number, contract_text: contractText, phone: contract.phone, position: contract.position, salary: contract.salary, schedule: contract.schedule, start_date: contract.start_date, created_by_discord_id: context.discordId }).select('id').single();
  if (contractError) {
    if (contractError.code === '23505') return interactionMessage('Numărul contractului există deja. Încearcă din nou.');
    throw contractError;
  }
  return interactionMessage(`Contractul **${contract.contract_number}** a fost generat și salvat. Copiază-l, apoi apasă **Trimite contractul**. Contractul va fi publicat în canalul ales pentru Log contracte, iar imaginile le poți lipi manual sub mesaj.`, { embeds: [contractEmbed(contract, context.organization, 'Contract generat')], components: contractComponents(String(saved.id)) });
}

async function handleContractPublish(db: any, context: any, contractId: string) {
  const contract = await loadSavedContract(db, context, contractId);
  if (!contract) return interactionMessage('Contractul nu mai există în istoricul organizației.');
  if (contract.discord_message_id) return interactionMessage('Contractul este deja publicat în Log contracte.');
  const destinations = routeCandidates(context.settings, context.logRouteKey);
  if (!destinations.some((item: any) => item.candidates.length)) return interactionMessage(`Contractul **${contract.contract_number}** este generat, dar canalul „Log contracte” nu este configurat.`);
  const payload = JSON.stringify({
    allowed_mentions: { parse: [] },
    embeds: [contractEmbed(contract, context.organization, 'Contract nou', 'Atașează imaginile cu buletinul și contractul sub acest mesaj.')]
  });
  const delivery = await deliverDiscordRoute(db, context.settings, context.logRouteKey, payload, { postOnly: true });
  const messageIds = Object.fromEntries((delivery.results || []).filter((item: any) => item.id).map((item: any) => [String(item.target), String(item.id)]));
  if (Object.keys(messageIds).length) {
    const firstMessageId = Object.values(messageIds)[0] as string;
    const { error: messageUpdateError } = await db.from('organization_contracts').update({ discord_message_id: firstMessageId, discord_message_ids: messageIds }).eq('organization_id', context.organization.id).eq('id', contract.id);
    if (messageUpdateError) throw messageUpdateError;
  }
  const destination = destinations.find((item: any) => item.target === context.target)?.candidates?.[0];
  const channelLink = destination?.channel_id ? `https://discord.com/channels/${context.guildId}/${destination.channel_id}` : '';
  return interactionMessage(
    `Contractul **${contract.contract_number}** pentru **${contract.employee_name}** a fost trimis în canalul ales pentru Log contracte.`,
    channelLink
      ? { components: [{ type: 1, components: [{ type: 2, style: 5, label: 'Adaugă imagini', url: channelLink }] }] }
      : {}
  );
}

async function sendDisciplineDiscord(db: any, context: any, kind: 'warning' | 'sanction', record: any, action = 'nou') {
  const routeKey = context.logRouteKey || announcementRoutes(context.audience).log;
  const destinations = routeCandidates(context.settings, routeKey);
  if (!destinations.some((item: any) => item.candidates.length)) throw new Error(`Canalul Discord pentru ${routeKey} nu este configurat.`);
  const payload = JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [disciplineEmbed(record, kind, context, action)], components: disciplineComponents(context.audience, kind, String(record.id)) });
  const delivery = await deliverDiscordRoute(db, context.settings, routeKey, payload, { messageIds: record.discord_message_id ? { [context.target]: String(record.discord_message_id) } : {} });
  return delivery.results?.[0]?.id || null;
}

async function handleDisciplineSubmit(db: any, context: any, interaction: any, kind: 'warning' | 'sanction', values: Record<string, string>, targetId: string) {
  const target = await loadDiscordMember(targetId, context.guildId, db);
  const now = new Date().toISOString();
  if (kind === 'warning') {
    const countQuery = db.from('disciplinary_warnings').select('id', { count: 'exact', head: true }).eq('organization_id', context.organization.id).eq('target_scope', context.audience).eq('status', 'active');
    if (target.discord_id) countQuery.eq('target_discord_id', target.discord_id);
    const { count, error: countError } = await countQuery;
    if (countError) throw countError;
    if (Number(count || 0) >= 3) return interactionMessage('Destinatarul are deja 3 avertismente active. Poți aplica o sancțiune financiară.');
    const reason = String(values.reason || '').trim();
    if (reason.length < 3) return interactionMessage('Motivul trebuie să aibă cel puțin 3 caractere.');
    const { data: record, error } = await db.from('disciplinary_warnings').insert({ organization_id: context.organization.id, target_scope: context.audience, target_discord_id: target.discord_id, target_name: target.name, reason, notes: String(values.notes || '').trim(), evidence_url: String(values.evidence_url || '').trim() || null, issued_by_discord_id: context.discordId, issued_by_name: context.displayName, created_at: now, updated_at: now }).select('*').single();
    if (error) throw error;
    const messageId = await sendDisciplineDiscord(db, context, 'warning', record);
    if (messageId) await db.from('disciplinary_warnings').update({ discord_message_id: messageId }).eq('organization_id', context.organization.id).eq('id', record.id);
    return interactionMessage(`Avertismentul a fost salvat și trimis în canalul Discord configurat pentru ${context.audience === 'organization' ? 'Organizație' : 'Angajați'}.`);
  }
  const countQuery = db.from('disciplinary_warnings').select('id', { count: 'exact', head: true }).eq('organization_id', context.organization.id).eq('target_scope', context.audience).eq('status', 'active');
  if (target.discord_id) countQuery.eq('target_discord_id', target.discord_id);
  const { count, error: countError } = await countQuery;
  if (countError) throw countError;
  const amountMatch = /^\s*([0-9]+(?:[.,][0-9]{1,2})?)\s*([A-Za-z0-9]{2,8})?\s*$/.exec(String(values.amount_currency || ''));
  const amount = amountMatch ? Number(amountMatch[1].replace(',', '.')) : NaN;
  const currency = String(amountMatch?.[2] || 'USD').toUpperCase();
  if (!Number.isFinite(amount) || amount <= 0 || !/^[A-Z0-9]{2,8}$/.test(currency)) return interactionMessage('Introdu o sumă validă, de exemplu **500 USD**.');
  const reason = String(values.reason || '').trim();
  if (reason.length < 3) return interactionMessage('Motivul trebuie să aibă cel puțin 3 caractere.');
  let dueAt: string | null = null;
  if (String(values.due_at || '').trim()) { const parsed = requestDateTime(values.due_at, true); if (!parsed) return interactionMessage('Scadența trebuie să fie în format **zz.ll.aaaa**.'); dueAt = parsed.toISOString(); }
  const { data: record, error } = await db.from('disciplinary_sanctions').insert({ organization_id: context.organization.id, target_scope: context.audience, target_discord_id: target.discord_id, target_name: target.name, warning_count_snapshot: Number(count || 0), amount, currency, reason, notes: String(values.notes || '').trim(), evidence_url: String(values.evidence_url || '').trim() || null, due_at: dueAt, issued_by_discord_id: context.discordId, issued_by_name: context.displayName, created_at: now, updated_at: now }).select('*').single();
  if (error) throw error;
  const messageId = await sendDisciplineDiscord(db, context, 'sanction', record);
  if (messageId) await db.from('disciplinary_sanctions').update({ discord_message_id: messageId }).eq('organization_id', context.organization.id).eq('id', record.id);
  return interactionMessage('Sancțiunea a fost salvată și trimisă în canalul Discord configurat.');
}

async function publishActionRecord(db: any, context: any, record: any) {
  // Panoul de control rămâne în canalul de anunțuri, dar rezultatul acțiunii
  // se publică separat pe ruta configurată pentru „Acțiuni organizație”.
  const routeKey = 'log_actions_organization';
  const destinations = routeCandidates(context.settings, routeKey);
  if (!destinations.some((item: any) => item.candidates.length)) return interactionMessage('Acțiunea a fost salvată în Supabase, dar canalul „Log acțiuni organizație” nu este configurat.');
  const delivery = await deliverDiscordRoute(db, context.settings, routeKey, JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [actionEmbed(record, context)], components: actionComponents(String(record.id)) }));
  const messageId = delivery.results?.[0]?.id || null;
  if (messageId) await db.from('organization_actions').update({ discord_message_id: messageId }).eq('organization_id', context.organization.id).eq('id', record.id);
  return interactionMessage(`Acțiunea a fost salvată și publicată în ${delivery.results.length || 0} canal Discord.`);
}

async function createActionDraft(db: any, context: any, values: Record<string, string>) {
  const type = String(values.action_type || '').trim().slice(0, 40);
  const label = String(values.action_label || '').trim().slice(0, 120);
  if (type.length < 2 || label.length < 2) return interactionMessage('Completează tipul și denumirea acțiunii.');
  const now = new Date().toISOString();
  await db.from('discord_action_drafts').delete().lt('expires_at', now);
  const { data: draft, error } = await db.from('discord_action_drafts').insert({ organization_id: context.organization.id, guild_id: context.guildId, created_by_discord_id: context.discordId, created_by_name: context.displayName, action_type: type, action_label: label, description: String(values.description || '').trim().slice(0, 4000), notes: String(values.notes || '').trim().slice(0, 4000), expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() }).select('id').single();
  if (error) throw error;
  return actionParticipantPicker(String(draft.id));
}

async function finalizeActionDraft(db: any, context: any, draftId: string, participantIds: string[]) {
  const { data: draft, error: draftError } = await db.from('discord_action_drafts').select('*').eq('id', draftId).eq('organization_id', context.organization.id).eq('guild_id', context.guildId).eq('created_by_discord_id', context.discordId).gt('expires_at', new Date().toISOString()).maybeSingle();
  if (draftError) throw draftError;
  if (!draft) return interactionMessage('Selecția participanților a expirat. Apasă din nou pe butonul Acțiune.');
  const ids = [...new Set(participantIds.map(String).filter((id) => /^\d{15,22}$/.test(id)))].slice(0, 25);
  const participants = [];
  for (const id of ids) participants.push(await loadDiscordMember(id, context.guildId, db));
  const now = new Date().toISOString();
  const { data: record, error } = await db.from('organization_actions').insert({ organization_id: context.organization.id, action_type: draft.action_type, action_label: draft.action_label, description: draft.description || '', notes: draft.notes || '', guild_id: context.guildId, guild_name: '', participants, created_by_discord_id: context.discordId, created_by_name: context.displayName, created_at: now, updated_at: now }).select('*').single();
  await db.from('discord_action_drafts').delete().eq('id', draft.id);
  if (error) throw error;
  return publishActionRecord(db, context, record);
}

function requestModal(audience: 'organization' | 'departments') {
  const label = audience === 'organization' ? 'Organizație' : 'Angajați';
  const input = (custom_id: string, labelText: string, style: number, required: boolean, placeholder: string, max_length: number, value = '') => ({ type: 4, custom_id, label: labelText, style, required, placeholder, max_length, ...(value ? { value } : {}) });
  return { type: 9, data: { custom_id: `panel:requests:${audience}:submit`, title: `Învoire · ${label}`, components: [
    { type: 1, components: [input('start_date', 'Data începerii', 1, true, 'zz.ll.aaaa', 10, romanianDisplayDate())] },
    { type: 1, components: [input('end_date', 'Data sfârșitului', 1, true, 'zz.ll.aaaa', 10)] },
    { type: 1, components: [input('reason', 'Motiv / mențiuni', 2, true, 'Explică pe scurt situația...', 1000)] },
    { type: 1, components: [input('proof_url', 'Dovadă / document (opțional)', 1, false, 'https://...', 500)] },
  ] } };
}

async function resolveStashContext(db: any, interaction: any, routeKey: 'stash' | 'log_stash' | 'stash_requests' | 'stash_donations', permission: 'write' | 'request' | 'manage_requests' | 'donate' | 'approve_donation') {
  const guildId = String(interaction.guild_id || '').trim();
  const channelId = String(interaction.channel_id || '').trim();
  const user = interaction.member?.user || interaction.user || {};
  const discordId = String(user.id || '').trim();
  if (!/^\d{15,22}$/.test(guildId) || !/^\d{15,22}$/.test(channelId) || !/^\d{15,22}$/.test(discordId)) throw new Error('Interacțiunea Discord nu conține date valide.');
  const { data: guild, error: guildError } = await db.from('organization_guilds').select('organization_id,kind').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
  if (guildError) throw guildError;
  if (!guild) throw new Error('Serverul Discord nu este asociat unei organizații Panel Pro.');
  const [{ data: organization, error: organizationError }, { data: settings, error: settingsError }, { data: packageSetting, error: packageError }, { data: permissionSetting, error: permissionError }] = await Promise.all([
    db.from('organizations').select('id,name,active').eq('id', guild.organization_id).maybeSingle(),
    db.from('organization_settings').select('discord_channel_routes,panel_public_url').eq('organization_id', guild.organization_id).maybeSingle(),
    db.from('app_settings').select('value').eq('organization_id', guild.organization_id).eq('key', 'organization_package').maybeSingle(),
    db.from('app_settings').select('value').eq('organization_id', guild.organization_id).eq('key', 'action_permissions').maybeSingle(),
  ]);
  if (organizationError || settingsError || packageError || permissionError) throw organizationError || settingsError || packageError || permissionError;
  if (!organization?.active) throw new Error('Organizația este dezactivată.');
  const discordOnly = packageSetting?.value?.code === 'discord';
  if (!resolvePackageFeatures(packageSetting?.value || {}).includes('stash')) throw new Error('Stash nu este inclus în pachetul organizației.');
  const target = String(guild.kind || '') === 'secondary' ? 'secondary' : 'primary';
  if (!channelMatches(settings, routeKey, target, channelId)) throw new Error(`Acest canal nu este configurat pentru panoul ${routeKey === 'stash' ? 'Stash' : routeKey === 'log_stash' ? 'Log stash' : routeKey === 'stash_requests' ? 'Cereri stash' : 'Donații stash'}.`);
  const memberRoles = new Set((interaction.member?.roles || []).map((role: unknown) => String(role)));
  const { data: mappings, error: mappingsError } = await db.from('organization_role_mappings').select('discord_role_id,panel_role,priority').eq('organization_id', guild.organization_id).eq('guild_id', guildId).eq('enabled', true);
  if (mappingsError) throw mappingsError;
  const { data: member, error: memberError } = await db.from('organization_members').select('panel_role').eq('organization_id', guild.organization_id).eq('discord_id', discordId).eq('active', true).maybeSingle();
  if (memberError) throw memberError;
  const roleIds = new Set(member?.panel_role ? [...memberRoles, ...(mappings || []).filter((row: any) => String(row.panel_role || '').toLowerCase() === String(member.panel_role).toLowerCase()).map((row: any) => String(row.discord_role_id))] : [...memberRoles]);
  const platformAdmin = await isPlatformAdminAccount(db, discordId);
  const configured = Array.isArray(permissionSetting?.value?.[`stash.${permission}`]) ? permissionSetting.value[`stash.${permission}`].map(String) : [];
  if (!platformAdmin && !discordOnly && !configured.some((id: string) => roleIds.has(id))) throw new Error('Nu ai permisiunea configurată pentru această funcție Stash.');
  const displayName = String(interaction.member?.nick || user.global_name || user.username || discordId).trim().slice(0, 120) || discordId;
  return { guildId, channelId, target, discordId, displayName, organization, settings, logRouteKey: permission === 'request' || permission === 'manage_requests' ? 'log_stash_requests' : permission === 'donate' || permission === 'approve_donation' ? 'log_stash_donations' : 'log_stash' };
}

function stashModal(kind: 'item' | 'request' | 'donation') {
  const input = (custom_id: string, label: string, style: number, required: boolean, placeholder: string, max_length: number) => ({ type: 4, custom_id, label, style, required, placeholder, max_length });
  const rows = kind === 'item'
    ? [input('title', 'Articol', 1, true, 'Numele articolului', 140), input('category', 'Categorie', 1, true, 'Categoria', 60), input('quantity', 'Număr iteme', 1, true, '0', 20), input('description', 'Detalii', 2, false, 'Detalii despre articol', 1000)]
    : kind === 'request'
      ? [input('item_title', 'Articol solicitat', 1, true, 'Numele articolului', 140), input('quantity', 'Cantitate', 1, true, '0', 20), input('note', 'Notă', 2, false, 'Detalii cerere', 1000)]
      : [input('title', 'Articol donat', 1, true, 'Numele articolului', 140), input('category', 'Categorie', 1, true, 'Categoria', 60), input('quantity', 'Număr iteme', 1, true, '0', 20), input('note', 'Notă', 2, false, 'Detalii donație', 1000)];
  return { type: 9, data: { custom_id: `panel:stash:${kind}:submit`, title: kind === 'item' ? 'Adaugă în Stash' : kind === 'request' ? 'Cerere Stash' : 'Donație Stash', components: rows.map((row) => ({ type: 1, components: [row] })) } };
}

function stashPendingView(kind: 'request' | 'donation', rows: any[]) {
  const label = kind === 'request' ? 'cererile' : 'donațiile';
  if (!rows.length) return interactionMessage(`Nu există ${label} în așteptare.`);
  const options = rows.slice(0, 25).map((row: any) => ({ label: String(kind === 'request' ? row.item_title : row.title).slice(0, 100), value: String(row.id), description: `${row.quantity} iteme · ${String(kind === 'request' ? row.requested_by_name : row.donated_by_name).slice(0, 70)}`.slice(0, 100) }));
  return interactionMessage(`Selectează ${kind === 'request' ? 'cererea' : 'donația'} pe care vrei să o gestionezi.`, { components: [{ type: 1, components: [{ type: 3, custom_id: `panel:stash:select_${kind}`, placeholder: `Alege ${kind === 'request' ? 'o cerere' : 'o donație'}`, min_values: 1, max_values: 1, options }] }] });
}

function stashDecisionView(kind: 'request' | 'donation', id: string, row: any) {
  const title = kind === 'request' ? row.item_title : row.title;
  return interactionMessage(`Ai selectat **${String(title).slice(0, 120)}** · ${row.quantity} iteme.`, { components: [{ type: 1, components: [{ type: 2, style: 3, label: 'Aprobă', custom_id: `panel:stash:decision_${kind}:approved:${id}` }, { type: 2, style: 4, label: 'Respinge', custom_id: `panel:stash:decision_${kind}:rejected:${id}` }] }] });
}

function stashApprovalEmbed(kind: 'request' | 'donation', row: any) {
  const request = kind === 'request';
  return {
    allowed_mentions: { parse: [] },
    embeds: [{
      title: request ? '📨 Cerere Stash · În așteptare' : '🎁 Donație Stash · În așteptare',
      description: request ? 'Această cerere așteaptă aprobarea unui administrator.' : 'Această donație așteaptă aprobarea unui administrator.',
      color: request ? 0xf59e0b : 0xa78bfa,
      fields: request ? [
        { name: 'Articol', value: String(row.item_title || '—'), inline: true },
        { name: 'Cantitate', value: `${row.quantity} iteme`, inline: true },
        { name: 'Solicitat de', value: String(row.requested_by_name || '—'), inline: true },
        { name: 'Detalii', value: String(row.note || 'Fără detalii.'), inline: false },
      ] : [
        { name: 'Articol', value: String(row.title || '—'), inline: true },
        { name: 'Categorie', value: String(row.category || 'General'), inline: true },
        { name: 'Cantitate', value: `${row.quantity} iteme`, inline: true },
        { name: 'Donat de', value: String(row.donated_by_name || '—'), inline: true },
        { name: 'Detalii', value: String(row.note || 'Fără detalii.'), inline: false },
      ],
      footer: { text: 'Panel Pro · necesită aprobare' },
      timestamp: new Date().toISOString(),
    }],
    components: [{ type: 1, components: [
      { type: 2, style: 3, label: 'Aprobă', custom_id: `panel:stash:decision_${kind}:approved:${row.id}` },
      { type: 2, style: 4, label: 'Respinge', custom_id: `panel:stash:decision_${kind}:rejected:${row.id}` },
    ] }],
  };
}

async function publishStashApproval(db: any, context: any, kind: 'request' | 'donation', row: any) {
  const delivery = await deliverDiscordRoute(db, context.settings, 'stash', JSON.stringify(stashApprovalEmbed(kind, row)), { postOnly: true });
  return delivery.results?.length || 0;
}

async function loadStashDecisionRow(db: any, context: any, kind: 'request' | 'donation', id: string) {
  const table = kind === 'request' ? 'organization_stash_requests' : 'organization_stash_donations';
  const { data, error } = await db.from(table).select('*').eq('organization_id', context.organization.id).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data || data.status !== 'pending') throw new Error('Elementul selectat nu mai este în așteptare.');
  return data;
}

async function handleStashDecision(db: any, context: any, kind: 'request' | 'donation', id: string, decision: 'approved' | 'rejected') {
  const row = await loadStashDecisionRow(db, context, kind, id);
  const now = new Date().toISOString();
  if (kind === 'request') {
    const { data, error } = await db.from('organization_stash_requests').update({ status: decision, handled_by_discord_id: context.discordId, handled_by_name: context.displayName, handled_at: now, updated_at: now }).eq('organization_id', context.organization.id).eq('id', id).eq('status', 'pending').select('*').single();
    if (error) throw error;
    const delivery = await deliverDiscordRoute(db, context.settings, 'log_stash_requests', JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [{ title: decision === 'approved' ? '✅ Cerere Stash aprobată' : '❌ Cerere Stash respinsă', fields: [{ name: 'Articol', value: String(data.item_title), inline: true }, { name: 'Număr iteme', value: String(data.quantity), inline: true }, { name: 'Solicitat de', value: String(data.requested_by_name), inline: true }, { name: 'Status', value: decision === 'approved' ? 'Aprobată' : 'Respinsă', inline: true }], color: decision === 'approved' ? 0x22c55e : 0xef4444, timestamp: now }] }), { postOnly: true });
    const messageIds = Object.fromEntries((delivery.results || []).filter((item: any) => item.id).map((item: any) => [item.target, String(item.id)]));
    if (Object.keys(messageIds).length) await db.from('organization_stash_requests').update({ discord_message_ids: messageIds }).eq('organization_id', context.organization.id).eq('id', id);
    return interactionMessage(`Cererea a fost ${decision === 'approved' ? 'aprobată' : 'respinsă'} și logul a fost actualizat.`);
  }
  if (decision === 'approved') {
    const { data: item, error: itemError } = await db.from('organization_stash_items').insert({ organization_id: context.organization.id, title: row.title, category: row.category || 'General', quantity: row.quantity, unit: 'buc.', description: row.note || '', status: 'available', source_type: 'donation', created_by_discord_id: row.donated_by_discord_id, created_by_name: row.donated_by_name, updated_by_discord_id: context.discordId, created_at: now, updated_at: now }).select('*').single();
    if (itemError) throw itemError;
    const { data: donation, error } = await db.from('organization_stash_donations').update({ status: 'approved', reviewed_by_discord_id: context.discordId, reviewed_by_name: context.displayName, reviewed_at: now, stash_item_id: item.id, updated_at: now }).eq('organization_id', context.organization.id).eq('id', id).eq('status', 'pending').select('*').single();
    if (error) throw error;
    const itemDelivery = await deliverDiscordRoute(db, context.settings, 'log_stash', JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [{ title: '✅ Donație aprobată și adăugată în Stash', fields: [{ name: 'Articol', value: String(item.title), inline: true }, { name: 'Categorie', value: String(item.category), inline: true }, { name: 'Număr iteme', value: String(item.quantity), inline: true }, { name: 'Donat de', value: String(donation.donated_by_name), inline: true }, { name: 'Status', value: 'Disponibil', inline: true }], color: 0x22c55e, timestamp: now }], components: [{ type: 1, components: [{ type: 2, style: 4, label: 'Șterge articolul', custom_id: `panel:stash:delete_item:${item.id}` }] }] }), { postOnly: true });
    const itemMessageIds = Object.fromEntries((itemDelivery.results || []).filter((entry: any) => entry.id).map((entry: any) => [entry.target, String(entry.id)]));
    if (Object.keys(itemMessageIds).length) await db.from('organization_stash_items').update({ discord_message_ids: itemMessageIds }).eq('organization_id', context.organization.id).eq('id', item.id);
    const donationDelivery = await deliverDiscordRoute(db, context.settings, 'log_stash_donations', JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [{ title: '✅ Donație Stash aprobată', fields: [{ name: 'Articol', value: String(donation.title), inline: true }, { name: 'Număr iteme', value: String(donation.quantity), inline: true }, { name: 'Donat de', value: String(donation.donated_by_name), inline: true }, { name: 'Status', value: 'Aprobată', inline: true }], color: 0x22c55e, timestamp: now }] }), { postOnly: true });
    const donationMessageIds = Object.fromEntries((donationDelivery.results || []).filter((entry: any) => entry.id).map((entry: any) => [entry.target, String(entry.id)]));
    if (Object.keys(donationMessageIds).length) await db.from('organization_stash_donations').update({ discord_message_ids: donationMessageIds }).eq('organization_id', context.organization.id).eq('id', id);
  } else {
    const { data: donation, error } = await db.from('organization_stash_donations').update({ status: 'rejected', reviewed_by_discord_id: context.discordId, reviewed_by_name: context.displayName, reviewed_at: now, updated_at: now }).eq('organization_id', context.organization.id).eq('id', id).eq('status', 'pending').select('*').single();
    if (error) throw error;
    const delivery = await deliverDiscordRoute(db, context.settings, 'log_stash_donations', JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [{ title: '❌ Donație Stash respinsă', fields: [{ name: 'Articol', value: String(donation.title), inline: true }, { name: 'Număr iteme', value: String(donation.quantity), inline: true }, { name: 'Donat de', value: String(donation.donated_by_name), inline: true }, { name: 'Status', value: 'Respinsă', inline: true }], color: 0xef4444, timestamp: now }] }), { postOnly: true });
    const messageIds = Object.fromEntries((delivery.results || []).filter((item: any) => item.id).map((item: any) => [item.target, String(item.id)]));
    if (Object.keys(messageIds).length) await db.from('organization_stash_donations').update({ discord_message_ids: messageIds }).eq('organization_id', context.organization.id).eq('id', id);
  }
  return interactionMessage(`Donația a fost ${decision === 'approved' ? 'aprobată și adăugată în Stash' : 'respinsă'}.`);
}

async function handleStashSubmit(db: any, context: any, kind: 'item' | 'request' | 'donation', values: Record<string, string>) {
  const quantity = Number(values.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) return interactionMessage('Introdu o cantitate validă.');
  const now = new Date().toISOString();
  if (kind === 'item') {
    const title = String(values.title || '').trim();
    if (title.length < 2) return interactionMessage('Numele articolului este obligatoriu.');
    const { data, error } = await db.from('organization_stash_items').insert({ organization_id: context.organization.id, title, category: String(values.category || 'General').trim(), quantity, unit: 'buc.', description: String(values.description || '').trim(), status: 'available', source_type: 'manual', created_by_discord_id: context.discordId, created_by_name: context.displayName, updated_by_discord_id: context.discordId, created_at: now, updated_at: now }).select('*').single();
    if (error) throw error;
    const delivery = await deliverDiscordRoute(db, context.settings, 'log_stash', JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [{ title: '📦 Articol nou în Stash', color: 0x22c55e, fields: [{ name: 'Articol', value: title, inline: true }, { name: 'Categorie', value: String(values.category || 'General').trim(), inline: true }, { name: 'Număr iteme', value: String(quantity), inline: true }, { name: 'Status', value: 'Disponibil', inline: true }, { name: 'Detalii', value: String(values.description || '').trim() || 'Fără detalii.', inline: false }, { name: 'Retrageri recente', value: 'Nu au fost înregistrate retrageri.', inline: false }], footer: { text: `Postat de ${context.displayName}` }, timestamp: now }], components: [{ type: 1, components: [{ type: 2, style: 4, label: 'Șterge articolul', custom_id: `panel:stash:delete_item:${data.id}` }] }] }), { postOnly: true });
    const itemMessageIds = Object.fromEntries((delivery.results || []).filter((item: any) => item.id).map((item: any) => [item.target, String(item.id)]));
    if (Object.keys(itemMessageIds).length) await db.from('organization_stash_items').update({ discord_message_ids: itemMessageIds }).eq('organization_id', context.organization.id).eq('id', data.id);
    return interactionMessage(`Articolul **${data.title}** a fost adăugat în Stash.${delivery.results.length ? '' : `\n⚠️ Logul nu a fost trimis: ${delivery.failures.join(' | ')}`}`);
  }
  if (kind === 'request') {
    const title = String(values.item_title || '').trim();
    if (title.length < 2) return interactionMessage('Articolul solicitat este obligatoriu.');
    const { data, error } = await db.from('organization_stash_requests').insert({ organization_id: context.organization.id, item_title: title, quantity, note: String(values.note || '').trim(), status: 'pending', requested_by_discord_id: context.discordId, requested_by_name: context.displayName, created_at: now, updated_at: now }).select('*').single();
    if (error) throw error;
    try {
      await publishStashApproval(db, context, 'request', data);
      return interactionMessage('Cererea Stash a fost înregistrată și trimisă pentru aprobare.');
    } catch (approvalError) {
      console.error('[discord-interactions] stash request approval delivery failed', approvalError);
      return interactionMessage('Cererea Stash a fost salvată ca **în așteptare**, dar nu am putut publica solicitarea în embedul administrativ Stash. Verifică ruta Stash.');
    }
  }
  const title = String(values.title || '').trim();
  if (title.length < 2) return interactionMessage('Numele articolului donat este obligatoriu.');
  const { data, error } = await db.from('organization_stash_donations').insert({ organization_id: context.organization.id, title, category: String(values.category || 'General').trim(), quantity, unit: 'buc.', note: String(values.note || '').trim(), status: 'pending', donated_by_discord_id: context.discordId, donated_by_name: context.displayName, created_at: now, updated_at: now }).select('*').single();
  if (error) throw error;
  try {
    await publishStashApproval(db, context, 'donation', data);
    return interactionMessage('Donația Stash a fost înregistrată și trimisă pentru aprobare.');
  } catch (approvalError) {
    console.error('[discord-interactions] stash donation approval delivery failed', approvalError);
    return interactionMessage('Donația Stash a fost salvată ca **în așteptare**, dar nu am putut publica solicitarea în embedul administrativ Stash. Verifică ruta Stash.');
  }
}

function requestDateTime(value: string, endOfDay = false) {
  const raw = String(value || '').trim();
  const displayMatch = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(raw);
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  const match = displayMatch ? [displayMatch[0], displayMatch[3], displayMatch[2], displayMatch[1]] : isoMatch;
  if (!match) return null;
  return zonedDateAt(Number(match[1]), Number(match[2]), Number(match[3]), endOfDay ? 23 : 0, endOfDay ? 59 : 0);
}

function romanianDisplayDate(date = new Date()) {
  const parts = romanianParts(date);
  return `${String(parts.day).padStart(2, '0')}.${String(parts.month).padStart(2, '0')}.${parts.year}`;
}

function requestDateKey(value: string) {
  const date = requestDateTime(value);
  if (!date) return '';
  const parts = romanianParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function requestDateLabel(value: string, endOfDay = false) {
  const date = requestDateTime(value, endOfDay);
  return date ? new Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', dateStyle: 'short', timeStyle: 'short' }).format(date) : value;
}

function requestEmbed(absence: any, context: any, title = 'Învoire nouă') {
  const end = String(absence.end_date || absence.end_at || '').slice(0, 10) || String(absence.start_date || '').slice(0, 10);
  const start = String(absence.start_date || absence.start_at || '').slice(0, 10);
  const audience = context.audience === 'organization' ? 'Organizație' : 'Angajați';
  return { title: `📋 ${title} · ${audience}`, color: title.toLowerCase().includes('șters') ? 0xef4444 : 0xf59e0b, fields: [
    { name: '👤 Membru', value: String(context.displayName || absence.colleague_name || 'Utilizator Discord').slice(0, 1024), inline: true },
    { name: '📌 Tip', value: String(absence.notice_type || 'Învoire').slice(0, 1024), inline: true },
    { name: '📅 Începe', value: requestDateLabel(start), inline: true },
    { name: '📅 Se termină', value: requestDateLabel(end, true), inline: true },
    { name: '💬 Motiv', value: String(absence.reason || absence.notes || '—').slice(0, 1024), inline: false },
    { name: '📎 Dovadă', value: String(absence.proof_url || 'Nu a fost atașat un link.').slice(0, 1024), inline: false },
  ], footer: { text: `Panel Pro · Log învoiri · ${audience}` }, timestamp: new Date().toISOString() };
}

async function saveAbsenceLogMessageIds(db: any, organizationId: string, absenceId: string, messageIds: Record<string, string>) {
  if (!Object.keys(messageIds).length) return;
  const { data: current, error: readError } = await db.from('absences').select('discord_log_message_ids').eq('id', absenceId).eq('organization_id', organizationId).maybeSingle();
  if (readError) throw readError;
  const merged = { ...(current?.discord_log_message_ids || {}), ...messageIds };
  const { error } = await db.from('absences').update({ discord_log_message_ids: merged }).eq('id', absenceId).eq('organization_id', organizationId);
  if (error) throw error;
}

async function sendAbsenceLog(db: any, context: any, absence: any, title = 'Învoire nouă', messageIds: Record<string, string> = {}) {
  try {
    const delivery = await deliverDiscordRoute(db, context.settings, context.logRouteKey, JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [requestEmbed(absence, context, title)] }), { messageIds });
    const nextMessageIds = Object.fromEntries((delivery.results || []).filter((item: any) => item.id).map((item: any) => [item.target, String(item.id)]));
    await saveAbsenceLogMessageIds(db, String(context.organization.id), String(absence.id), nextMessageIds);
    return { error: delivery.results.length ? '' : delivery.failures.join(' | '), messageIds: nextMessageIds };
  } catch (error) {
    console.error('[discord-interactions] absence log failed', error);
    return { error: error instanceof Error ? error.message : 'Logul Discord nu a putut fi trimis.', messageIds: {} };
  }
}

async function myRequests(db: any, context: any) {
  const { data, error } = await db.from('absences').select('notice_type,start_date,end_at,reason,created_at').eq('organization_id', context.organization.id).eq('discord_id', context.discordId).eq('request_audience', context.audience).order('created_at', { ascending: false }).limit(10);
  if (error) throw error;
  const rows = data || [];
  const value = rows.length ? rows.map((item: any) => `• **${String(item.notice_type || 'Învoire')}** · ${requestDateLabel(String(item.start_date || '').slice(0, 10))} → ${requestDateLabel(String(item.end_at || '').slice(0, 10), true)} · înregistrată`).join('\n').slice(0, 4000) : 'Nu ai încă învoiri înregistrate.';
  return interactionMessage('', { embeds: [{ title: `📚 Învoirile mele · ${context.organization.name}`, color: 3447003, description: value, footer: { text: 'Panel Pro · istoricul tău' }, timestamp: new Date().toISOString() }] });
}

async function handleRequestSubmit(db: any, context: any, interaction: any, values: Record<string, string>) {
  const noticeType = 'Învoire';
  const start = requestDateTime(values.start_date);
  const end = requestDateTime(values.end_date, true);
  if (!start || !end || end.getTime() < start.getTime()) return interactionMessage('Completează date valide în format **zz.ll.aaaa**, iar sfârșitul trebuie să fie după început.');
  const startDate = requestDateKey(values.start_date);
  const endDate = requestDateKey(values.end_date);
  const days = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);
  const reason = String(values.reason || '').trim().slice(0, 1000);
  if (!reason) return interactionMessage('Motivul învoirii este obligatoriu.');
  const proofUrl = String(values.proof_url || '').trim().slice(0, 500) || null;
  if (proofUrl) { try { const parsed = new URL(proofUrl); if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('invalid'); } catch { return interactionMessage('Dovada trebuie să fie un link HTTP sau HTTPS valid.'); } }
  const now = new Date().toISOString();
  const absence = { organization_id: context.organization.id, discord_id: context.discordId, request_audience: context.audience, colleague_name: `${context.displayName} [${context.role}]`, notice_type: noticeType, reason, start_date: startDate, days, notes: reason, start_at: start.toISOString(), end_at: end.toISOString(), proof_url: proofUrl, created_at: now };
  const { data: created, error } = await db.from('absences').insert(absence).select('*').single();
  if (error) throw error;
  const logResult = await sendAbsenceLog(db, context, created, 'Învoire nouă');
  return interactionMessage(`Învoirea a fost înregistrată pentru **${startDate.split('-').reverse().join('.')} – ${endDate.split('-').reverse().join('.')}**.${logResult.error ? `\n⚠️ Logul Discord nu a fost trimis: ${logResult.error}` : ''}`);
}

async function handleAnnouncementSubmit(db: any, context: any, interaction: any, postType: 'announcement' | 'question' | 'poll', values: Record<string, string>, postId = '') {
  const title = String(values.title || '').trim().slice(0, 140);
  const content = String(values.content || '').trim().slice(0, 4000);
  if (!title) return interactionMessage('Titlul este obligatoriu.');
  const options = postType === 'poll' ? parseCommunityOptions(values.poll_options) : [];
  if (postType === 'poll' && options.length < 2) return interactionMessage('Sondajul trebuie să aibă minimum două opțiuni, câte una pe fiecare rând.');

  if (postId) {
    const current = await loadCommunityPost(db, String(context.organization.id), postId);
    if (current.post.audience !== context.audience) throw new Error('Postarea nu aparține acestei categorii.');
    const { error: updateError } = await db.from('community_posts').update({ title, content, updated_at: new Date().toISOString() }).eq('organization_id', context.organization.id).eq('id', postId);
    if (updateError) throw updateError;
    if (postType === 'poll') {
      const { error: deleteError } = await db.from('community_poll_options').delete().eq('organization_id', context.organization.id).eq('post_id', postId);
      if (deleteError) throw deleteError;
      const { error: insertError } = await db.from('community_poll_options').insert(options.map((option, position) => ({ organization_id: context.organization.id, post_id: postId, option_text: option, position })));
      if (insertError) throw insertError;
    }
    const refreshed = await loadCommunityPost(db, String(context.organization.id), postId);
    await syncCommunityPostDiscord(db, context, refreshed);
    return interactionMessage('Postarea a fost actualizată în baza de date și în Discord.');
  }

  const now = new Date().toISOString();
  const { data: created, error: createError } = await db.from('community_posts').insert({
    organization_id: context.organization.id,
    audience: context.audience,
    post_type: postType,
    title,
    content,
    author_discord_id: context.discordId,
    author_name: context.displayName,
    created_at: now,
    updated_at: now,
  }).select('*').single();
  if (createError) throw createError;
  if (postType === 'poll') {
    const { error: optionsError } = await db.from('community_poll_options').insert(options.map((option, position) => ({ organization_id: context.organization.id, post_id: created.id, option_text: option, position })));
    if (optionsError) throw optionsError;
  }
  const data = await loadCommunityPost(db, String(context.organization.id), String(created.id));
  try {
    const delivery = await deliverDiscordRoute(db, context.settings, context.routeKey, communityPayload({ ...data, settings: context.settings }));
    await saveCommunityMessageRefs(db, String(context.organization.id), String(created.id), delivery.results || []);
    return interactionMessage(`Postarea a fost salvată și publicată în ${delivery.results.length} canal${delivery.results.length === 1 ? '' : 'e'} Discord.`);
  } catch (error) {
    console.error('[discord-interactions] community post delivery failed', error);
    return interactionMessage(`Postarea a fost salvată în Supabase, dar nu a putut fi publicată pe Discord: ${error instanceof Error ? error.message : 'eroare necunoscută'}`);
  }
}

async function handleAnnouncementButton(db: any, interaction: any, context: any, parts: string[]) {
  const action = parts[3] || '';
  const postId = parts[4] || '';
  if (!postId) return interactionMessage('Postarea nu este validă.');
  const data = await loadCommunityPost(db, String(context.organization.id), postId);
  if (data.post.audience !== context.audience) throw new Error('Postarea nu aparține acestei categorii.');

  if (action === 'react') {
    const reactionIndex = Number(parts[5]);
    const reaction = communityReactionChoices[reactionIndex];
    if (!reaction) return interactionMessage('Reacția nu este validă.');
    const existing = data.reactions.find((item: any) => String(item.user_discord_id) === String(context.discordId) && item.reaction === reaction);
    const query = existing
      ? db.from('community_reactions').delete().eq('organization_id', context.organization.id).eq('post_id', postId).eq('user_discord_id', context.discordId).eq('reaction', reaction)
      : db.from('community_reactions').insert({ organization_id: context.organization.id, post_id: postId, user_discord_id: context.discordId, reaction });
    const { error } = await query;
    if (error) throw error;
    const refreshed = await loadCommunityPost(db, String(context.organization.id), postId);
    await requestDiscordTarget(db, { target: context.target, transport: 'bot', channel_id: context.channelId }, communityPayload({ ...refreshed, settings: context.settings }), { method: 'PATCH', messageId: String(interaction.message?.id || '') });
    return interactionMessage(`${existing ? 'Reacția a fost retrasă' : 'Reacția a fost adăugată'}.`);
  }

  if (action === 'vote') {
    if (data.post.post_type !== 'poll') return interactionMessage('Această postare nu este un sondaj.');
    const requestedOption = parts[5] || '';
    const option = data.options.find((item: any) => String(item.id) === String(requestedOption) || String(item.position) === String(requestedOption));
    if (!option) return interactionMessage('Opțiunea sondajului nu este validă.');
    const { error } = await db.from('community_poll_votes').upsert({ organization_id: context.organization.id, post_id: postId, option_id: option.id, user_discord_id: context.discordId }, { onConflict: 'post_id,user_discord_id' });
    if (error) throw error;
    const refreshed = await loadCommunityPost(db, String(context.organization.id), postId);
    await requestDiscordTarget(db, { target: context.target, transport: 'bot', channel_id: context.channelId }, communityPayload({ ...refreshed, settings: context.settings }), { method: 'PATCH', messageId: String(interaction.message?.id || '') });
    return interactionMessage('Votul a fost salvat și rezultatele au fost actualizate.');
  }

  if (action === 'delete') {
    const refs = Array.isArray(data.post.discord_message_ids) ? data.post.discord_message_ids : [];
    for (const ref of refs) {
      if (!ref?.channel_id || !ref?.id) continue;
      await requestDiscordTarget(db, { target: String(ref.target || 'primary'), transport: 'bot', channel_id: String(ref.channel_id) }, null, { method: 'DELETE', messageId: String(ref.id) }).catch(() => null);
    }
    if (!refs.length && interaction.message?.id) await requestDiscordTarget(db, { target: context.target, transport: 'bot', channel_id: context.channelId }, null, { method: 'DELETE', messageId: String(interaction.message.id) }).catch(() => null);
    const { error } = await db.from('community_posts').delete().eq('organization_id', context.organization.id).eq('id', postId);
    if (error) throw error;
    return interactionMessage('Postarea a fost ștearsă din baza de date și din Discord.');
  }

  return interactionMessage('Acest buton Anunțuri nu este disponibil.');
}

async function handleDisciplineAction(db: any, interaction: any, context: any, parts: string[]) {
  const action = parts[3] || '';
  const kind = parts[4] === 'sanction' ? 'sanction' : 'warning';
  const id = String(parts[5] || '').trim();
  if (!id) return interactionMessage('Înregistrarea disciplinară nu este validă.');
  const table = kind === 'warning' ? 'disciplinary_warnings' : 'disciplinary_sanctions';
  const { data: record, error: loadError } = await db.from(table).select('*').eq('organization_id', context.organization.id).eq('id', id).maybeSingle();
  if (loadError) throw loadError;
  if (!record) return interactionMessage('Înregistrarea disciplinară nu mai există.');
  if (String(record.target_scope) !== context.audience) return interactionMessage('Înregistrarea nu aparține acestei categorii.');
  if (action === 'delete') {
    const { error } = await db.from(table).delete().eq('organization_id', context.organization.id).eq('id', id);
    if (error) throw error;
    await requestDiscordTarget(db, { target: context.target, transport: 'bot', channel_id: context.channelId }, null, { method: 'DELETE', messageId: String(interaction.message?.id || record.discord_message_id || '') }).catch(() => null);
    return interactionMessage('Înregistrarea disciplinară a fost ștearsă.');
  }
  const nextStatus = kind === 'warning' ? (action === 'revoke' ? 'revoked' : 'resolved') : (action === 'cancel' ? 'cancelled' : 'paid');
  const { data: updated, error } = await db.from(table).update({ status: nextStatus, resolved_at: new Date().toISOString(), resolved_by_discord_id: context.discordId, resolution_note: action === 'cancel' ? 'Anulată din Discord.' : 'Actualizată din Discord.', updated_at: new Date().toISOString() }).eq('organization_id', context.organization.id).eq('id', id).select('*').single();
  if (error) throw error;
  const routeKey = context.logRouteKey || announcementRoutes(context.audience).log;
  await requestDiscordTarget(db, { target: context.target, transport: 'bot', channel_id: context.channelId }, JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [disciplineEmbed(updated, kind, context, nextStatus === 'paid' ? 'achitată' : nextStatus === 'cancelled' ? 'anulată' : 'rezolvat(ă)')], components: disciplineComponents(context.audience, kind, id) }), { method: 'PATCH', messageId: String(interaction.message?.id || record.discord_message_id || '') }).catch((error) => console.error(`[discord-interactions] ${routeKey} update failed`, error));
  return interactionMessage(`Înregistrarea a fost ${kind === 'sanction' ? (nextStatus === 'paid' ? 'marcată ca achitată' : 'anulată') : 'marcată ca rezolvată'}.`);
}

async function handleActionButton(db: any, interaction: any, context: any, parts: string[]) {
  const id = String(parts[4] || '').trim();
  if (!id) return interactionMessage('Acțiunea nu este validă.');
  const { data: record, error: loadError } = await db.from('organization_actions').select('*').eq('organization_id', context.organization.id).eq('id', id).maybeSingle();
  if (loadError) throw loadError;
  if (!record) return interactionMessage('Acțiunea nu mai există.');
  const { error } = await db.from('organization_actions').delete().eq('organization_id', context.organization.id).eq('id', id);
  if (error) throw error;
  await requestDiscordTarget(db, { target: context.target, transport: 'bot', channel_id: context.channelId }, null, { method: 'DELETE', messageId: String(interaction.message?.id || record.discord_message_id || '') }).catch(() => null);
  return interactionMessage('Acțiunea a fost ștearsă din baza de date și din Discord.');
}

async function activeShift(db: any, organizationId: string, discordId: string) {
  const { data, error } = await db.from('shifts').select('*').eq('organization_id', organizationId).eq('discord_id', discordId).in('status', ['active', 'paused']).is('end_time', null).order('started_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data || null;
}

function shiftLogEmbed(shift: any, context: any, action: 'started' | 'paused' | 'resumed' | 'completed', now = new Date()) {
  const shiftType = String(shift.shift_type || '').toUpperCase();
  const completed = action === 'completed';
  const paused = action === 'paused';
  const duration = completed ? String(shift.duration || formatDuration(Number(shift.duration_ms || 0) / 1000)) : formatDuration(workedSeconds(shift, now));
  const end = String(shift.end_time || '').trim() || (paused ? 'În pauză' : 'În desfășurare');
  const fields = [
    { name: '👤 Angajat', value: context.displayName, inline: true },
    { name: '📅 Data', value: String(shift.date || romanianDate(now)), inline: true },
    { name: '⏰ Început', value: `${String(shift.date || romanianDate(now))} · ${String(shift.start_time || romanianTime(now))}`, inline: false },
    { name: '⏱️ Interval', value: `${String(shift.start_time || romanianTime(now))} - ${end}`, inline: false },
    { name: '⏳ Timp Total Lucrat', value: `**${duration}**`, inline: true },
  ];
  if (completed) fields.push({ name: '📝 Motiv', value: String(shift.stop_reason || 'Încheiere manuală'), inline: false });
  else fields.push({ name: '📌 Status', value: paused ? 'În pauză' : 'În tură', inline: true });
  return {
    title: `${completed ? '⏹️ Pontaj Încheiat' : paused ? '⏸️ Pontaj Pauză' : action === 'resumed' ? '▶️ Pontaj Reluat' : '▶️ Pontaj Start'} - Tură de ${shiftType}`,
    color: completed ? (shift.shift_type === 'zi' ? 16766720 : 65535) : paused ? 16776960 : 3066993,
    fields,
    footer: { text: 'Panel Pro · Pontaj' },
    timestamp: now.toISOString(),
  };
}

async function sendActionNotification(db: any, settings: any, embed: any, messageIds: Record<string, string> = {}) {
  const destinations = routeCandidates(settings, 'log_pontaj');
  if (!destinations.some((item) => item.candidates.length)) return { error: 'Canalul „Log pontaj” nu este configurat pentru această organizație.', messageIds: {} };
  try {
    const delivery = await deliverDiscordRoute(db, settings, 'log_pontaj', JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [embed] }), { messageIds });
    const nextMessageIds = Object.fromEntries(delivery.results.filter((item: any) => item.id).map((item: any) => [item.target, String(item.id)]));
    return { error: delivery.results.length > 0 ? '' : delivery.failures.join(' | ') || 'Discord nu a acceptat mesajul.', messageIds: nextMessageIds };
  } catch (error) {
    console.error('[discord-interactions] action notification failed', error);
    return { error: error instanceof Error ? error.message : 'Eroare Discord necunoscută.', messageIds: {} };
  }
}

async function saveLogMessageIds(db: any, organizationId: string, shiftId: string, messageIds: Record<string, string>) {
  if (!Object.keys(messageIds).length) return;
  const { data: current, error: readError } = await db.from('shifts').select('discord_log_message_ids').eq('id', shiftId).eq('organization_id', organizationId).maybeSingle();
  if (readError) throw readError;
  const merged = { ...(current?.discord_log_message_ids || {}), ...messageIds };
  const { error } = await db.from('shifts').update({ discord_log_message_ids: merged, updated_at: new Date().toISOString() }).eq('id', shiftId).eq('organization_id', organizationId);
  if (error) throw error;
}

async function updateControlPanel(db: any, context: any, message: any, actionLabel: string) {
  const messageId = String(message?.id || '').trim();
  if (!/^\d{15,22}$/.test(messageId)) return;
  const embed = message?.embeds?.[0];
  if (!embed) return;
  const fields = Array.isArray(embed.fields) ? embed.fields.filter((field: any) => String(field.name || '') !== 'Ultima acțiune') : [];
  fields.push({ name: 'Ultima acțiune', value: `${context.displayName} · ${actionLabel}`, inline: false });
  const payload = { allowed_mentions: { parse: [] }, embeds: [{ ...embed, fields, timestamp: new Date().toISOString() }] };
  try {
    await requestDiscordTarget(db, { target: context.target, transport: 'bot', channel_id: context.channelId }, JSON.stringify(payload), { method: 'PATCH', messageId });
  } catch (error) {
    console.error('[discord-interactions] control panel update failed', error);
  }
}

async function saveSelection(db: any, context: any, shiftType: string) {
  const { error } = await db.from('discord_pontaj_selections').upsert({ organization_id: context.organization.id, discord_id: context.discordId, shift_type: shiftType, selected_at: new Date().toISOString() }, { onConflict: 'organization_id,discord_id' });
  if (error) throw error;
}

async function selectedShift(db: any, context: any) {
  const { data, error } = await db.from('discord_pontaj_selections').select('shift_type,selected_at').eq('organization_id', context.organization.id).eq('discord_id', context.discordId).maybeSingle();
  if (error) throw error;
  return data?.shift_type === 'zi' || data?.shift_type === 'noapte' ? String(data.shift_type) : '';
}

async function myStats(db: any, context: any) {
  const now = new Date();
  const end = romanianDate(now);
  const startDate = new Date(`${end}T12:00:00Z`);
  startDate.setUTCDate(startDate.getUTCDate() - 6);
  const start = startDate.toISOString().slice(0, 10);
  const { data: shifts, error } = await db.from('shifts').select('date,shift_type,status,duration,duration_ms,started_at,ended_at,paused_at,paused_seconds').eq('organization_id', context.organization.id).eq('discord_id', context.discordId).gte('date', start).lte('date', end).order('date', { ascending: false }).order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  const rows = shifts || [];
  const total = rows.reduce((sum: number, shift: any) => sum + (['active', 'paused'].includes(String(shift.status)) ? workedSeconds(shift, now) : Number(shift.duration_ms) >= 0 ? Math.floor(Number(shift.duration_ms) / 1000) : 0), 0);
  const day = rows.filter((shift: any) => String(shift.shift_type) === 'zi').reduce((sum: number, shift: any) => sum + (['active', 'paused'].includes(String(shift.status)) ? workedSeconds(shift, now) : Math.floor(Number(shift.duration_ms || 0) / 1000)), 0);
  const night = rows.filter((shift: any) => String(shift.shift_type) === 'noapte').reduce((sum: number, shift: any) => sum + (['active', 'paused'].includes(String(shift.status)) ? workedSeconds(shift, now) : Math.floor(Number(shift.duration_ms || 0) / 1000)), 0);
  const active = rows.find((shift: any) => ['active', 'paused'].includes(String(shift.status)));
  const activeLabel = active ? `${active.status === 'paused' ? 'În pauză' : 'În tură'} · ${String(active.shift_type || '').toUpperCase()} · ${formatDuration(workedSeconds(active, now))}` : 'Nicio tură activă';
  return interactionMessage('', { embeds: [{ title: `📊 Pontajul meu · ${context.organization.name}`, color: 3447003, fields: [
    { name: 'Perioadă', value: `${start} – ${end}`, inline: false },
    { name: 'Total lucrat', value: `**${formatDuration(total)}**`, inline: true },
    { name: 'Ture de zi', value: formatDuration(day), inline: true },
    { name: 'Ture de noapte', value: formatDuration(night), inline: true },
    { name: 'Status curent', value: activeLabel, inline: false },
  ], footer: { text: 'Panel Pro · datele sunt salvate în Supabase' }, timestamp: now.toISOString() }] });
}

async function handleButton(db: any, interaction: any, context: any, action: string) {
  const orgId = String(context.organization.id);
  if (action === 'shift_day' || action === 'shift_night') {
    const shiftType = action === 'shift_day' ? 'zi' : 'noapte';
    if (!shiftAllowed(shiftType)) {
      return interactionMessage(shiftType === 'noapte'
        ? 'Tura de noapte poate fi selectată între **20:00 și 23:00**.'
        : 'Tura de zi nu poate fi selectată în intervalul configurat pentru tura de noapte.');
    }
    await saveSelection(db, context, shiftType);
    await updateControlPanel(db, context, interaction.message, shiftType === 'zi' ? 'a selectat tura de zi' : 'a selectat tura de noapte');
    return interactionMessage(`Ai selectat tura de **${shiftType}**. Acum poți apăsa **Start**.`);
  }
  if (action === 'my_stats') return myStats(db, context);
  if (!['start', 'pause', 'stop'].includes(action)) return interactionMessage('Acest buton Pontaj nu este încă disponibil.');

  const current = await activeShift(db, orgId, context.discordId);
  if (action === 'start') {
    if (current) return interactionMessage('Ai deja o tură activă. Folosește **Pauză** sau **Stop**.');
    const shiftType = await selectedShift(db, context);
    if (!shiftType) return interactionMessage('Selectează mai întâi **Tura de zi** sau **Tura de noapte**.');
    if (!shiftAllowed(shiftType)) return interactionMessage(shiftType === 'noapte' ? 'Tura de noapte poate fi pornită între **20:00 și 23:00**.' : 'Tura de zi nu poate fi pornită în intervalul configurat pentru tura de noapte.');
    const now = new Date();
    const { data: created, error } = await db.from('shifts').insert({ organization_id: orgId, discord_id: context.discordId, colleague_name: context.displayName, date: romanianDate(now), start_time: romanianTime(now), end_time: null, duration: '00:00:00', duration_ms: 0, shift_type: shiftType, status: 'active', started_at: now.toISOString(), auto_stop_at: shiftDeadline(shiftType, now).toISOString(), paused_seconds: 0, paused_at: null, stop_reason: null, created_at: now.toISOString(), updated_at: now.toISOString() }).select('*').single();
    if (error) throw error;
    const logResult = await sendActionNotification(db, context.settings, shiftLogEmbed(created, context, 'started', now));
    if (logResult?.messageIds) await saveLogMessageIds(db, orgId, String(created.id), logResult.messageIds);
    await updateControlPanel(db, context, interaction.message, `a pornit tura de ${shiftType}`);
    return interactionMessage(`Pontaj pornit: tura de **${shiftType}**.\nSe oprește automat la ora configurată în panel.${logResult?.error ? `\n⚠️ Logul Discord nu a fost trimis: ${logResult.error}` : ''}`);
  }
  if (!current) return interactionMessage('Nu există o tură activă pentru contul tău.');
  if (action === 'pause') {
    const now = new Date();
    const update = current.status === 'paused'
      ? { status: 'active', paused_at: null, paused_seconds: (Number(current.paused_seconds) || 0) + Math.max(0, Math.floor((now.getTime() - new Date(String(current.paused_at)).getTime()) / 1000)), duration_ms: Number(current.duration_ms) || 0, updated_at: now.toISOString() }
      : { status: 'paused', paused_at: now.toISOString(), duration_ms: workedSeconds(current, now) * 1000, updated_at: now.toISOString() };
    const { data, error } = await db.from('shifts').update(update).eq('id', current.id).eq('organization_id', orgId).in('status', ['active', 'paused']).select('*').single();
    if (error) throw error;
    const paused = data.status === 'paused';
    const logResult = await sendActionNotification(db, context.settings, shiftLogEmbed(data, context, paused ? 'paused' : 'resumed', now), current.discord_log_message_ids || {});
    if (logResult?.messageIds) await saveLogMessageIds(db, orgId, String(current.id), logResult.messageIds);
    await updateControlPanel(db, context, interaction.message, paused ? 'a pus tura pe pauză' : 'a reluat tura');
    return interactionMessage(`${paused ? 'Tura a fost pusă pe pauză.' : 'Tura a fost reluată.'}${logResult?.error ? `\n⚠️ Logul Discord nu a fost trimis: ${logResult.error}` : ''}`);
  }
  const now = new Date();
  const seconds = workedSeconds(current, now);
  const update = { status: 'completed', end_time: romanianTime(now), duration: formatDuration(seconds), duration_ms: seconds * 1000, ended_at: now.toISOString(), stop_reason: 'Încheiere manuală', updated_at: now.toISOString() };
  const { data, error } = await db.from('shifts').update(update).eq('id', current.id).eq('organization_id', orgId).in('status', ['active', 'paused']).select('*').maybeSingle();
  if (error) throw error;
  if (!data) return interactionMessage('Tura a fost deja închisă sau nu mai este disponibilă.');
  const logResult = await sendActionNotification(db, context.settings, shiftLogEmbed(data, context, 'completed', now), current.discord_log_message_ids || {});
  if (logResult?.messageIds) await saveLogMessageIds(db, orgId, String(current.id), logResult.messageIds);
  await updateControlPanel(db, context, interaction.message, 'a oprit pontajul');
  return interactionMessage(`Pontaj oprit. Timp lucrat: **${data.duration}**.${logResult?.error ? `\n⚠️ Logul Discord nu a fost trimis: ${logResult.error}` : ''}`);
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);
  const rawBody = await request.text();
  let verificationDb: any = null;
  if (!String(Deno.env.get('DISCORD_PUBLIC_KEY') || Deno.env.get('DISCORD_APPLICATION_PUBLIC_KEY') || '').trim()) {
    const key = serviceKey();
    const url = Deno.env.get('SUPABASE_URL');
    if (key && url) verificationDb = createClient(url, key);
  }
  if (!(await verifyDiscordSignature(request, rawBody, await discordPublicKey(verificationDb)))) return reply({ error: 'Semnătură Discord invalidă.' }, 401);
  let interaction: any;
  try { interaction = JSON.parse(rawBody); } catch { return reply({ error: 'Payload Discord invalid.' }, 400); }
  if (Number(interaction?.type) === 1) return reply({ type: 1 });
  const isApplicationCommand = Number(interaction?.type) === 2;
  if (isApplicationCommand) {
    const commandName = String(interaction?.data?.name || '').trim().toLowerCase();
    if (commandName === 'panel') {
      const subcommand = String(commandSubcommand(interaction)?.name || '').trim().toLowerCase();
      const guildId = String(interaction?.guild_id || '').trim();
      if (subcommand === 'publica') {
        const routeKey = String(commandOption(interaction, 'modul') || '').trim();
        if (!isDiscordManager(interaction)) return reply(interactionMessage('Doar ownerul serverului sau un administrator cu permisiunea Manage Server poate publica embeduri.'));
        if (!panelRouteKeys.includes(routeKey)) return reply(interactionMessage('Modulul selectat nu este valid.'));
        const key = serviceKey();
        if (!key) return reply(interactionMessage('Cheia secretă Supabase lipsește.'));
        return runDeferredCommand(interaction, async () => {
          const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
          await ensureDiscordOnlyOrganization(db, interaction);
          const { data: guild, error: guildError } = await db.from('organization_guilds').select('organization_id,kind').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
          if (guildError) throw guildError;
          if (!guild?.organization_id) throw new Error('Serverul Discord nu este asociat unei organizații Panel Pro.');
          const { data: publishOrganization, error: publishOrganizationError } = await db.from('organizations').select('access_mode').eq('id', guild.organization_id).maybeSingle();
          if (publishOrganizationError) throw publishOrganizationError;
          if (publishOrganization?.access_mode === 'discord_only' && discordPremiumModule(routeKey) && discordPremiumConfigured() && !(await discordPremiumAccess(db, String(guild.organization_id), interaction, guildId))) return discordPremiumMessage();
          const { data: settings, error: settingsError } = await db.from('organization_settings').select('discord_channel_routes').eq('organization_id', guild.organization_id).maybeSingle();
          if (settingsError) throw settingsError;
          const target = String(guild.kind || '') === 'secondary' ? 'secondary' : 'primary';
          const route = settings?.discord_channel_routes?.[routeKey]?.[target];
          if (!route?.channel_id) throw new Error(`Canalul pentru **${PANEL_ROUTE_LABELS[routeKey]}** nu este configurat pe serverul acesta. Folosește mai întâi comanda /panel config.`);
          const trialText = publishOrganization?.access_mode === 'discord_only' ? await discordTrialNotice(db, String(guild.organization_id)) : '';
          const premiumActive = publishOrganization?.access_mode === 'discord_only' && discordPremiumConfigured()
            ? await discordPremiumAccess(db, String(guild.organization_id), interaction, guildId)
            : false;
          if (routeKey === 'status_live') {
            const cronSecret = await getPlatformSecret(db, 'status_live_cron_secret');
            if (!cronSecret) throw new Error('Secretul pentru sincronizarea Status live nu este configurat.');
            const syncResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/status-live-sync`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-cron-secret': cronSecret },
              body: JSON.stringify({ organization_id: guild.organization_id, force: true }),
            });
            const syncData = await syncResponse.json().catch(() => ({}));
            if (!syncResponse.ok) throw new Error(String(syncData?.error || 'Statusul live nu a putut fi publicat.'));
            return interactionMessage(`Statusul live a fost publicat și va fi actualizat automat. În pontaj: **${Number(syncData.active || 0)}**, în pauză: **${Number(syncData.paused || 0)}**.`);
          }
          await deliverDiscordRoute(db, { discord_channel_routes: settings.discord_channel_routes }, routeKey, JSON.stringify(controlPayload(routeKey, trialText, !premiumActive)), { postOnly: true });
          return interactionMessage(`Embedul **${PANEL_ROUTE_LABELS[routeKey]}** a fost publicat în <#${route.channel_id}>.`);
        }, 'Embedul nu a putut fi publicat.');
      }
      if (subcommand === 'config') {
        const routeKey = String(commandOption(interaction, 'modul') || '').trim();
        const channelId = String(commandOption(interaction, 'canal') || '').trim();
        const logChannelId = String(commandOption(interaction, 'canal_log') || '').trim();
        if (!isDiscordManager(interaction)) return reply(interactionMessage('Doar ownerul serverului sau un administrator cu permisiunea Manage Server poate modifica setările.'));
        if (!panelRouteKeys.includes(routeKey) || !/^\d{15,22}$/.test(channelId)) return reply(interactionMessage('Modulul sau canalul selectat nu este valid.'));
        const key = serviceKey();
        if (!key) return reply(interactionMessage('Cheia secretă Supabase lipsește.'));
        const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
        await ensureDiscordOnlyOrganization(db, interaction);
        const { data: guild, error: guildError } = await db.from('organization_guilds').select('organization_id,kind').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
        if (guildError) throw guildError;
        if (!guild?.organization_id) return reply(interactionMessage('Serverul Discord nu este asociat unei organizații Panel Pro.'));
        const { data: settings, error: settingsError } = await db.from('organization_settings').select('discord_channel_routes').eq('organization_id', guild.organization_id).maybeSingle();
        if (settingsError) throw settingsError;
        const routes = structuredClone(settings?.discord_channel_routes || {});
        const target = String(guild.kind || '') === 'secondary' ? 'secondary' : 'primary';
        routes[routeKey] = { ...(routes[routeKey] || {}), [target]: { ...(routes[routeKey]?.[target] || {}), channel_id: channelId, guild_id: guildId, enabled: true } };
        const logRouteKey = PANEL_LOG_ROUTES[routeKey];
        if (logChannelId && logRouteKey) routes[logRouteKey] = { ...(routes[logRouteKey] || {}), [target]: { ...(routes[logRouteKey]?.[target] || {}), channel_id: logChannelId, guild_id: guildId, enabled: true } };
        const { error: updateError } = await db.from('organization_settings').update({ discord_channel_routes: routes, updated_at: new Date().toISOString(), updated_by_discord_id: String(interaction?.member?.user?.id || interaction?.user?.id || '') }).eq('organization_id', guild.organization_id);
        if (updateError) throw updateError;
        return reply(interactionMessage(`Canalul ${channelId} a fost salvat pentru **${PANEL_ROUTE_LABELS[routeKey]}**${logChannelId && logRouteKey ? `, iar canalul de log ${logChannelId} pentru **${PANEL_ROUTE_LABELS[logRouteKey]}**` : ''} (${target === 'primary' ? 'principal' : 'secundar'}).`));
      }
      if (subcommand === 'status') {
        const key = serviceKey();
        if (!key) return reply(interactionMessage('Cheia secretă Supabase lipsește.'));
        const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
        await ensureDiscordOnlyOrganization(db, interaction);
        const { data: guild, error: guildError } = await db.from('organization_guilds').select('organization_id,kind').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
        if (guildError) throw guildError;
        if (!guild?.organization_id) return reply(interactionMessage('Serverul Discord nu este asociat unei organizații Panel Pro.'));
        const { data: settings, error: settingsError } = await db.from('organization_settings').select('discord_channel_routes').eq('organization_id', guild.organization_id).maybeSingle();
        if (settingsError) throw settingsError;
        const target = String(guild.kind || '') === 'secondary' ? 'secondary' : 'primary';
        const routes = settings?.discord_channel_routes || {};
        const lines = panelRouteKeys.map((routeKey) => `${routes?.[routeKey]?.[target]?.channel_id ? '✅' : '⬜'} ${PANEL_ROUTE_LABELS[routeKey]}${routes?.[routeKey]?.[target]?.channel_id ? ` · <#${routes[routeKey][target].channel_id}>` : ''}`);
        const statusOrganization = await db.from('organizations').select('access_mode').eq('id', guild.organization_id).maybeSingle();
        if (statusOrganization.error) throw statusOrganization.error;
        const trialText = statusOrganization.data?.access_mode === 'discord_only' ? await discordTrialNotice(db, String(guild.organization_id)) : '';
        return reply(interactionMessage('', { embeds: [{ title: '⚙️ Panel Pro · Configurare Discord', description: [trialText, lines.join('\n')].filter(Boolean).join('\n\n'), color: 0x5865f2, footer: { text: `Server ${guildId} · ${target}` } }], components: discordPremiumConfigured() ? discordPremiumButton() : [] }));
      }
      return reply(interactionMessage('', {
        embeds: [{
          title: '🧭 Panel Pro · Meniu Discord',
          description: 'Panel Pro gestionează pontaje, învoiri, anunțuri, sondaje, acțiuni, contracte și Stash direct prin embedurile configurate pe server.',
          color: 0x5865f2,
          fields: [
            { name: 'Cum folosești aplicația', value: 'Apasă butoanele din embedurile Panel Pro publicate în canalele configurate. Fiecare acțiune respectă rolurile și permisiunile organizației.', inline: false },
            { name: 'Date și organizații', value: 'Datele sunt salvate în Supabase și rămân separate pentru organizația serverului Discord.', inline: false },
          ],
          footer: { text: 'Panel Pro · Discord' },
        }],
      }));
    }
    return reply(interactionMessage('Comanda Panel Pro nu este disponibilă.'));
  }
  const customId = String(interaction?.data?.custom_id || '');
  const isComponent = Number(interaction?.type) === 3;
  const isButton = isComponent && Number(interaction?.data?.component_type || 2) === 2;
  const isSelect = isComponent && [3, 5].includes(Number(interaction?.data?.component_type || 0));
  const isModalSubmit = Number(interaction?.type) === 5;
  const isPontaj = customId.startsWith('panel:pontaj:');
  const isRequests = customId.startsWith('panel:requests:');
  const isContracts = customId.startsWith('panel:contracts:');
  const isAnnouncements = customId.startsWith('panel:announcements:');
  const isDiscipline = customId.startsWith('panel:discipline:');
  const isActions = customId.startsWith('panel:actions:');
  const isStash = customId.startsWith('panel:stash:');
  if (!isComponent && !isModalSubmit) return reply(interactionMessage('Acest tip de interacțiune nu este disponibil.'));
  if (!isPontaj && !isRequests && !isContracts && !isAnnouncements && !isDiscipline && !isActions && !isStash) return reply(interactionMessage('Acest buton nu aparține unui modul Panel Pro.'));

  // Formularele Discord trebuie afișate imediat. Validarea organizației,
  // rolurilor și canalului se face la trimiterea formularului, nu înainte de
  // răspunsul inițial, deoarece Discord anulează interacțiunea după 3 secunde.
  if (isButton && isRequests && ['organization', 'departments'].includes(customId.split(':')[2] || '') && customId.split(':')[3] === 'new') {
    return reply(requestModal(customId.split(':')[2] === 'departments' ? 'departments' : 'organization'));
  }
  if (isButton && isContracts && ['create', 'settings', 'info'].includes(customId.split(':')[2] || '')) {
    const action = customId.split(':')[2];
    if (action === 'create') return reply(contractModal());
    if (action === 'settings') {
      if (!isDiscordManager(interaction)) return reply(interactionMessage('Doar ownerul serverului sau un administrator cu Manage Server poate seta contractul.'));
      return reply(contractSettingsModal());
    }
    return reply(contractInfoMessage());
  }
  if (isButton && isAnnouncements && customId.split(':')[3] === 'create') {
    const parts = customId.split(':');
    const audience = parts[2] === 'departments' ? 'departments' : parts[2] === 'organization' ? 'organization' : null;
    const postType = ['announcement', 'question', 'poll'].includes(parts[4]) ? parts[4] as 'announcement' | 'question' | 'poll' : null;
    if (audience && postType) return reply(announcementModal(audience, postType));
  }
  if (isButton && isDiscipline && ['warning', 'sanction'].includes(customId.split(':')[3] || '')) {
    const parts = customId.split(':');
    const audience = parts[2] === 'departments' ? 'departments' : parts[2] === 'organization' ? 'organization' : null;
    if (audience) return reply(disciplineTargetPicker(audience, parts[3] as 'warning' | 'sanction'));
  }
  if (isButton && isActions && customId.split(':')[3] === 'create') return reply(actionModal());
  if (isButton && isStash && ['create', 'request', 'donate'].includes(customId.split(':')[2] || '')) {
    const kind = customId.split(':')[2] === 'request' ? 'request' : customId.split(':')[2] === 'donate' ? 'donation' : 'item';
    return reply(stashModal(kind));
  }
  try {
    const key = serviceKey();
    if (!key) throw new Error('Cheia secretă Supabase lipsește.');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    if (isStash && isButton) {
      const parts = customId.split(':');
      if (parts[2] === 'pending_requests' || parts[2] === 'pending_donations') {
        const kind = parts[2] === 'pending_requests' ? 'request' : 'donation';
        const permission = kind === 'request' ? 'manage_requests' : 'approve_donation';
        const deferred = await deferInteraction(interaction, false);
        let result;
        try {
          const context = await resolveStashContext(db, interaction, 'stash', permission);
          const { data, error } = await db.from(kind === 'request' ? 'organization_stash_requests' : 'organization_stash_donations').select('*').eq('organization_id', context.organization.id).eq('status', 'pending').order('created_at', { ascending: false }).limit(25);
          if (error) throw error;
          result = stashPendingView(kind, data || []);
        } catch (error) { result = interactionMessage(readableError(error, 'Lista Stash nu a putut fi încărcată.')); }
        await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
        return new Response(null, { status: 204 });
      }
      if (parts[2] === 'decision_request' || parts[2] === 'decision_donation') {
        const kind = parts[2] === 'decision_request' ? 'request' : 'donation';
        const permission = kind === 'request' ? 'manage_requests' : 'approve_donation';
        const decision = parts[3] === 'approved' ? 'approved' : parts[3] === 'rejected' ? 'rejected' : null;
        if (!decision) return reply(interactionMessage('Decizia Stash nu este validă.'));
        const deferred = await deferInteraction(interaction, false);
        let result;
        try {
          const context = await resolveStashContext(db, interaction, 'stash', permission);
          result = await handleStashDecision(db, context, kind, String(parts[4] || ''), decision);
        }
        catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(readableError(error, 'Decizia Stash nu a putut fi salvată.')); }
        const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
        if (followupId) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
        return new Response(null, { status: 204 });
      }
      if (parts[2] === 'delete_item') {
        const itemId = String(parts[3] || '').trim();
        if (!/^[0-9a-f-]{36}$/i.test(itemId)) return reply(interactionMessage('Articolul Stash selectat nu este valid.'));
        const deferred = await deferInteraction(interaction, false);
        let result;
        try {
          const context = await resolveStashContext(db, interaction, 'log_stash', 'write');
          const { data: item, error: itemError } = await db.from('organization_stash_items').select('id,title').eq('organization_id', context.organization.id).eq('id', itemId).maybeSingle();
          if (itemError) throw itemError;
          if (!item) throw new Error('Articolul nu mai există în Stash.');
          const { error: deleteError } = await db.from('organization_stash_items').delete().eq('organization_id', context.organization.id).eq('id', itemId);
          if (deleteError) throw deleteError;
          await requestDiscordTarget(db, { target: context.target, transport: 'bot', channel_id: context.channelId }, null, { method: 'DELETE', messageId: String(interaction.message?.id || '') });
          result = interactionMessage(`Articolul **${item.title}** a fost șters din Stash și din log.`);
        } catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(readableError(error, 'Articolul nu a putut fi șters din Stash.')); }
        const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
        if (followupId) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
        return new Response(null, { status: 204 });
      }
      const kind = parts[2] === 'request' ? 'request' : parts[2] === 'donate' ? 'donation' : parts[2] === 'create' ? 'item' : null;
      if (!kind) return reply(interactionMessage('Acțiunea Stash nu este disponibilă.'));
      const routeKey = kind === 'request' ? 'stash_requests' : kind === 'donation' ? 'stash_donations' : 'stash';
      const permission = kind === 'request' ? 'request' : kind === 'donation' ? 'donate' : 'write';
      await resolveStashContext(db, interaction, routeKey, permission);
      return reply(stashModal(kind));
    }
    if (isStash && isSelect) {
      const parts = customId.split(':');
      const kind = parts[2] === 'select_request' ? 'request' : parts[2] === 'select_donation' ? 'donation' : null;
      if (!kind) return reply(interactionMessage('Selecția Stash nu este validă.'));
      const permission = kind === 'request' ? 'manage_requests' : 'approve_donation';
      const deferred = await deferInteraction(interaction, false);
      let result;
      try {
        const context = await resolveStashContext(db, interaction, 'stash', permission);
        const id = String(interaction.data?.values?.[0] || '').trim();
        if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Elementul Stash selectat nu este valid.');
        const row = await loadStashDecisionRow(db, context, kind, id);
        result = stashDecisionView(kind, id, row);
      } catch (error) { result = interactionMessage(readableError(error, 'Elementul Stash nu a putut fi încărcat.')); }
      await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
      return new Response(null, { status: 204 });
    }
    if (isStash && isModalSubmit) {
      const parts = customId.split(':');
      const kind = parts[2] === 'request' ? 'request' : parts[2] === 'donation' ? 'donation' : parts[2] === 'item' ? 'item' : null;
      if (!kind || parts[3] !== 'submit') return reply(interactionMessage('Formularul Stash nu este valid.'));
      const routeKey = kind === 'request' ? 'stash_requests' : kind === 'donation' ? 'stash_donations' : 'stash';
      const permission = kind === 'request' ? 'request' : kind === 'donation' ? 'donate' : 'write';
      const deferred = await deferInteraction(interaction, false);
      let result;
      try { result = await handleStashSubmit(db, await resolveStashContext(db, interaction, routeKey, permission), kind, modalValues(interaction)); }
      catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(readableError(error, 'Acțiunea Stash nu a putut fi executată.')); }
      const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
      if (followupId) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
      return new Response(null, { status: 204 });
    }
    if (isContracts && isButton) {
      const parts = customId.split(':');
      if (parts[2] === 'info') return reply(contractInfoMessage());
      if (parts[2] === 'settings') {
        if (!isDiscordManager(interaction)) return reply(interactionMessage('Doar ownerul serverului sau un administrator cu Manage Server poate seta contractul.'));
        return reply(contractSettingsModal());
      }
      if (parts[2] === 'copy') {
        const contractId = String(parts[3] || '').trim();
        if (!/^[0-9a-f-]{36}$/i.test(contractId)) return reply(interactionMessage('Contractul selectat nu este valid.'));
        const context = await resolveContractActionContext(db, interaction);
        const { data: contract, error } = await db.from('organization_contracts').select('id,contract_number,contract_text').eq('organization_id', context.organization.id).eq('id', contractId).maybeSingle();
        if (error) throw error;
        if (!contract) return reply(interactionMessage('Contractul nu mai există în istoricul organizației.'));
        return reply(contractCopyModal(contract));
      }
      if (parts[2] === 'publish') {
        const contractId = String(parts[3] || '').trim();
        if (!/^[0-9a-f-]{36}$/i.test(contractId)) return reply(interactionMessage('Contractul selectat nu este valid.'));
        const deferred = await deferInteraction(interaction, false);
        let result;
        try {
          const context = await resolveContractContext(db, interaction);
          result = await handleContractPublish(db, context, contractId);
        } catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(readableError(error, 'Contractul nu a putut fi publicat.')); }
        const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
        if (followupId && !result?.data?.components?.length) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
        return new Response(null, { status: 204 });
      }
      if (parts[2] !== 'create') return reply(interactionMessage('Acțiunea Contracte nu este disponibilă.'));
      await resolveContractContext(db, interaction);
      return reply(contractModal());
    }
    if (isContracts && isModalSubmit) {
      const parts = customId.split(':');
      if (parts[2] === 'settings_submit') {
        const deferred = await deferInteraction(interaction, false);
        let result;
        try {
          const context = await resolveContractContext(db, interaction);
          result = await handleContractSettingsSubmit(db, context, interaction, modalValues(interaction));
        } catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(readableError(error, 'Șablonul contractului nu a putut fi salvat.')); }
        const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
        if (followupId) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
        return new Response(null, { status: 204 });
      }
      if (parts[2] === 'copy' && parts[3] === 'modal') return reply(interactionMessage('Contractul este afișat mai sus. Selectează textul cu Ctrl+A și copiază-l cu Ctrl+C.'));
      if (parts[2] !== 'submit') return reply(interactionMessage('Formularul Contracte nu este valid.'));
      const deferred = await deferInteraction(interaction, false);
      let result;
      try {
        const context = await resolveContractContext(db, interaction);
        result = await handleContractSubmit(db, context, modalValues(interaction));
      } catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(readableError(error, 'Contractul nu a putut fi salvat.')); }
      const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
      if (followupId && !result?.data?.components?.length) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
      return new Response(null, { status: 204 });
    }
    if (isAnnouncements && isButton) {
      const parts = customId.split(':');
      const audience = parts[2] === 'departments' ? 'departments' : parts[2] === 'organization' ? 'organization' : null;
      const action = parts[3] || '';
      const postType = ['announcement', 'question', 'poll'].includes(parts[4]) ? parts[4] as 'announcement' | 'question' | 'poll' : null;
      if (!audience) return reply(interactionMessage('Categoria Anunțuri nu este validă.'));
      if (action === 'create' && postType) return reply(announcementModal(audience, postType));
      if (action === 'edit') {
        const postId = parts[4] || '';
        const { data: guild } = await db.from('organization_guilds').select('organization_id').eq('guild_id', String(interaction.guild_id || '')).eq('enabled', true).maybeSingle();
        const data = guild ? await loadCommunityPost(db, String(guild.organization_id), postId) : null;
        if (!data) return reply(interactionMessage('Postarea nu mai există.'));
        if (data.post.audience !== audience) return reply(interactionMessage('Postarea nu aparține acestei categorii.'));
        return reply(announcementModal(audience, data.post.post_type === 'poll' ? 'poll' : data.post.post_type === 'question' ? 'question' : 'announcement', data.post, data.options));
      }
      const deferred = await deferInteraction(interaction, false);
      let result;
      try {
        const permission = action === 'delete' ? 'write' : 'read';
        const context = await resolveAnnouncementContext(db, interaction, audience, permission);
        result = await handleAnnouncementButton(db, interaction, context, parts);
      }
      catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(error instanceof Error ? error.message : 'Acțiunea Anunțuri nu a putut fi executată.'); }
      const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
      if (followupId) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
      return new Response(null, { status: 204 });
    }
    if (isAnnouncements && isModalSubmit) {
      const parts = customId.split(':');
      const audience = parts[2] === 'departments' ? 'departments' : parts[2] === 'organization' ? 'organization' : null;
      const mode = parts[3] || '';
      const postType = (mode === 'submit' ? parts[4] : parts[5]) as 'announcement' | 'question' | 'poll';
      if (!audience || !['announcement', 'question', 'poll'].includes(postType) || !['submit', 'edit_submit'].includes(mode)) return reply(interactionMessage('Formularul Anunțuri nu este valid.'));
      const postId = mode === 'edit_submit' ? String(parts[4] || '') : '';
      const deferred = await deferInteraction(interaction, false);
      let result;
      try {
        const context = await resolveAnnouncementContext(db, interaction, audience, 'write');
        result = await handleAnnouncementSubmit(db, context, interaction, postType, modalValues(interaction), postId);
      } catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(error instanceof Error ? error.message : 'Postarea nu a putut fi salvată.'); }
      const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
      if (followupId) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
      return new Response(null, { status: 204 });
    }
    if (isDiscipline && isButton) {
      const parts = customId.split(':');
      const audience = parts[2] === 'departments' ? 'departments' : parts[2] === 'organization' ? 'organization' : null;
      const action = parts[3] || '';
      if (!audience) return reply(interactionMessage('Categoria disciplinară nu este validă.'));
       if (action === 'warning' || action === 'sanction') {
         const permission = action === 'sanction' ? 'sanction' : 'write';
         const context = await resolveManagementContext(db, interaction, audience, permission as 'write' | 'sanction', audience === 'organization' ? 'organization' : 'departments', audience === 'organization' ? 'discipline_organization' : 'discipline_departments', 'discipline_permissions', `${audience}.${permission}`);
         return reply(disciplineTargetPicker(audience, action));
      }
      const kind = parts[4] === 'sanction' ? 'sanction' : 'warning';
      const permission = kind === 'sanction' ? 'sanction' : 'write';
      const routeKey = audience === 'departments' ? 'departments' : 'organization';
      const context = await resolveManagementContext(db, interaction, audience, permission as 'write' | 'sanction', routeKey, audience === 'organization' ? 'discipline_organization' : 'discipline_departments', 'discipline_permissions', `${audience}.${permission}`);
      const deferred = await deferInteraction(interaction, false);
      let result;
      try { result = await handleDisciplineAction(db, interaction, context, parts); } catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(error instanceof Error ? error.message : 'Acțiunea disciplinară nu a putut fi executată.'); }
      const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
      if (followupId) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
      return new Response(null, { status: 204 });
    }
    if (isDiscipline && isSelect) {
      const parts = customId.split(':');
       const audience = parts[2] === 'departments' ? 'departments' : parts[2] === 'organization' ? 'organization' : null;
      const kind = parts[3] === 'sanction' ? 'sanction' : parts[3] === 'warning' ? 'warning' : null;
      const targetId = String(interaction?.data?.values?.[0] || '').trim();
      if (!audience || !kind || !/^\d{15,22}$/.test(targetId)) return reply(interactionMessage('Membrul selectat nu este valid.'));
      const permission = kind === 'sanction' ? 'sanction' : 'write';
       await resolveManagementContext(db, interaction, audience, permission as 'write' | 'sanction', audience === 'organization' ? 'organization' : 'departments', audience === 'organization' ? 'discipline_organization' : 'discipline_departments', 'discipline_permissions', `${audience}.${permission}`);
       return reply(disciplineModal(audience, kind, targetId));
    }
    if (isDiscipline && isModalSubmit) {
      const parts = customId.split(':');
      const audience = parts[2] === 'departments' ? 'departments' : parts[2] === 'organization' ? 'organization' : null;
      const mode = parts[3] || '';
      const kind = parts[4] === 'sanction' ? 'sanction' : parts[4] === 'warning' ? 'warning' : null;
      const targetId = String(parts[5] || '').trim();
      if (!audience || mode !== 'submit' || !kind) return reply(interactionMessage('Formularul disciplinar nu este valid.'));
      const permission = kind === 'sanction' ? 'sanction' : 'write';
      const deferred = await deferInteraction(interaction, false);
      let result;
      try {
        const context = await resolveManagementContext(db, interaction, audience, permission as 'write' | 'sanction', audience === 'organization' ? 'organization' : 'departments', audience === 'organization' ? 'discipline_organization' : 'discipline_departments', 'discipline_permissions', `${audience}.${permission}`);
        result = await handleDisciplineSubmit(db, context, interaction, kind, modalValues(interaction), audience === 'departments' ? targetId : '');
      } catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(error instanceof Error ? error.message : 'Înregistrarea disciplinară nu a putut fi salvată.'); }
      const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
      if (followupId) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
      return new Response(null, { status: 204 });
    }
    if (isActions && isButton) {
      const parts = customId.split(':');
      const action = parts[3] || '';
      if (action === 'create') {
        await resolveManagementContext(db, interaction, 'organization', 'write', 'organization', 'actions_organization', 'action_permissions', 'actions.organization.write');
        return reply(actionModal());
      }
      if (action === 'stats') {
        const context = await resolveManagementContext(db, interaction, 'organization', 'read', 'organization', 'actions_organization', 'action_permissions', 'actions.organization.read');
        const deferred = await deferInteraction(interaction, false);
        let result;
        try { result = await actionStats(db, context); } catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(error instanceof Error ? error.message : 'Clasamentul nu a putut fi încărcat.'); }
        const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
        if (followupId) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
        return new Response(null, { status: 204 });
      }
      if (action === 'participants_skip') {
        const draftId = String(parts[4] || '').trim();
        const context = await resolveManagementContext(db, interaction, 'organization', 'write', 'organization', 'actions_organization', 'action_permissions', 'actions.organization.write');
        const deferred = await deferInteraction(interaction, false);
        let result;
        try { result = await finalizeActionDraft(db, context, draftId, []); } catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(error instanceof Error ? error.message : 'Acțiunea nu a putut fi salvată.'); }
        const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
        if (followupId) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
        return new Response(null, { status: 204 });
      }
      const context = await resolveManagementContext(db, interaction, 'organization', 'write', 'organization', 'actions_organization', 'action_permissions', 'actions.organization.write');
      const deferred = await deferInteraction(interaction, false);
      let result;
      try { result = await handleActionButton(db, interaction, context, parts); } catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(error instanceof Error ? error.message : 'Acțiunea nu a putut fi executată.'); }
      const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
      if (followupId) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
      return new Response(null, { status: 204 });
    }
    if (isActions && isSelect) {
      const parts = customId.split(':');
      if (parts[3] !== 'participants') return reply(interactionMessage('Selectorul participanților nu este valid.'));
      const draftId = String(parts[4] || '').trim();
      const context = await resolveManagementContext(db, interaction, 'organization', 'write', 'organization', 'actions_organization', 'action_permissions', 'actions.organization.write');
      const deferred = await deferInteraction(interaction, false);
      let result;
      try { result = await finalizeActionDraft(db, context, draftId, Array.isArray(interaction.data?.values) ? interaction.data.values : []); } catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(error instanceof Error ? error.message : 'Acțiunea nu a putut fi salvată.'); }
      const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
      if (followupId) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
      return new Response(null, { status: 204 });
    }
    if (isActions && isModalSubmit) {
      if (customId !== 'panel:actions:organization:details') return reply(interactionMessage('Formularul Acțiuni nu este valid.'));
      const deferred = await deferInteraction(interaction, false);
      let result;
      try {
        const context = await resolveManagementContext(db, interaction, 'organization', 'write', 'organization', 'actions_organization', 'action_permissions', 'actions.organization.write');
        result = await createActionDraft(db, context, modalValues(interaction));
      } catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(error instanceof Error ? error.message : 'Acțiunea nu a putut fi salvată.'); }
      const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
      if (followupId && !result?.data?.components?.length) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
      return new Response(null, { status: 204 });
    }
    if (isRequests && isButton) {
      const parts = customId.split(':');
      const audience = parts[2] === 'departments' ? 'departments' : parts[2] === 'organization' ? 'organization' : null;
      const action = parts[3] || '';
      if (!audience) return reply(interactionMessage('Categoria învoirii nu este validă.'));
      if (action === 'new') return reply(requestModal(audience));
      const context = await resolveRequestContext(db, interaction, audience);
      if (!['mine'].includes(action)) return reply(interactionMessage('Acest buton Învoiri nu este încă disponibil.'));
      const deferred = await deferInteraction(interaction, false);
      let result;
      try { result = await myRequests(db, context); } catch (error) { result = interactionMessage(error instanceof Error ? error.message : 'Istoricul învoirilor nu a putut fi încărcat.'); }
      const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
      if (followupId) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
      return new Response(null, { status: 204 });
    }
    if (isRequests && isModalSubmit) {
      const parts = customId.split(':');
      const audience = parts[2] === 'departments' ? 'departments' : parts[2] === 'organization' ? 'organization' : null;
      if (!audience || parts[3] !== 'submit') return reply(interactionMessage('Formularul Învoiri nu este valid.'));
      const deferred = await deferInteraction(interaction, false);
      let result;
      try {
        const context = await resolveRequestContext(db, interaction, audience);
        result = await handleRequestSubmit(db, context, interaction, modalValues(interaction));
      } catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(error instanceof Error ? error.message : 'Învoirea nu a putut fi înregistrată.'); }
      const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
      if (followupId) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
      return new Response(null, { status: 204 });
    }
    if (!isPontaj || !isButton) return reply(interactionMessage('Acțiunea Discord nu este disponibilă.'));
    const action = customId.slice('panel:pontaj:'.length);
    const deferred = await deferInteraction(interaction, action !== 'my_stats');
    let result;
    try {
      const context = await resolveContext(db, interaction);
      result = await handleButton(db, interaction, context, action);
    } catch (error) {
      console.error('[discord-interactions]', error);
      result = interactionMessage(error instanceof Error ? error.message : 'Acțiunea Pontaj nu a putut fi executată.');
    }
    const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
    if (followupId) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId);
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('[discord-interactions]', error);
    return reply(interactionMessage(error instanceof Error ? error.message : 'Acțiunea Pontaj nu a putut fi executată.'));
  }
});
