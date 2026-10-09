import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { isPlatformAdminAccount } from '../_shared/platform-admin.ts';
import { resolvePackageFeatures } from '../_shared/package-features.ts';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';
import { deliverDiscordRoute, requestDiscordTarget, routeCandidates, validDiscordChannelId } from '../_shared/discord-delivery.ts';
import { discordPremiumAccess, discordPremiumButton, discordPremiumConfigured, discordPremiumMessage, discordPremiumModule } from '../_shared/discord-premium.ts';
import { allCategories, calculateRecipe, findCategory, findRecipe } from '../_shared/discord-calculators.ts';
import { syncAbsenceLiveEmbeds } from '../_shared/absence-live.ts';

const DISCORD_API = 'https://discord.com/api/v10';
const PANEL_FOOTER = 'Panel Pro - By Little Mario';
const PANEL_REACTIVATION_CONTACT_URL = 'https://discord.com/channels/@me/247012210021236738';
const serviceKey = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
let discordPublicKeyCache = '';
async function discordPublicKey(db?: any) {
  const direct = String(Deno.env.get('DISCORD_PUBLIC_KEY') || Deno.env.get('DISCORD_APPLICATION_PUBLIC_KEY') || '').trim();
  if (direct) return direct;
  if (discordPublicKeyCache) return discordPublicKeyCache;
  if (!db) return '';
  discordPublicKeyCache = await getPlatformSecret(db, 'discord_public_key')
    || await getPlatformSecret(db, 'discord_application_public_key')
    || await getPlatformSecret(db, 'DISCORD_PUBLIC_KEY')
    || await getPlatformSecret(db, 'DISCORD_APPLICATION_PUBLIC_KEY');
  return discordPublicKeyCache;
}
const normalizeEmbedFooters = (value: any): any => {
  if (Array.isArray(value)) return value.map(normalizeEmbedFooters);
  if (!value || typeof value !== 'object') return value;
  const normalized = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeEmbedFooters(item)]));
  if (Array.isArray(normalized.embeds)) normalized.embeds = normalized.embeds.map((embed: any) => ({ ...embed, footer: { ...(embed?.footer || {}), text: PANEL_FOOTER } }));
  return normalized;
};
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(normalizeEmbedFooters(data)), { status, headers: { 'Content-Type': 'application/json' } });
const interactionMessage = (content: string, extra: Record<string, unknown> = {}) => {
  const expired = /termenul de valabilitate|organizația este dezactivată/i.test(String(content || ''));
  return {
    type: 4,
    data: {
      content,
      flags: 64,
      ...(expired ? {
        components: [{ type: 1, components: [{ type: 2, style: 5, label: 'Contactează pentru reactivare', url: PANEL_REACTIVATION_CONTACT_URL }] }],
      } : {}),
      ...extra,
    },
  };
};
const commandSubcommand = (interaction: any) => Array.isArray(interaction?.data?.options) ? interaction.data.options.find((option: any) => option?.type === 1) : null;
const commandOptions = (interaction: any) => Array.isArray(commandSubcommand(interaction)?.options) ? commandSubcommand(interaction).options : (Array.isArray(interaction?.data?.options) ? interaction.data.options : []);
const commandOption = (interaction: any, name: string) => commandOptions(interaction).find((option: any) => option?.name === name)?.value;
const PANEL_ROUTE_LABELS: Record<string, string> = {
  organization: 'Anunțuri organizație', departments: 'Anunțuri angajați', pontaj: 'Pontaj', log_pontaj: 'Log pontaj',
  requests_organization: 'Învoiri organizație', requests_departments: 'Învoiri angajați', log_requests_organization: 'Log învoiri organizație', log_requests_departments: 'Log învoiri angajați',
  contracts: 'Contracte', log_contracts: 'Log contracte', log_discipline_organization: 'Log avertismente și amenzi organizație', log_discipline_departments: 'Log avertismente și amenzi angajați', log_actions_organization: 'Log acțiuni organizație', actions_organization_weekly: 'Log acțiuni', status_live: 'Status live',
  stash: 'Stash', log_stash: 'Log Stash', stash_requests: 'Cereri Stash', log_stash_requests: 'Log cereri Stash', stash_donations: 'Donații Stash', log_stash_donations: 'Log donații Stash',
  marketplace: 'Marketplace legal', log_marketplace: 'Log Marketplace legal', illegal_marketplace: 'Marketplace ilegal', log_illegal_marketplace: 'Log Marketplace ilegal', event_reminders: 'Evenimente și remindere', log_event_reminders: 'Log evenimente și remindere', presence_events: 'Evenimente cu prezență', log_presence_events: 'Log evenimente cu prezență', tasks: 'Task-uri angajați', log_tasks: 'Log task-uri', contract_identity_weekly: 'Raport săptămânal contracte', log_contract_identity_weekly: 'Log raport săptămânal contracte', actions_organization: 'Acțiuni organizație',
  proposals: 'Propuneri', log_proposals: 'Log propuneri',
  calculator: 'Calculator legal', illegal_calculator: 'Calculator ilegal', illegal_locations: 'Locații ilegale', wheel_timer: 'Roată · timer personal',
};
const panelRouteKeys = Object.keys(PANEL_ROUTE_LABELS);
const PANEL_LOG_ROUTES: Record<string, string> = {
  organization: 'log_announcements_organization', departments: 'log_announcements_departments', pontaj: 'log_pontaj',
  requests_organization: 'log_requests_organization', requests_departments: 'log_requests_departments', contracts: 'log_contracts', presence_events: 'log_presence_events', tasks: 'log_tasks',
  proposals: 'log_proposals',
  actions_organization: 'log_actions_organization', fines_organization: 'log_announcements_organization', fines_departments: 'log_announcements_departments', warnings_organization: 'log_announcements_organization', warnings_departments: 'log_announcements_departments', sanctions_organization: 'log_announcements_organization', sanctions_departments: 'log_announcements_departments', marketplace: 'log_marketplace', illegal_marketplace: 'log_illegal_marketplace', event_reminders: 'log_event_reminders', contract_identity_weekly: 'log_contract_identity_weekly', stash: 'log_stash', stash_requests: 'log_stash', stash_donations: 'log_stash',
};
const DISCIPLINE_LOG_ROUTES: Record<string, string> = {
  organization: 'log_announcements_organization',
  departments: 'log_announcements_departments',
};
const disciplineFineLogRoute = (audience: 'organization' | 'departments') => DISCIPLINE_LOG_ROUTES[audience];
const isDiscordManager = (interaction: any) => {
  try { return (BigInt(String(interaction?.member?.permissions || '0')) & 40n) !== 0n; } catch { return false; }
};

async function requireActiveOrganizationAccess(db: any, organization: any) {
  const { data: accessSetting, error } = await db.from('app_settings')
    .select('value')
    .eq('organization_id', organization.id)
    .eq('key', 'organization_access')
    .maybeSingle();
  if (error) throw error;
  const expiresAt = Date.parse(String(accessSetting?.value?.expires_at || ''));
  if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
    throw new Error(`Termenul de valabilitate al organizației a expirat la ${new Date(expiresAt).toLocaleString('ro-RO')}. Pentru reactivare, contactează administratorul Panel Pro.`);
  }
  if (!organization?.active) throw new Error('Organizația este dezactivată. Pentru reactivare, contactează administratorul Panel Pro.');
}

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
const controlPayload = (routeKey: string, trialText = '', includeDonation = true, proposalAudience = '') => {
  const definitions: Record<string, { title: string; description: string; color: number; buttons: any[] }> = {
    organization: { title: '📢 Anunțuri · Organizație', description: 'Publică anunțuri, întrebări, sondaje și măsuri disciplinare pentru organizație.', color: 0x8b5cf6, buttons: [{ label: 'Publică anunț', style: 1, id: 'panel:announcements:organization:create:announcement' }, { label: 'Pune întrebare', style: 2, id: 'panel:announcements:organization:create:question' }, { label: 'Creează sondaj', style: 3, id: 'panel:announcements:organization:create:poll' }, { label: 'Avertisment', style: 4, id: 'panel:discipline:organization:warning' }, { label: 'Amendă', style: 4, id: 'panel:discipline:organization:sanction' }] },
    departments: { title: '📢 Anunțuri · Angajați', description: 'Publică anunțuri, întrebări, sondaje și măsuri disciplinare pentru angajați.', color: 0x8b5cf6, buttons: [{ label: 'Publică anunț', style: 1, id: 'panel:announcements:departments:create:announcement' }, { label: 'Pune întrebare', style: 2, id: 'panel:announcements:departments:create:question' }, { label: 'Creează sondaj', style: 3, id: 'panel:announcements:departments:create:poll' }, { label: 'Avertisment', style: 4, id: 'panel:discipline:departments:warning' }, { label: 'Amendă', style: 4, id: 'panel:discipline:departments:sanction' }] },
    pontaj: { title: '🕒 Pontaj · Panel Pro', description: 'Apasă Start, iar tura de zi sau de noapte este stabilită automat după ora României și programul configurat în panel.', color: 0x22c55e, buttons: [{ label: 'Start', style: 3, id: 'panel:pontaj:start' }, { label: 'Pauză', style: 2, id: 'panel:pontaj:pause' }, { label: 'Stop', style: 4, id: 'panel:pontaj:stop' }, { label: 'Pontajul meu', style: 1, id: 'panel:pontaj:my_stats' }] },
    requests_organization: { title: '📝 Învoiri · Organizație', description: 'Trimite și consultă învoirile organizației.', color: 0xf59e0b, buttons: [{ label: 'Trimite învoire', style: 1, id: 'panel:requests:organization:new' }, { label: 'Învoirile mele', style: 2, id: 'panel:requests:organization:mine' }] },
    requests_departments: { title: '📝 Învoiri · Angajați', description: 'Trimite și consultă învoirile angajaților.', color: 0xf59e0b, buttons: [{ label: 'Trimite învoire', style: 1, id: 'panel:requests:departments:new' }, { label: 'Învoirile mele', style: 2, id: 'panel:requests:departments:mine' }] },
      contracts: { title: '📄 Contracte · Panel Pro', description: 'Generează și trimite contracte folosind șablonul organizației.', color: 0x14b8a6, buttons: [{ label: 'Creează contract', style: 1, id: 'panel:contracts:create' }, { label: 'Setează contractul', style: 2, id: 'panel:contracts:settings' }, { label: 'Info contract', style: 1, id: 'panel:contracts:info' }] },
      status_live: { title: '📡 Status live · Panel Pro', description: 'Acest embed este actualizat automat la fiecare minut cu pontajele și pauzele active. Configurează canalul Status live, apoi pornește sincronizarea din pagina Status live.', color: 0x06b6d4, buttons: [] },
    marketplace: { title: '🛒 Marketplace', description: 'Publică și consultă anunțuri pentru vehicule, bunuri și servicii.', color: 0x2563eb, buttons: [{ label: 'Publică anunț', style: 1, id: 'panel:marketplace:legal:create' }, { label: 'Anunțurile mele', style: 2, id: 'panel:marketplace:legal:mine' }] },
      illegal_marketplace: { title: '🚨 Marketplace · Ilegal', description: 'Publică și consultă anunțuri Black Market, cu acces controlat.', color: 0xef4444, buttons: [{ label: 'Publică anunț', style: 4, id: 'panel:marketplace:illegal:create' }, { label: 'Anunțurile mele', style: 2, id: 'panel:marketplace:illegal:mine' }] },
      event_reminders: { title: '🗓️ Evenimente și remindere', description: 'Înregistrează evenimente și trimite remindere automate pe durata aleasă.', color: 0xf59e0b, buttons: [{ label: 'Adaugă eveniment', style: 1, id: 'panel:discovery:reminder_create' }, { label: 'Info remindere', style: 2, id: 'panel:discovery:reminder_info' }] },
      contract_identity_weekly: { title: '📋 Raport săptămânal contracte', description: 'Generează exportul săptămânal cu numele și CNP-ul angajaților.', color: 0x14b8a6, buttons: [{ label: 'Generează raport', style: 1, id: 'panel:discovery:weekly_report' }, { label: 'Info raport', style: 2, id: 'panel:discovery:report_info' }] },
      actions_organization: { title: '🎯 Acțiuni · Organizație', description: 'Înregistrează și consultă acțiunile organizației.', color: 0x3b82f6, buttons: [{ label: 'Acțiune', style: 1, id: 'panel:actions:organization:create' }, { label: 'Clasament acțiuni', style: 2, id: 'panel:actions:organization:stats' }] },
      stash_requests: { title: '📨 Cereri Stash', description: 'Solicită articole și urmărește cererile trimise pentru aprobare.', color: 0x3b82f6, buttons: [{ label: 'Solicită articol', style: 1, id: 'panel:stash:request' }, { label: 'Cereri în așteptare', style: 2, id: 'panel:stash:pending_requests' }] },
      stash_donations: { title: '🎁 Donații Stash', description: 'Înregistrează donații și trimite-le spre aprobare administrativă.', color: 0x22c55e, buttons: [{ label: 'Donează articol', style: 3, id: 'panel:stash:donate' }, { label: 'Donații în așteptare', style: 2, id: 'panel:stash:pending_donations' }] },
    stash: { title: '📦 Stash · Administrare', description: 'Gestionează articolele, cererile și donațiile Stash.', color: 0x22c55e, buttons: [{ label: 'Adaugă în Stash', style: 3, id: 'panel:stash:create' }, { label: 'Cereri în așteptare', style: 1, id: 'panel:stash:pending_requests' }, { label: 'Donații în așteptare', style: 1, id: 'panel:stash:pending_donations' }] },
    actions_organization: { title: '🎯 Acțiuni · Organizație', description: 'Înregistrează și consultă acțiunile organizației.', color: 0x3b82f6, buttons: [{ label: 'Acțiune', style: 1, id: 'panel:actions:organization:create' }, { label: 'Clasament acțiuni', style: 2, id: 'panel:actions:organization:stats' }] },
    calculator: { title: '🧮 Calculator legal · Panel Pro', description: 'Alege categoria, articolul și cantitatea. Primești instant materialele directe și materialele brute necesare.', color: 0x22c55e, buttons: [{ label: 'Începe calculul', style: 1, id: 'panel:calculator:legal:start' }] },
    illegal_calculator: { title: '🚨 Calculator ilegal · Panel Pro', description: 'Calculează arme, muniție, topitorie și resurse ilegale direct din Discord. La Ciuperci poți calcula și după materialul disponibil.', color: 0xef4444, buttons: [{ label: 'Începe calculul', style: 4, id: 'panel:calculator:illegal:start' }] },
    illegal_locations: { title: '🗺️ Locații ilegale · Panel Pro', description: 'Alege harta. Embedul se actualizează direct în Discord și păstrează butoanele pentru cele 3 zone.', color: 0xef4444, buttons: [{ label: 'Los Santos', style: 4, id: 'panel:illegal_locations:map:ls' }, { label: 'Cayo Perico', style: 4, id: 'panel:illegal_locations:map:cayo' }, { label: 'Maldive', style: 4, id: 'panel:illegal_locations:map:maldive' }] },
    wheel_timer: { title: '🎡 Roată · timer personal', description: 'Pornește timerul personal de 6 ore și verifică timpul rămas. Răspunsurile sunt private pentru fiecare utilizator.', color: 0x06b6d4, buttons: [{ label: 'Am dat la roată', style: 1, id: 'panel:wheel:start' }, { label: 'Verifică timpul', style: 2, id: 'panel:wheel:status' }] },
    tasks: { title: '📋 Task-uri angajați · Panel Pro', description: 'Creează taskuri cu termen-limită. Angajatul primește mesaj privat și poate accepta sau refuza taskul.', color: 0xf59e0b, buttons: [{ label: 'Creează task', style: 1, id: 'panel:tasks:create' }] },
    proposals: { title: '💡 Propuneri · Panel Pro', description: 'Trimite idei, votează și urmărește statusul lor.', color: 0xa855f7, buttons: proposalAudience === 'organization' ? [{ label: 'Trimite propunere organizație', style: 1, id: 'panel:proposals:organization:create' }] : proposalAudience === 'departments' ? [{ label: 'Trimite propunere angajați', style: 1, id: 'panel:proposals:departments:create' }] : [{ label: 'Propunere organizație', style: 1, id: 'panel:proposals:organization:create' }, { label: 'Propunere angajați', style: 1, id: 'panel:proposals:departments:create' }] },
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

const calculatorKind = (value: unknown): 'legal' | 'illegal' | '' => value === 'illegal' ? 'illegal' : value === 'legal' ? 'legal' : '';
const calculatorId = (value: unknown) => String(value || '').replace(/[^a-z0-9_-]/gi, '_').slice(0, 40);
const calculatorRows = (kind: 'legal' | 'illegal', categoryId = '', page = 0) => {
  const categories = allCategories(kind);
  if (!categoryId) {
    return [{ type: 1, components: [{ type: 3, custom_id: `panel:calculator:${kind}:category`, placeholder: 'Alege categoria calculatorului', min_values: 1, max_values: 1, options: categories.map((category) => ({ label: category.label.slice(0, 100), value: category.id, description: `${category.recipes.filter((item) => !item.componentOnly).length} articole disponibile`.slice(0, 100) })) }] }];
  }
  const category = findCategory(kind, categoryId);
  if (!category) return calculatorRows(kind);
  const pageSize = 25;
  const visibleRecipes = category.recipes.filter((item) => !item.componentOnly);
  const pageCount = Math.max(1, Math.ceil(visibleRecipes.length / pageSize));
  const safePage = Math.max(0, Math.min(pageCount - 1, page));
  // Discord acceptă maximum 25 de opțiuni într-un select. Bucătăria are 28
  // de rețete pe web, așa că le afișăm în două meniuri în aceeași interacțiune
  // pentru ca rețetele de rechin, balenă și Fursex să nu pară lipsă.
  if (category.id === 'bucatarie') {
    const rows = [] as any[];
    for (let offset = 0; offset < visibleRecipes.length; offset += pageSize) {
      const options = visibleRecipes.slice(offset, offset + pageSize).map((item) => ({ label: item.name.slice(0, 100), value: item.id, description: `1 craft = ${item.produces || 1} produs(e)`.slice(0, 100) }));
      rows.push({ type: 1, components: [{ type: 3, custom_id: `panel:calculator:${kind}:item:${calculatorId(category.id)}:${Math.floor(offset / pageSize)}`, placeholder: `${category.label} · rețete ${offset + 1}-${Math.min(offset + pageSize, visibleRecipes.length)}`, min_values: 1, max_values: 1, options }] });
    }
    rows.push({ type: 1, components: [{ type: 2, style: 2, label: 'Categorii', custom_id: `panel:calculator:${kind}:categories` }] });
    return rows;
  }
  const options = visibleRecipes.slice(safePage * pageSize, (safePage + 1) * pageSize).map((item) => ({ label: item.name.slice(0, 100), value: item.id, description: `1 craft = ${item.produces || 1} produs(e)`.slice(0, 100) }));
  const rows: any[] = [{ type: 1, components: [{ type: 3, custom_id: `panel:calculator:${kind}:item:${calculatorId(category.id)}:${safePage}`, placeholder: `${category.label} · alege articolul`, min_values: 1, max_values: 1, options }] }];
  if (kind === 'illegal' && category.id === 'ciuperci') {
    rows.push({ type: 1, components: [{ type: 2, style: 1, label: 'Calculează după material disponibil', custom_id: 'panel:calculator:illegal:mushroom_mode' }] });
  }
  const navigation: any[] = [{ type: 2, style: 2, label: 'Categorii', custom_id: `panel:calculator:${kind}:categories` }];
  if (safePage > 0) navigation.push({ type: 2, style: 2, label: '‹ Înapoi', custom_id: `panel:calculator:${kind}:page:${calculatorId(category.id)}:${safePage - 1}` });
  if (safePage < pageCount - 1) navigation.push({ type: 2, style: 2, label: 'Înainte ›', custom_id: `panel:calculator:${kind}:page:${calculatorId(category.id)}:${safePage + 1}` });
  rows.push({ type: 1, components: navigation });
  return rows;
};
const mushroomAvailableMaterials = [
  { id: 'amanita_rosie', label: 'Amanita roșie', recipeId: 'red_fire_x3', material: 'Amanita roșie' },
  { id: 'oyster_rosu', label: 'Oyster roșu', recipeId: 'red_fire_x3', material: 'Oyster roșu' },
  { id: 'pink_light', label: 'Pink Light', recipeId: 'red_fire_x3', material: 'Pink Light' },
  { id: 'amanita_verde', label: 'Amanita verde', recipeId: 'green_haze', material: 'Amanita verde' },
  { id: 'oyster_galben', label: 'Oyster galben', recipeId: 'green_haze', material: 'Oyster galben' },
  { id: 'blue_light', label: 'Blue Light', recipeId: 'green_haze', material: 'Blue Light' },
  { id: 'psilocybe', label: 'Psilocybe', recipeId: 'blue_current_x3', material: 'Psilocybe' },
  { id: 'oyster_albastru', label: 'Oyster albastru', recipeId: 'blue_current_x3', material: 'Oyster albastru' },
  { id: 'purple_light', label: 'Purple Light', recipeId: 'blue_current_x3', material: 'Purple Light' },
];
const mushroomMaterialRows = () => [{ type: 1, components: [{ type: 3, custom_id: 'panel:calculator:illegal:mushroom_material', placeholder: 'Alege materialul disponibil', min_values: 1, max_values: 1, options: mushroomAvailableMaterials.map((item) => ({ label: item.label, value: item.id, description: `Calculează ${item.recipeId === 'red_fire_x3' ? 'Red Fire' : item.recipeId === 'green_haze' ? 'Green Haze' : 'Blue Current'} x3`.slice(0, 100) })) }] }, { type: 1, components: [{ type: 2, style: 2, label: 'Înapoi la articole', custom_id: 'panel:calculator:illegal:page:ciuperci:0' }] }];
const calculatorStartMessage = (kind: 'legal' | 'illegal') => interactionMessage('', { embeds: [{ title: kind === 'legal' ? '🧮 Calculator legal' : '🚨 Calculator ilegal', description: 'Selectează întâi categoria. După articol poți introduce cantitatea dorită, iar rezultatul va apărea doar pentru tine.', color: kind === 'legal' ? 0x22c55e : 0xef4444, footer: { text: 'Panel Pro · calcul interactiv Discord' } }], components: calculatorRows(kind) });
const calculatorQuantityModal = (kind: 'legal' | 'illegal', categoryId: string, recipeId: string) => ({ type: 9, data: { custom_id: `panel:calculator:${kind}:quantity:${calculatorId(categoryId)}:${calculatorId(recipeId)}`, title: 'Cantitate de calculat', components: [{ type: 1, components: [{ type: 4, custom_id: 'quantity', label: 'Cantitate dorită', style: 1, required: true, value: '1', placeholder: 'Ex: 10', min_length: 1, max_length: 8 }] }] } });
const calculatorResourceQuantityModal = (categoryId: string, recipeId: string) => ({ type: 9, data: { custom_id: `panel:calculator:illegal:resource_quantity:${calculatorId(categoryId)}:${calculatorId(recipeId)}`, title: 'Material disponibil', components: [{ type: 1, components: [{ type: 4, custom_id: 'quantity', label: 'Cantitatea disponibilă', style: 1, required: true, value: '1', placeholder: 'Ex: 1000', min_length: 1, max_length: 8 }] }] } });
const calculatorAvailableQuantityModal = (materialId: string) => ({ type: 9, data: { custom_id: `panel:calculator:illegal:quantity_available:${materialId}`, title: 'Material disponibil', components: [{ type: 1, components: [{ type: 4, custom_id: 'quantity', label: 'Cantitatea materialului disponibil', style: 1, required: true, value: '1', placeholder: 'Ex: 3', min_length: 1, max_length: 8 }] }] } });
const calculatorResultMessage = (kind: 'legal' | 'illegal', categoryId: string, recipeId: string, quantity: number) => {
  const item = findRecipe(kind, categoryId, recipeId);
  if (!item) return interactionMessage('Articolul selectat nu mai există în calculator.');
  const result = calculateRecipe(item, quantity, allCategories(kind));
  const list = (values: Record<string, number>) => Object.entries(values).filter(([, amount]) => amount > 0).map(([name, amount]) => `• ${name}: **${amount}**`).join('\n') || '—';
  const embed = { title: `${kind === 'legal' ? '🧮' : '🚨'} Rezultat calculator · ${item.name}`, description: `Ai ales **${quantity}** bucăți. Sunt necesare **${result.crafts}** craft-uri pentru rețeta selectată.`, color: kind === 'legal' ? 0x22c55e : 0xef4444, fields: [{ name: 'Materiale necesare', value: list(result.direct).slice(0, 1024), inline: false }], footer: { text: 'Panel Pro · rezultatul este vizibil doar pentru tine' } };
  return interactionMessage('', { embeds: [embed], components: [{ type: 1, components: [{ type: 2, style: 1, label: 'Schimbă articolul', custom_id: `panel:calculator:${kind}:categories` }, { type: 2, style: 2, label: 'Schimbă cantitatea', custom_id: `panel:calculator:${kind}:quantity_again:${calculatorId(categoryId)}:${calculatorId(recipeId)}` }] }] });
};
const calculatorResourceResultMessage = (categoryId: string, recipeId: string, available: number) => {
  const format = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1);
  const list = (values: Record<string, number>) => Object.entries(values).map(([name, amount]) => `• ${name}: **${format(amount)}**`).join('\n');
  if (categoryId === 'plicuri') {
    const factor = recipeId === 'plicuri_frunze' ? available / 1000 : ['plicuri_tavi', 'plicuri_ape', 'plicuri_brichete'].includes(recipeId) ? available / 50 : available / 100;
    const direct = { Frunze: factor * 1000, 'Tăvi': factor * 50, 'Ape (Sticle)': factor * 50, Brichete: factor * 50, 'Plicuri goale': factor * 100, 'Plicuri făcute': factor * 100 };
    const weight = direct.Frunze * 0.04 + direct['Tăvi'] * 0.3 + direct['Ape (Sticle)'] * 0.4 + direct.Brichete * 0.2 + direct['Plicuri goale'] * 0.03;
    const profit = Math.round(direct['Plicuri făcute']) * 13600;
    return interactionMessage('', { embeds: [{ title: '🚨 Rezultat calculator · Plicuri Cocaină', description: `Ai introdus **${format(available)}** × **${findRecipe('illegal', categoryId, recipeId)?.name || 'material'}**.`, color: 0xef4444, fields: [{ name: 'Necesar / rezultat', value: list(direct).slice(0, 1024), inline: false }, { name: 'Greutate totală', value: `${format(weight)} kg`, inline: true }, { name: 'Profit estimat', value: `${profit.toLocaleString('ro-RO')} $`, inline: true }], footer: { text: 'Panel Pro · rezultatul este vizibil doar pentru tine' } }], components: [{ type: 1, components: [{ type: 2, style: 1, label: 'Schimbă materialul', custom_id: 'panel:calculator:illegal:categories' }] }] });
  }
  const factor = recipeId === 'marijuana_frunze' ? available / 20 : available;
  const direct = { Frunze: factor * 20, Foițe: factor, 'Joint-uri': factor };
  const weight = direct.Frunze * 0.04 + direct.Foițe * 0.01;
  return interactionMessage('', { embeds: [{ title: '🚨 Rezultat calculator · Marijuana', description: `Ai introdus **${format(available)}** × **${findRecipe('illegal', categoryId, recipeId)?.name || 'material'}**.`, color: 0xef4444, fields: [{ name: 'Necesar / rezultat', value: list(direct), inline: false }, { name: 'Greutate totală', value: `${format(weight)} kg`, inline: true }], footer: { text: 'Panel Pro · rezultatul este vizibil doar pentru tine' } }], components: [{ type: 1, components: [{ type: 2, style: 1, label: 'Schimbă materialul', custom_id: 'panel:calculator:illegal:categories' }] }] });
};
const calculatorAvailableResultMessage = (materialId: string, available: number) => {
  const selected = mushroomAvailableMaterials.find((item) => item.id === materialId);
  const item = selected ? findRecipe('illegal', 'ciuperci', selected.recipeId) : null;
  const neededPerCraft = item && selected ? Number(item.base[selected.material] || 0) : 0;
  const crafts = neededPerCraft > 0 ? Math.floor(available / neededPerCraft) : 0;
  const quantity = crafts * Number(item?.produces || 1);
  const result = item ? calculateRecipe(item, quantity, allCategories('illegal')) : null;
  if (!item || !result) return interactionMessage('Materialul selectat nu mai există în calculator.');
  const list = (values: Record<string, number>) => Object.entries(values).filter(([, amount]) => amount > 0).map(([name, amount]) => `• ${name}: **${amount}**`).join('\n') || '—';
  const surplus = available - crafts * neededPerCraft;
  const missing = neededPerCraft > 0 ? Math.max(0, neededPerCraft - surplus) : 0;
  const embed = { title: `🚨 Rezultat după material · ${item.name}`, description: `Ai **${available}** × **${selected?.material}**. Poți produce **${quantity}** plicuri (${crafts} loturi). Îți rămâne **${surplus}** × materialul selectat și îți mai trebuie **${missing}** pentru următorul lot.`, color: 0xef4444, fields: [{ name: 'Materiale necesare pentru producția posibilă', value: list(result.direct).slice(0, 1024), inline: false }], footer: { text: 'Panel Pro · rezultatul este vizibil doar pentru tine' } };
  return interactionMessage('', { embeds: [embed], components: [{ type: 1, components: [{ type: 2, style: 1, label: 'Schimbă materialul', custom_id: 'panel:calculator:illegal:mushroom_mode' }, { type: 2, style: 2, label: 'Calculează după cantitate', custom_id: `panel:calculator:illegal:quantity_again:ciuperci:${selected.recipeId}` }] }] });
};

const customModuleKey = (value: unknown) => /^custom_[a-z0-9_]{2,60}$/.test(String(value || '').trim()) ? String(value).trim() : '';
const customModuleActionId = (moduleKey: string, index: number, action: string) => `panel:custom:${moduleKey}:${index}:${String(action || 'none').replace(/[^a-z0-9_-]/gi, '_').slice(0, 32)}`;

async function loadCustomModule(db: any, moduleKey: string) {
  const key = customModuleKey(moduleKey);
  if (!key) return null;
  const { data, error } = await db.from('platform_module_templates').select('module_key,label,description,definition,enabled').eq('module_key', key).eq('enabled', true).maybeSingle();
  if (error) throw error;
  return data || null;
}

function customModulePayload(module: any) {
  const definition = module?.definition && typeof module.definition === 'object' ? module.definition : {};
  const buttons = Array.isArray(definition.buttons) ? definition.buttons.slice(0, 20) : [];
  const components: any[] = [];
  for (let index = 0; index < buttons.length && components.length < 4; index += 5) {
    components.push({ type: 1, components: buttons.slice(index, index + 5).map((button: any, offset: number) => ({
      type: 2,
      style: [1, 2, 3, 4].includes(Number(button?.style)) ? Number(button.style) : 1,
      label: String(button?.label || `Acțiune ${index + offset + 1}`).slice(0, 80),
      custom_id: customModuleActionId(String(module.module_key), index + offset, String(button?.action || 'open_form')),
    })) });
  }
  return { allowed_mentions: { parse: [] }, embeds: [{ title: String(definition.title || module?.label || 'Modul Panel Pro').slice(0, 256), description: String(definition.description || module?.description || 'Folosește butoanele de mai jos.').slice(0, 4096), color: Number(definition.color || 0x5865f2), fields: Array.isArray(definition.fields) ? definition.fields.slice(0, 25) : [], footer: { text: String(definition.footer || 'Panel Pro · modul custom').slice(0, 2048) } }], components };
}

async function customPresencePayload(db: any, module: any, context: any) {
  const { data: shifts, error } = await db.from('shifts').select('discord_id,colleague_name,status,started_at,duration_ms,paused_seconds,paused_at,shift_type').eq('organization_id', context.organization.id).in('status', ['active', 'paused']).is('end_time', null).order('started_at', { ascending: true });
  if (error) throw error;
  const rows = Array.isArray(shifts) ? shifts : [];
  const ids = [...new Set(rows.map((shift: any) => String(shift.discord_id || '')).filter(Boolean))];
  const { data: users } = ids.length ? await db.from('users').select('discord_id,display_name,username').in('discord_id', ids) : { data: [] };
  const names = new Map((users || []).map((user: any) => [String(user.discord_id), user.display_name || user.username || user.discord_id]));
  const now = new Date();
  const line = (shift: any, icon: string) => `${icon} **${String(shift.colleague_name || names.get(String(shift.discord_id)) || 'Utilizator').slice(0, 120)}** — ${formatDuration(workedSeconds(shift, now))}`;
  const active = rows.filter((shift: any) => String(shift.status) !== 'paused');
  const paused = rows.filter((shift: any) => String(shift.status) === 'paused');
  const section = (title: string, items: any[], icon: string) => `${title} (${items.length})\n${items.length ? items.map((shift) => line(shift, icon)).join('\n') : '_Nimeni_'}`;
  const definition = module?.definition && typeof module.definition === 'object' ? module.definition : {};
  const payload = customModulePayload(module);
  payload.embeds = [{ title: String(definition.title || `📡 Prezență live · ${context.organization.name || 'Organizație'}`).slice(0, 256), description: `${section('🟢 Prezenți', active, '🟢')}\n\n${section('☕ În pauză', paused, '☕')}\n\n📊 **Total:** ${rows.length}\n⏱️ **Actualizat:** <t:${Math.floor(now.getTime() / 1000)}:R>`, color: Number(definition.color || 0x22c55e), timestamp: now.toISOString(), footer: { text: String(definition.footer || 'Panel Pro - By Little Mario').slice(0, 2048) } }];
  return payload;
}

const standardPresenceEventModule = () => ({ module_key: 'presence_events', label: 'Evenimente cu prezență', definition: { handler: 'prezenta_eveniment', title: '🟢 Eveniment cu prezență', color: 0x22c55e, footer: PANEL_FOOTER } });
const standardPresenceEventModal = () => ({ type: 9, data: { custom_id: 'panel:presence_events:submit', title: 'Creează eveniment', components: [
  { type: 1, components: [universalTextInput('event_type', 'Tipul evenimentului', 1, true, 'Ex: Patrulă', 80)] },
  { type: 1, components: [universalTextInput('details', 'Detalii', 2, false, 'Ora, locul și instrucțiunile', 1200)] },
] } });

async function loadPresenceEvent(db: any, context: any, moduleKey: string, status = 'active') {
  const { data, error } = await db.from('platform_presence_events').select('*').eq('organization_id', context.organization.id).eq('guild_id', context.guildId).eq('module_key', moduleKey).eq('status', status).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function presenceEventPayload(db: any, module: any, context: any, event: any = null) {
  const payload = customModulePayload(module);
  const definition = module?.definition && typeof module.definition === 'object' ? module.definition : {};
  if (String(module?.module_key || '') === 'presence_events') payload.components = event?.status === 'active'
    ? [{ type: 1, components: [{ type: 2, style: 3, label: '✅ Sunt prezent', custom_id: 'panel:presence_events:present' }, { type: 2, style: 2, label: '↩️ Anulează prezența', custom_id: 'panel:presence_events:cancel' }, { type: 2, style: 4, label: '🔒 Închide evenimentul', custom_id: 'panel:presence_events:close' }] }]
    : event ? [] : [{ type: 1, components: [{ type: 2, style: 1, label: '➕ Creează eveniment', custom_id: 'panel:presence_events:create' }] }];
  if (!event) {
    payload.embeds = [{ title: String(definition.title || '🟢 Prezență la eveniment').slice(0, 256), description: 'Nu există momentan un eveniment activ. Apasă **Creează eveniment** pentru a publica unul.', color: Number(definition.color || 0x22c55e), footer: { text: String(definition.footer || 'Panel Pro - By Little Mario').slice(0, 2048) } }];
    return payload;
  }
  const { data: attendees, error } = await db.from('platform_presence_attendees').select('discord_id,display_name,joined_at').eq('event_id', event.id).order('joined_at', { ascending: true });
  if (error) throw error;
  const rows = Array.isArray(attendees) ? attendees : [];
  const names = rows.length ? rows.map((attendee: any, index: number) => `${index + 1}. **${String(attendee.display_name || attendee.discord_id || 'Membru').slice(0, 120)}**`).join('\n') : '_Nimeni nu s-a înscris încă._';
  const isPresenceEventModule = String(module?.module_key || '') === 'presence_events' || String(definition.handler || '').toLowerCase() === 'prezenta_eveniment';
  const eventTitle = isPresenceEventModule ? String(event.event_type || event.title || 'Activitate') : String(definition.title || `🟢 ${event.title}`);
  payload.embeds = [{ title: eventTitle.slice(0, 256), description: String(event.details || 'Fără detalii.').slice(0, 4096), color: Number(definition.color || 0x22c55e), fields: [{ name: 'Tip', value: String(event.event_type || 'Activitate').slice(0, 1024), inline: true }, { name: 'Creat de', value: `<@${String(event.created_by_discord_id || '')}>`, inline: true }, { name: `✅ Prezenți (${rows.length})`, value: names.slice(0, 1024), inline: false }], timestamp: new Date().toISOString(), footer: { text: String(definition.footer || 'Panel Pro - By Little Mario').slice(0, 2048) } }];
  return payload;
}

async function updatePresenceEventEmbed(db: any, module: any, context: any, event: any = null) {
  if (String(module?.module_key || '') === 'presence_events') return publishPresenceEventLogEmbed(db, module, context, event);
  if (!context.publication.message_id) throw new Error('Embedul de prezență nu are încă un mesaj publicat.');
  const payload = await presenceEventPayload(db, module, context, event);
  const response = await requestDiscordTarget(db, { target: context.target, transport: 'bot', channel_id: context.publication.embed_channel_id }, JSON.stringify(payload), { method: 'PATCH', messageId: String(context.publication.message_id) });
  if (!response.ok) throw new Error(`Embedul de prezență nu a putut fi actualizat (HTTP ${response.status}).`);
  return payload;
}

async function publishPresenceEventLogEmbed(db: any, module: any, context: any, event: any) {
  const channelId = String(context.publication.result_channel_id || '').trim();
  if (!channelId) throw new Error('Selectează canalul de log pentru embedul evenimentului cu prezență.');
  const payload = await presenceEventPayload(db, module, context, event);
  // The log is a single persistent message. When an older event has no
  // stored log_message_id yet, a button interaction from that log still gives
  // us the exact message to edit.
  let messageId = String(event?.log_message_id || '').trim();
  if (!messageId && String(context.channelId || '') === channelId) messageId = String(context.publication.message_id || '').trim();
  let response = messageId
    ? await requestDiscordTarget(db, { target: context.target, transport: 'bot', channel_id: channelId }, JSON.stringify(payload), { method: 'PATCH', messageId })
    : await requestDiscordTarget(db, { target: context.target, transport: 'bot', channel_id: channelId }, JSON.stringify(payload), { method: 'POST' });
  // Recreate only when Discord confirms that the old message was deleted.
  // Other errors must not create a duplicate log embed.
  if (!response.ok && messageId && response.status === 404) {
    response = await requestDiscordTarget(db, { target: context.target, transport: 'bot', channel_id: channelId }, JSON.stringify(payload), { method: 'POST' });
    messageId = '';
  }
  if (!response.ok) throw new Error(`Embedul live din canalul de log nu a putut fi actualizat (HTTP ${response.status}).`);
  const sent = await response.json().catch(() => ({}));
  messageId = String(sent?.id || messageId || '').trim();
  if (event?.id && messageId) await db.from('platform_presence_events').update({ log_message_id: messageId, updated_at: new Date().toISOString() }).eq('id', event.id);
  return payload;
}

async function sendPresenceEventLog(db: any, context: any, embed: any, messageKey: string) {
  const channelId = String(context.publication.result_channel_id || '').trim();
  if (!channelId) return null;
  const payload = { allowed_mentions: { parse: [] }, embeds: [{ ...embed, footer: { text: 'Panel Pro - Log prezență' }, timestamp: new Date().toISOString() }] };
  const response = await requestDiscordTarget(db, { target: context.target, transport: 'bot', channel_id: channelId }, JSON.stringify(payload), { method: 'POST' });
  if (!response.ok) throw new Error(`Logul evenimentului nu a putut fi trimis (HTTP ${response.status}).`);
  return response.json().catch(() => ({}));
}

async function createPresenceEvent(db: any, context: any, module: any, values: Record<string, string>) {
  const eventType = String(values.event_type || '').trim();
  const title = eventType || 'Activitate';
  const details = String(values.details || '').trim();
  if (eventType.length < 2) throw new Error('Completează tipul evenimentului.');
  const current = await loadPresenceEvent(db, context, module.module_key);
  if (current) await db.from('platform_presence_events').update({ status: 'closed', closed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', current.id).eq('status', 'active');
  const { data: event, error } = await db.from('platform_presence_events').insert({ organization_id: context.organization.id, guild_id: context.guildId, module_key: module.module_key, title: title.slice(0, 160), event_type: eventType.slice(0, 80), details: details.slice(0, 4000) || null, created_by_discord_id: context.discordId, embed_message_id: context.publication.message_id || null }).select('*').single();
  if (error) throw error;
  await updatePresenceEventEmbed(db, module, context, event);
  return interactionMessage('Evenimentul a fost creat, embedul a fost actualizat și evenimentul a fost salvat în istoric.');
}

async function handlePresenceEventAction(db: any, context: any, module: any, action: string, interaction: any) {
  const event = await loadPresenceEvent(db, context, module.module_key);
  if (action === 'create_event') return null;
  if (!event) return interactionMessage('Nu există niciun eveniment activ. Creează mai întâi un eveniment.');
  if (action === 'close_event') {
    if (!isDiscordManager(interaction) && !(await isPlatformAdminAccount(db, context.discordId))) throw new Error('Doar un administrator poate închide evenimentul.');
    const { data: closed, error } = await db.from('platform_presence_events').update({ status: 'closed', closed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', event.id).eq('status', 'active').select('*').single();
    if (error) throw error;
    await updatePresenceEventEmbed(db, module, context, closed);
    return interactionMessage(`Evenimentul „${closed.title}” a fost închis. Participanții au rămas în istoric.`);
  }
  if (action === 'cancel') {
    const { data: existingAttendance, error: existingError } = await db.from('platform_presence_attendees').select('event_id').eq('event_id', event.id).eq('discord_id', context.discordId).maybeSingle();
    if (existingError) throw existingError;
    if (!existingAttendance) return interactionMessage('Nu ești prezent la acest eveniment, deci nu există nimic de anulat.');
    const { error: cancelError } = await db.from('platform_presence_attendees').delete().eq('event_id', event.id).eq('discord_id', context.discordId);
    if (cancelError) throw cancelError;
    await updatePresenceEventEmbed(db, module, context, event);
    return interactionMessage('Prezența ta a fost anulată, iar lista din embed a fost actualizată.');
  }
  if (action !== 'present') return interactionMessage('Acțiunea de prezență nu este disponibilă.');
  const { data: existingAttendance, error: existingError } = await db.from('platform_presence_attendees').select('event_id').eq('event_id', event.id).eq('discord_id', context.discordId).maybeSingle();
  if (existingError) throw existingError;
  const { error: attendanceError } = await db.from('platform_presence_attendees').upsert({ event_id: event.id, organization_id: context.organization.id, discord_id: context.discordId, display_name: context.displayName, joined_at: new Date().toISOString() }, { onConflict: 'event_id,discord_id' });
  if (attendanceError) throw attendanceError;
  await updatePresenceEventEmbed(db, module, context, event);
  if (!existingAttendance && String(module?.module_key || '') !== 'presence_events') await sendPresenceEventLog(db, context, { title: `✅ Prezență înregistrată · ${event.title}`, description: `**${context.displayName}** a confirmat prezența.`, color: 0x3b82f6 }, `presence-event-${event.id}-attendee-${context.discordId}`);
  return interactionMessage(existingAttendance ? 'Prezența ta era deja înregistrată. Embedul a fost actualizat.' : 'Prezența ta a fost salvată și embedul a fost actualizat.');
}

const taskUserId = (value: unknown) => String(value || '').trim().replace(/^<@!?([0-9]{15,22})>$/, '$1');
const taskDeadlineLabel = (value: unknown) => {
  const date = new Date(String(value || ''));
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', dateStyle: 'full', timeStyle: 'short' }).format(date) : String(value || 'termen necunoscut');
};
const taskDeadlineInput = () => {
  const parts = new Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`;
};
const taskModal = (draftId = '') => ({ type: 9, data: { custom_id: `panel:tasks:submit:${draftId}`, title: 'Creează task', components: [
  { type: 1, components: [universalTextInput('title', 'Task', 2, true, 'Scrie taskul și instrucțiunile pentru angajat', 4000)] },
  { type: 1, components: [universalTextInput('due_at', 'Termen-limită', 1, true, 'zz/ll/yyyy HH:mm', 16, taskDeadlineInput())] },
] } });

const taskEmbed = (task: any, includeButtons = true) => {
  const statusLabels: Record<string, string> = { pending: '⏳ În așteptarea răspunsului', accepted: '✅ Acceptat', refused: '❌ Refuzat', expired: '⌛ Expirat', cancelled: '🚫 Anulat' };
  const components = includeButtons && task.status === 'pending' ? [{ type: 1, components: [
    { type: 2, style: 3, label: '✅ Acceptă taskul', custom_id: `panel:tasks:accept:${task.id}` },
    { type: 2, style: 4, label: '❌ Refuză taskul', custom_id: `panel:tasks:refuse:${task.id}` },
  ] }] : [];
  return { allowed_mentions: { parse: [] }, embeds: [{ title: '📋 Task', description: String(task.description || task.title || 'Fără detalii.').slice(0, 4096), color: task.status === 'accepted' ? 0x22c55e : task.status === 'refused' ? 0xef4444 : 0xf59e0b, fields: [
    { name: '👤 Angajat', value: `<@${String(task.assignee_discord_id || '')}>`, inline: true },
    { name: '📅 Termen-limită', value: taskDeadlineLabel(task.due_at), inline: true },
    { name: '📌 Status', value: statusLabels[String(task.status || 'pending')] || String(task.status || 'pending'), inline: false },
    ...(task.response_note ? [{ name: '💬 Răspuns', value: String(task.response_note).slice(0, 1024), inline: false }] : []),
  ], timestamp: new Date().toISOString(), footer: { text: PANEL_FOOTER } }], components };
};

const taskGroupEmbed = (tasks: any[]) => {
  const rows = (tasks || []).map((task) => `• <@${String(task.assignee_discord_id || '')}> — ${String(task.status || 'pending') === 'accepted' ? '✅ Acceptat' : String(task.status || 'pending') === 'refused' ? '❌ Refuzat' : '⏳ În așteptare'}`).join('\n') || 'Nu există răspunsuri.';
  const first = tasks?.[0] || {};
  return { allowed_mentions: { parse: [] }, embeds: [{ title: '📋 Task', description: String(first.description || first.title || 'Fără detalii.').slice(0, 4096), color: tasks?.some((task) => task.status === 'refused') ? 0xef4444 : tasks?.every((task) => task.status === 'accepted') ? 0x22c55e : 0xf59e0b, fields: [
    { name: '👥 Destinatari și răspunsuri', value: rows.slice(0, 1024), inline: false },
    { name: '📅 Termen-limită', value: taskDeadlineLabel(first.due_at), inline: true },
    { name: '📌 Progres', value: `${tasks.filter((task) => task.status !== 'pending').length}/${tasks.length} răspunsuri`, inline: true },
  ], timestamp: new Date().toISOString(), footer: { text: PANEL_FOOTER } }] };
};

const taskDecisionEmbed = (task: any) => {
  const accepted = String(task.status || '') === 'accepted';
  return { allowed_mentions: { parse: [] }, embeds: [{ title: `${accepted ? '✅' : '❌'} Task ${accepted ? 'acceptat' : 'refuzat'}`, color: accepted ? 0x22c55e : 0xef4444, fields: [
    { name: '📋 Task', value: String(task.description || task.title || 'Task').slice(0, 1024), inline: false },
    { name: '👤 Angajat', value: `<@${String(task.assignee_discord_id || '')}>`, inline: true },
    { name: '📅 Termen-limită', value: taskDeadlineLabel(task.due_at), inline: true },
    { name: '💬 Răspuns', value: accepted ? 'Taskul a fost acceptat.' : 'Taskul a fost refuzat.', inline: false },
  ], timestamp: new Date().toISOString(), footer: { text: PANEL_FOOTER } }] };
};

async function sendTaskPrivateMessage(db: any, task: any) {
  const token = await getPlatformSecret(db, 'discord_bot_token');
  if (!token) throw new Error('Tokenul botului Discord nu este configurat.');
  const headers = { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };
  const channelResponse = await fetch(`${DISCORD_API}/users/@me/channels`, { method: 'POST', headers, body: JSON.stringify({ recipient_id: String(task.assignee_discord_id) }) });
  const channel = await channelResponse.json().catch(() => ({}));
  if (!channelResponse.ok || !channel?.id) throw new Error('Nu am putut deschide mesajul privat pentru angajat. Verifică dacă permite DM-uri de la server.');
  const messageResponse = await fetch(`${DISCORD_API}/channels/${channel.id}/messages`, { method: 'POST', headers, body: JSON.stringify(taskEmbed(task, true)) });
  const message = await messageResponse.json().catch(() => ({}));
  if (!messageResponse.ok || !message?.id) throw new Error('Taskul a fost salvat, dar mesajul privat nu a putut fi trimis.');
  return { channelId: String(channel.id), messageId: String(message.id) };
}

async function updateTaskPrivateMessage(db: any, task: any) {
  if (!task.dm_channel_id || !task.dm_message_id) return;
  const token = await getPlatformSecret(db, 'discord_bot_token');
  if (!token) return;
  const response = await fetch(`${DISCORD_API}/channels/${task.dm_channel_id}/messages/${task.dm_message_id}`, { method: 'PATCH', headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(taskEmbed(task, false)) });
  if (!response.ok) console.warn('[discord-interactions] task DM could not be updated', response.status);
}

async function publishTaskLog(db: any, context: any, tasks: any[], messageId = '') {
  const payload = taskDecisionEmbed(tasks[0] || {});
  let settings = context.settings?.discord_channel_routes ? context.settings : null;
  if (!settings && context.organizationId) {
    const { data: freshSettings, error } = await db.from('organization_settings').select('discord_channel_routes').eq('organization_id', context.organizationId).maybeSingle();
    if (error) throw error;
    settings = freshSettings || {};
  }
  const configuredRoutes = settings?.discord_channel_routes && typeof settings.discord_channel_routes === 'object'
    ? settings.discord_channel_routes
    : {};
  const guildId = String(context.guildId || '').trim();
  const preferredTarget = String(context.target || 'primary') === 'secondary' ? 'secondary' : 'primary';
  const otherTarget = preferredTarget === 'primary' ? 'secondary' : 'primary';
  const targetForRoute = (routeKey: string) => {
    const route = configuredRoutes?.[routeKey] || {};
    const exactGuildTarget = [preferredTarget, otherTarget].find((target) => {
      const item = route?.[target];
      return item?.enabled !== false && validDiscordChannelId(item?.channel_id) && (!guildId || String(item?.guild_id || '') === guildId);
    });
    if (exactGuildTarget) return exactGuildTarget;
    return [preferredTarget, otherTarget].find((target) => {
      const item = route?.[target];
      return item?.enabled !== false && validDiscordChannelId(item?.channel_id);
    }) || '';
  };
  const logTarget = targetForRoute('log_tasks');
  const fallbackTarget = targetForRoute('tasks');
  const selectedRouteKey = logTarget ? 'log_tasks' : fallbackTarget ? 'tasks' : '';
  const selectedTarget = logTarget || fallbackTarget;
  if (!selectedRouteKey || !selectedTarget) {
    throw new Error('Canalul selectat pentru log task-uri nu este disponibil în configurația organizației. Salvează din nou canalul în organizatii.html.');
  }
  const selectedRoute = configuredRoutes?.[selectedRouteKey]?.[selectedTarget];
  const deliverySettings = { discord_channel_routes: { [selectedRouteKey]: { primary: selectedTarget === 'primary' ? selectedRoute : null, secondary: selectedTarget === 'secondary' ? selectedRoute : null } } };
  const delivery = await deliverDiscordRoute(db, deliverySettings, selectedRouteKey, JSON.stringify(payload), {
    postOnly: true,
    organizationId: String(context.organizationId || ''),
    messageKey: `task-decision-${String(tasks[0]?.id || crypto.randomUUID())}`,
    retryPayload: payload,
  });
  const result = (delivery.results || [])[0];
  if (!result?.id) throw new Error(delivery.failures?.join(' | ') || 'Logul taskului nu a putut fi trimis.');
  return String(result.id);
}

async function createTask(db: any, context: any, values: Record<string, string>) {
  const assignees = [...new Set(String(values.assignee || '').split(/[\s,;\n]+/).map(taskUserId).filter((value) => /^\d{15,22}$/.test(value)))];
  const title = String(values.title || '').trim();
  const dueRaw = String(values.due_at || '').trim();
  const romanianDate = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/.exec(dueRaw);
  const dueAt = romanianDate
    ? zonedDateAt(Number(romanianDate[3]), Number(romanianDate[2]), Number(romanianDate[1]), Number(romanianDate[4]), Number(romanianDate[5]))
    : new Date(/Z$|[+-]\d{2}:?\d{2}$/.test(dueRaw) ? dueRaw : `${dueRaw.replace(' ', 'T')}:00+03:00`);
  if (!assignees.length) throw new Error('Introdu cel puțin un ID sau o mențiune validă pentru angajat.');
  if (title.length < 2) throw new Error('Titlul taskului este obligatoriu.');
  if (!Number.isFinite(dueAt.getTime()) || dueAt.getTime() <= Date.now()) throw new Error('Termenul-limită trebuie să fie o dată viitoare validă.');
  const taskGroupId = crypto.randomUUID();
  const { data: tasks, error } = await db.from('platform_tasks').insert(assignees.map((assignee) => ({ task_group_id: taskGroupId, organization_id: context.organization.id, guild_id: context.guildId, title: 'Task', description: title.slice(0, 4000), due_at: dueAt.toISOString(), assignee_discord_id: assignee, created_by_discord_id: context.discordId }))).select('*');
  if (error) throw error;
  const failures: string[] = [];
  for (const task of tasks || []) {
    try {
      const privateMessage = await sendTaskPrivateMessage(db, task);
      await db.from('platform_tasks').update({ dm_channel_id: privateMessage.channelId, dm_message_id: privateMessage.messageId, updated_at: new Date().toISOString() }).eq('id', task.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Mesajul privat nu a putut fi trimis.';
      failures.push(`<@${task.assignee_discord_id}>: ${message}`);
      await db.from('platform_tasks').update({ status: 'cancelled', response_note: message, updated_at: new Date().toISOString() }).eq('id', task.id);
    }
  }
  return interactionMessage(`Taskul a fost trimis prin DM către ${assignees.length} persoan${assignees.length === 1 ? 'ă' : 'e'}.${failures.length ? `\n⚠️ ${failures.join('\n')}` : ''}`);
}

async function handleTaskDmAction(db: any, interaction: any, action: string, taskId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(taskId)) return interactionMessage('Taskul nu este valid.');
  const { data: task, error } = await db.from('platform_tasks').select('*').eq('id', taskId).maybeSingle();
  if (error) throw error;
  if (!task) return interactionMessage('Taskul nu mai există.');
  const discordId = String(interaction.user?.id || '').trim();
  if (discordId !== String(task.assignee_discord_id)) return interactionMessage('Acest task nu îți aparține.');
  if (task.status !== 'pending') return interactionMessage(`Taskul are deja statusul: ${task.status}.`);
  if (new Date(task.due_at).getTime() <= Date.now()) {
    const { data: expired } = await db.from('platform_tasks').update({ status: 'expired', response_note: 'Termenul-limită a expirat.', updated_at: new Date().toISOString() }).eq('id', task.id).eq('status', 'pending').select('*').single();
    if (expired) return interactionMessage('Termenul-limită al taskului a expirat.');
  }
  const accepted = action === 'accept';
  const { data: updated, error: updateError } = await db.from('platform_tasks').update({ status: accepted ? 'accepted' : 'refused', accepted_at: accepted ? new Date().toISOString() : null, refused_at: accepted ? null : new Date().toISOString(), response_note: accepted ? 'Task acceptat de angajat.' : 'Task refuzat de angajat.', updated_at: new Date().toISOString() }).eq('id', task.id).eq('status', 'pending').select('*').single();
  if (updateError) throw updateError;
  if (!updated) return interactionMessage('Taskul a fost deja procesat.');
  await updateTaskPrivateMessage(db, updated);
  const logRoute = await db.from('organization_settings').select('discord_channel_routes').eq('organization_id', task.organization_id).maybeSingle();
  const guild = await db.from('organization_guilds').select('kind').eq('organization_id', task.organization_id).eq('guild_id', task.guild_id).maybeSingle();
  const context = { organizationId: String(task.organization_id), guildId: String(task.guild_id), target: String(guild.data?.kind || '') === 'secondary' ? 'secondary' : 'primary', settings: logRoute.data || {} };
  let logMessageId = '';
  let logFailure = '';
  try { logMessageId = await publishTaskLog(db, context, [updated]); }
  catch (error) {
    logFailure = error instanceof Error ? error.message : String(error || 'Eroare necunoscută la trimiterea logului.');
    console.error('[discord-interactions] task log delivery failed after response was saved', { error: logFailure, organizationId: task.organization_id, guildId: task.guild_id, taskId: task.id });
  }
  if (logMessageId) await db.from('platform_tasks').update({ log_message_id: logMessageId, updated_at: new Date().toISOString() }).eq('id', updated.id);
  if (logFailure) return interactionMessage(`${accepted ? 'Taskul a fost acceptat.' : 'Taskul a fost refuzat.'} Răspunsul a fost salvat, dar logul nu a putut fi trimis: ${logFailure.slice(0, 700)}`);
  return interactionMessage(accepted ? 'Taskul a fost acceptat și statusul a fost actualizat în log.' : 'Taskul a fost refuzat și statusul a fost actualizat în log.');
}

function customModuleModal(module: any, actionId: string) {
  const definition = module?.definition && typeof module.definition === 'object' ? module.definition : {};
  const fields = Array.isArray(definition.form_schema) ? definition.form_schema.slice(0, 5) : [];
  if (!fields.length) return null;
  const components = fields.map((field: any, index: number) => ({ type: 1, components: [{ type: 4, custom_id: String(field?.id || `field_${index + 1}`).replace(/[^a-z0-9_-]/gi, '_').slice(0, 100), label: String(field?.label || `Câmp ${index + 1}`).slice(0, 45), style: String(field?.type || '').toLowerCase() === 'long_text' ? 2 : 1, required: field?.required !== false, placeholder: String(field?.placeholder || '').slice(0, 100), max_length: Math.min(4000, Math.max(1, Number(field?.max_length) || (String(field?.type || '').toLowerCase() === 'long_text' ? 1000 : 200))) }] }));
  return { type: 9, data: { custom_id: `panel:custom:${module.module_key}:submit:${actionId}`, title: String(module.label || 'Modul Panel Pro').slice(0, 45), components } };
}

async function resolveCustomModulePublication(db: any, interaction: any, moduleKey: string) {
  const guildId = String(interaction.guild_id || '').trim();
  const channelId = String(interaction.channel_id || '').trim();
  const discordId = String(interaction.member?.user?.id || interaction.user?.id || '').trim();
  const { data: guild, error: guildError } = await db.from('organization_guilds').select('organization_id,kind').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
  if (guildError) throw guildError;
  if (!guild?.organization_id) throw new Error('Serverul Discord nu este asociat unei organizații Panel Pro.');
  const { data: organization, error: organizationError } = await db.from('organizations').select('id,name,active').eq('id', guild.organization_id).maybeSingle();
  if (organizationError) throw organizationError;
  await requireActiveOrganizationAccess(db, organization);
  const { data: settings, error: settingsError } = await db.from('organization_settings').select('discord_channel_routes').eq('organization_id', guild.organization_id).maybeSingle();
  if (settingsError) throw settingsError;
  const target = String(guild.kind || '') === 'secondary' ? 'secondary' : 'primary';
  const { data: publications, error: publicationError } = await db.from('platform_module_publications').select('*').eq('module_key', moduleKey).eq('organization_id', guild.organization_id).eq('status', 'published');
  if (publicationError) throw publicationError;
  const publication = (publications || []).find((item: any) => String(item.embed_channel_id || '') === channelId || String(item.result_channel_id || '') === channelId);
  const isEmbedChannel = publication && String(publication.embed_channel_id) === channelId;
  const isResultChannel = publication && publication.result_channel_id && String(publication.result_channel_id) === channelId;
  if (!publication || (!isEmbedChannel && !isResultChannel)) throw new Error('Acest canal nu este configurat pentru modulul Panel Pro.');
  const { data: member, error: memberError } = await db.from('organization_members').select('active,panel_role,permission_level').eq('organization_id', guild.organization_id).eq('discord_id', discordId).eq('active', true).maybeSingle();
  if (memberError) throw memberError;
  if (!member && !isDiscordManager(interaction) && !(await isPlatformAdminAccount(db, discordId))) throw new Error('Nu ai acces la acest modul în organizație.');
  const displayName = String(interaction.member?.nick || interaction.member?.user?.global_name || interaction.member?.user?.username || discordId).slice(0, 120);
  return { guildId, channelId, target, discordId, displayName, organization, settings, publication };
}

function customModuleEmbed(module: any, context: any, values: Record<string, string>, status = 'submitted') {
  const definition = module?.definition && typeof module.definition === 'object' ? module.definition : {};
  const schema = Array.isArray(definition.form_schema) ? definition.form_schema : [];
  const fields = schema.map((field: any) => ({ name: String(field?.label || field?.id || 'Câmp').slice(0, 256), value: String(values[String(field?.id || '')] || '—').slice(0, 1024), inline: String(field?.type || '').toLowerCase() !== 'long_text' })).slice(0, 25);
  return { title: `${status === 'approved' ? '✅' : status === 'rejected' ? '❌' : '📨'} ${String(module.label || 'Modul Panel Pro').slice(0, 240)}`, description: `Trimis de **${context.displayName}**.`, color: status === 'approved' ? 0x22c55e : status === 'rejected' ? 0xef4444 : Number(definition.color || 0x5865f2), fields, footer: { text: String(definition.footer || 'Panel Pro · rezultat modul').slice(0, 2048) }, timestamp: new Date().toISOString() };
}

function assertCustomModulePermission(interaction: any, module: any, mode = 'use', publication: any = null) {
  if (isDiscordManager(interaction)) return;
  const definition = module?.definition && typeof module.definition === 'object' ? module.definition : {};
  const publicationPermissions = publication?.permissions && typeof publication.permissions === 'object' ? publication.permissions : {};
  const modulePermissions = definition.permissions && typeof definition.permissions === 'object' ? definition.permissions : {};
  const permissions = publicationPermissions && (Array.isArray(publicationPermissions.allowed_role_ids) || Array.isArray(publicationPermissions.approval_role_ids)) ? publicationPermissions : modulePermissions;
  const configured = mode === 'approve' ? permissions.approval_role_ids : permissions.allowed_role_ids;
  const roleIds = Array.isArray(interaction.member?.roles) ? interaction.member.roles.map(String) : [];
  if (mode === 'approve' && (!Array.isArray(configured) || !configured.length)) throw new Error('Doar ownerul sau administratorii pot aproba această cerere.');
  if (Array.isArray(configured) && configured.length && !configured.map(String).some((roleId: string) => roleIds.includes(roleId))) throw new Error(mode === 'approve' ? 'Nu ai rolul necesar pentru aprobare.' : 'Nu ai rolul necesar pentru acest modul.');
}

async function notifyCustomModuleUser(db: any, discordId: string, content: string) {
  const botToken = await getPlatformSecret(db, 'discord_bot_token');
  if (!botToken || !/^\d{15,22}$/.test(String(discordId || ''))) return false;
  const headers = { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' };
  const channelResponse = await fetch(`${DISCORD_API}/users/@me/channels`, { method: 'POST', headers, body: JSON.stringify({ recipient_id: String(discordId) }) });
  const channel = await channelResponse.json().catch(() => ({}));
  if (!channelResponse.ok || !channel?.id) return false;
  const messageResponse = await fetch(`${DISCORD_API}/channels/${channel.id}/messages`, { method: 'POST', headers, body: JSON.stringify({ allowed_mentions: { parse: [] }, content: String(content || '').slice(0, 2000) }) });
  return messageResponse.ok;
}

async function applyCustomDecision(db: any, interaction: any, module: any, context: any, submissionId: string, status: 'approved' | 'rejected') {
  const { data: submission, error: submissionError } = await db.from('platform_module_submissions').select('id,values,discord_id,result_message_id,status').eq('id', submissionId).eq('organization_id', context.organization.id).eq('module_key', module.module_key).maybeSingle();
  if (submissionError) throw submissionError;
  if (!submission) throw new Error('Cererea nu mai există.');
  const { error: updateError } = await db.from('platform_module_submissions').update({ status, reviewed_by_discord_id: context.discordId, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', submissionId).eq('status', 'submitted');
  if (updateError) throw updateError;
  if (context.publication.result_channel_id && submission.result_message_id) await requestDiscordTarget(db, { target: context.target, transport: 'bot', channel_id: context.publication.result_channel_id }, JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [customModuleEmbed(module, context, submission.values || {}, status)], components: [] }), { method: 'PATCH', messageId: String(submission.result_message_id) });
  await db.from('platform_module_events').insert({ module_key: module.module_key, organization_id: context.organization.id, guild_id: context.guildId, discord_id: context.discordId, event_type: `submission_${status}`, payload: { submission_id: submissionId } });
  const actions = module.definition?.workflow?.actions || module.definition?.actions || [];
  if (Array.isArray(actions) && actions.includes('notify_submitter')) await notifyCustomModuleUser(db, String(submission.discord_id), status === 'approved' ? 'Cererea ta a fost aprobată.' : 'Cererea ta a fost respinsă.');
}

async function handleCustomModuleSubmit(db: any, context: any, module: any, values: Record<string, string>, submissionId = '') {
  const definition = module?.definition && typeof module.definition === 'object' ? module.definition : {};
  const actions = definition.workflow?.actions || definition.actions || [];
  const requiresReview = Array.isArray(actions) && actions.includes('review_buttons');
  const responses = definition.responses && typeof definition.responses === 'object' ? definition.responses : {};
  const limits = definition.limits && typeof definition.limits === 'object' ? definition.limits : {};
  const cooldownSeconds = Math.max(0, Math.min(86400, Number(limits.cooldown_seconds || 0)));
  const maxRequests = Math.max(0, Math.min(10000, Number(limits.max_requests || 0)));
  if (!submissionId && (cooldownSeconds > 0 || maxRequests > 0)) {
    const { data: rate } = await db.from('platform_module_rate_limits').select('window_started_at,request_count').eq('module_key', module.module_key).eq('organization_id', context.organization.id).eq('discord_id', context.discordId).maybeSingle();
    const started = Date.parse(String(rate?.window_started_at || ''));
    if (rate && Number.isFinite(started) && started + cooldownSeconds * 1000 > Date.now()) throw new Error(`Poți trimite din nou peste ${Math.ceil((started + cooldownSeconds * 1000 - Date.now()) / 1000)} secunde.`);
    const count = Number(rate?.request_count || 0);
    if (maxRequests > 0 && Number.isFinite(started) && started + 86400000 > Date.now() && count >= maxRequests) throw new Error('Ai atins limita de cereri pentru această perioadă.');
    await db.from('platform_module_rate_limits').upsert({ module_key: module.module_key, organization_id: context.organization.id, discord_id: context.discordId, window_started_at: Number.isFinite(started) && started + 86400000 > Date.now() ? String(rate.window_started_at) : new Date().toISOString(), request_count: Number.isFinite(started) && started + 86400000 > Date.now() ? count + 1 : 1, updated_at: new Date().toISOString() }, { onConflict: 'module_key,organization_id,discord_id' });
  }
  const schema = Array.isArray(definition.form_schema) ? definition.form_schema : [];
  for (const field of schema) {
    const fieldId = String(field?.id || '').trim();
    const value = String(values[fieldId] || '').trim();
    const type = String(field?.type || 'short_text').toLowerCase();
    if (field?.required !== false && !value) throw new Error(`Completează câmpul „${String(field?.label || fieldId || 'formular')}”.`);
    if (value && type === 'url' && !/^https?:\/\/\S+$/i.test(value)) throw new Error(`Câmpul „${String(field?.label || fieldId)}” trebuie să conțină un URL valid.`);
    if (value && ['attachment','file','image'].includes(type)) throw new Error('Atașamentele nu sunt disponibile direct în modalul Discord. Folosește un câmp URL.');
  }
  let id = submissionId;
  if (!id) {
    const { data, error } = await db.from('platform_module_submissions').insert({ module_key: module.module_key, organization_id: context.organization.id, guild_id: context.guildId, discord_id: context.discordId, display_name: context.displayName, values, status: requiresReview ? 'submitted' : 'closed' }).select('id').single();
    if (error) throw error;
    id = String(data.id);
  }
  const resultChannel = String(context.publication.result_channel_id || '').trim();
  let resultId = '';
  if (resultChannel && (definition.workflow?.logging_enabled !== false || actions.includes('send_log') || requiresReview)) {
    const payload: any = { allowed_mentions: { parse: [] }, embeds: [customModuleEmbed(module, context, values)] };
    if (requiresReview) payload.components = [{ type: 1, components: [{ type: 2, style: 3, label: 'Aprobă', custom_id: `panel:custom:${module.module_key}:decision:${id}:approved` }, { type: 2, style: 4, label: 'Respinge', custom_id: `panel:custom:${module.module_key}:decision:${id}:rejected` }] }];
    const response = await requestDiscordTarget(db, { target: context.target, transport: 'bot', channel_id: resultChannel }, JSON.stringify(payload), { method: 'POST' });
    if (!response.ok) throw new Error(`Rezultatul nu a putut fi trimis în canalul configurat (HTTP ${response.status}).`);
    const sent = await response.json().catch(() => ({})); resultId = String(sent?.id || '');
  if (resultId) await db.from('platform_module_submissions').update({ result_message_id: resultId, updated_at: new Date().toISOString() }).eq('id', id);
  }
  if (actions.includes('update_message') && context.publication.message_id) {
    await requestDiscordTarget(db, { target: context.target, transport: 'bot', channel_id: context.publication.embed_channel_id }, JSON.stringify(customModulePayload(module)), { method: 'PATCH', messageId: context.publication.message_id }).catch((error) => console.error('[discord-interactions] custom module message update failed', error));
  }
  if (actions.includes('notify_submitter')) await notifyCustomModuleUser(db, context.discordId, String(responses.success || 'Cererea ta a fost procesată în Panel Pro.')).catch(() => false);
  await db.from('platform_module_events').insert({ module_key: module.module_key, organization_id: context.organization.id, guild_id: context.guildId, discord_id: context.discordId, event_type: 'submission_created', payload: { submission_id: id, result_message_id: resultId } });
  return requiresReview ? interactionMessage(String(responses.review || 'Cererea a fost salvată și trimisă pentru aprobare.')) : interactionMessage(String(responses.success || (resultChannel ? 'Cererea a fost salvată și rezultatul a fost trimis în canalul configurat.' : 'Cererea a fost salvată.')));
}
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

function shiftDeadline(shiftType: string, now = new Date(), configuredTime = '') {
  const parts = romanianParts(now);
  const configuredValue = /^\d{2}:\d{2}$/.test(configuredTime)
    ? configuredTime
    : shiftType === 'noapte' ? '23:00' : '19:59';
  const configured = configuredValue.split(':').map(Number);
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

function parsePontajMinutes(value: unknown, fallback: number) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? hour * 60 + minute : fallback;
}

function automaticShiftType(config: any = {}, now = new Date()) {
  const parts = romanianParts(now);
  const currentMinutes = parts.hour * 60 + parts.minute;
  const dayEnd = parsePontajMinutes(config.dayEndTime, 19 * 60 + 59);
  const nightEnd = parsePontajMinutes(config.nightEndTime, 23 * 60);
  const nightStart = (dayEnd + 1) % 1440;
  const isNight = nightStart <= nightEnd
    ? currentMinutes >= nightStart && currentMinutes <= nightEnd
    : currentMinutes >= nightStart || currentMinutes <= nightEnd;
  return isNight ? 'noapte' : 'zi';
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
  await requireActiveOrganizationAccess(db, organization);

  const { data: settings, error: settingsError } = await db.from('organization_settings').select('discord_channel_routes').eq('organization_id', guild.organization_id).maybeSingle();
  if (settingsError) throw settingsError;
  const target = String(guild.kind || '') === 'secondary' ? 'secondary' : 'primary';
  const configuredChannel = configuredRouteForChannel(settings, 'pontaj', target, channelId);
  if (configuredChannel?.enabled === false || !(await routeChannelMatches(db, guild.organization_id, settings, 'pontaj', target, channelId, interactionMessageId(interaction)))) throw new Error('Acest canal nu este configurat pentru panoul Pontaj al organizației.');

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
  await requireActiveOrganizationAccess(db, organization);
  const { data: settings, error: settingsError } = await db.from('organization_settings').select('discord_channel_routes').eq('organization_id', guild.organization_id).maybeSingle();
  if (settingsError) throw settingsError;
  const target = String(guild.kind || '') === 'secondary' ? 'secondary' : 'primary';
  const routeKey = audience === 'organization' ? 'requests_organization' : 'requests_departments';
  const logRouteKey = audience === 'organization' ? 'log_requests_organization' : 'log_requests_departments';
  const alternateRouteKey = audience === 'organization' ? 'requests_departments' : 'requests_organization';
  const configuredChannel = configuredRouteForChannel(settings, routeKey, target, channelId)
    || configuredRouteForChannel(settings, 'requests', target, channelId)
    || configuredRouteForChannel(settings, alternateRouteKey, target, channelId);
  const messageId = interactionMessageId(interaction);
  const routeMatches = await routeChannelMatches(db, guild.organization_id, settings, routeKey, target, channelId, messageId)
    || await routeChannelMatches(db, guild.organization_id, settings, 'requests', target, channelId, messageId)
    || await routeChannelMatches(db, guild.organization_id, settings, alternateRouteKey, target, channelId, messageId);
  if (configuredChannel?.enabled === false || !routeMatches) throw new Error(`Acest canal nu este configurat pentru panoul Învoiri · ${audience === 'organization' ? 'Organizație' : 'Angajați'}.`);
  const memberRoles = new Set((interaction.member?.roles || []).map((role: unknown) => String(role)));
  const { data: mappings, error: mappingsError } = await db.from('organization_role_mappings').select('discord_role_id,panel_role,permission_level,priority').eq('organization_id', guild.organization_id).eq('guild_id', guildId).eq('enabled', true);
  if (mappingsError) throw mappingsError;
  const matchedMapping = (mappings || []).filter((mapping: any) => memberRoles.has(String(mapping.discord_role_id))).sort((left: any, right: any) => Number(right.priority || right.permission_level || 0) - Number(left.priority || left.permission_level || 0))[0] || null;
  const { data: organizationMember, error: memberError } = await db.from('organization_members').select('panel_role,permission_level,active').eq('organization_id', guild.organization_id).eq('discord_id', discordId).eq('active', true).maybeSingle();
  if (memberError) throw memberError;
  const platformAdmin = await isPlatformAdminAccount(db, discordId);
  // Învoirile inițiate din Discord sunt disponibile direct membrilor organizației.
  // Nu folosim permisiunile configurabile ale paginii web aici: canalul este deja
  // asociat organizației, iar apartenența este verificată prin mapping-ul Discord
  // sau prin membrul activ din organizație.
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

function proposalStatusLabel(status: string) {
  return ({ new: '🆕 Nouă', review: '🔎 În analiză', accepted: '✅ Acceptată', rejected: '❌ Respinsă' } as Record<string, string>)[String(status || 'new')] || '🆕 Nouă';
}

function proposalComponents(post: any, audience: 'organization' | 'departments') {
  return [
    { type: 1, components: [
      { type: 2, style: 3, label: '✅ Susțin', custom_id: `panel:proposals:${audience}:support:${post.id}` },
      { type: 2, style: 4, label: '❌ Contra', custom_id: `panel:proposals:${audience}:against:${post.id}` },
      { type: 2, style: 4, label: '🗑️ Șterge propunerea', custom_id: `panel:proposals:${audience}:delete:${post.id}` },
    ] },
  ];
}

function configuredRouteForChannel(settings: any, routeKey: string, target: string, channelId: string) {
  const route = settings?.discord_channel_routes?.[routeKey] || {};
  const configured = route?.[target];
  if (configured?.enabled !== false && String(configured?.channel_id || '') === String(channelId || '')) return configured;
  return Object.values(route).find((item: any) => item?.enabled !== false && String(item?.channel_id || '') === String(channelId || '')) || null;
}

function channelMatches(settings: any, routeKey: string, target: string, channelId: string) {
  const configured = configuredRouteForChannel(settings, routeKey, target, channelId);
  return configured?.enabled !== false && String(configured?.channel_id || '') === String(channelId || '');
}

async function routeChannelMatches(db: any, organizationId: string, settings: any, routeKey: string, target: string, channelId: string, messageId = '') {
  if (channelMatches(settings, routeKey, target, channelId)) return true;
  try {
    const { data, error } = await db.from('discord_message_registry')
      .select('id,target,channel_id,message_id,status')
      .eq('organization_id', organizationId)
      .eq('route_key', routeKey)
      .eq('channel_id', channelId)
      .in('status', ['pending', 'active', 'stale'])
      .order('updated_at', { ascending: false })
      .limit(5);
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    return rows.some((row: any) => String(row.target || target) === target || String(row.message_id || '') === String(messageId || ''));
  } catch (error) {
    console.error('[discord-interactions] route registry lookup failed', error);
    return false;
  }
}

const interactionMessageId = (interaction: any) => String(interaction?.message?.id || interaction?.message_id || '').trim();

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
  await requireActiveOrganizationAccess(db, organization);
  const { data: settings, error: settingsError } = await db.from('organization_settings').select('discord_channel_routes,panel_public_url').eq('organization_id', guild.organization_id).maybeSingle();
  if (settingsError) throw settingsError;
  const target = String(guild.kind || '') === 'secondary' ? 'secondary' : 'primary';
  const routes = announcementRoutes(audience);
  const proposalInteraction = String(interaction?.data?.custom_id || '').startsWith('panel:proposals:');
  const messageId = interactionMessageId(interaction);
  const proposalRouteMatches = proposalInteraction && (await routeChannelMatches(db, guild.organization_id, settings, 'proposals', target, channelId, messageId) || await routeChannelMatches(db, guild.organization_id, settings, 'log_proposals', target, channelId, messageId));
  if (!proposalRouteMatches && !(await routeChannelMatches(db, guild.organization_id, settings, routes.control, target, channelId, messageId)) && !(await routeChannelMatches(db, guild.organization_id, settings, routes.log, target, channelId, messageId))) throw new Error(`Acest canal nu este configurat pentru panoul ${audience === 'organization' ? 'Anunțuri · Organizație' : 'Anunțuri · Angajați'}.`);

  const { data: permissionSettings, error: permissionError } = await db.from('app_settings').select('key,value').eq('organization_id', guild.organization_id).in('key', ['communication_permissions', 'proposal_permissions', 'page_permissions', 'action_permissions', 'organization_package']);
  if (permissionError) throw permissionError;
  const byKey = new Map((permissionSettings || []).map((item: any) => [String(item.key), item.value]));
  const communication = byKey.get('communication_permissions');
  const proposalPermissions = byKey.get('proposal_permissions');
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
  const configuredRoles = proposalInteraction
    ? (Array.isArray(proposalPermissions?.[audience]?.[permission]) ? proposalPermissions[audience][permission].map(String) : [])
    : communicationConfigured
    ? (Array.isArray(communication?.[audience]?.[permission]) ? communication[audience][permission].map(String) : [])
    : (permission === 'read' ? (Array.isArray(pagePermissions['anunturi.html']) ? pagePermissions['anunturi.html'].map(String) : []) : (Array.isArray(actionPermissions['anunturi.publish']) ? actionPermissions['anunturi.publish'].map(String) : []));
  const hasAccess = platformAdmin || discordOnly || packageFeatures.includes(feature);
  if (!hasAccess) throw new Error(`Nu ai permisiunea de ${permission === 'read' ? 'citire' : 'scriere'} pentru ${audience === 'organization' ? 'Anunțuri · Organizație' : 'Anunțuri · Angajați'}.`);
  if (!platformAdmin && !matchedMapping && !organizationMember) throw new Error('Contul tău nu este membru activ al acestei organizații.');
  if (proposalInteraction && !platformAdmin && (!configuredRoles.length || ![...effectiveRoleIds].some((roleId) => configuredRoles.includes(String(roleId))))) throw new Error(`Rolul tău nu poate ${permission === 'write' ? 'trimite propuneri' : 'schimba statusul propunerilor'}.`);
  const displayName = String(interaction.member?.nick || user.global_name || user.username || discordId).trim().slice(0, 120) || discordId;
  return { guildId, channelId, target, discordId, displayName, organization, settings, platformAdmin, audience, routeKey: proposalInteraction ? 'proposals' : routes.log, controlRouteKey: proposalInteraction ? 'proposals' : routes.control, logRouteKey: proposalInteraction ? 'log_proposals' : routes.log, role: matchedMapping?.panel_role || organizationMember?.panel_role || 'Membru' };
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
  await requireActiveOrganizationAccess(db, organization);
  const { data: settings, error: settingsError } = await db.from('organization_settings').select('discord_channel_routes,panel_public_url').eq('organization_id', guild.organization_id).maybeSingle();
  if (settingsError) throw settingsError;
  const target = String(guild.kind || '') === 'secondary' ? 'secondary' : 'primary';
  const routes = announcementRoutes(audience);
  const messageId = interactionMessageId(interaction);
  if (!(await routeChannelMatches(db, guild.organization_id, settings, routeKey, target, channelId, messageId)) && !(await routeChannelMatches(db, guild.organization_id, settings, routes.log, target, channelId, messageId))) throw new Error(`Acest canal nu este configurat pentru ${routeKey}.`);
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
  if (!platformAdmin && !organizationMember) throw new Error('Contul tău nu este membru activ al acestei organizații.');
  if (!platformAdmin && !discordOnly && !packageFeatures.includes(feature)) throw new Error('Acest modul nu este inclus în pachetul organizației.');
  const displayName = String(interaction.member?.nick || user.global_name || user.username || discordId).trim().slice(0, 120) || discordId;
  const logRouteKey = feature.startsWith('discipline_')
    ? (permission === 'sanction' ? disciplineFineLogRoute(audience) : DISCIPLINE_LOG_ROUTES[audience])
    : routes.log;
  return { guildId, channelId, target, discordId, displayName, organization, settings, platformAdmin, audience, logRouteKey, role: mappings?.find((mapping: any) => effectiveRoleIds.has(String(mapping.discord_role_id)))?.panel_role || organizationMember?.panel_role || 'Membru' };
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
  await requireActiveOrganizationAccess(db, resolvedOrganization);
  if (resolvedSettingsError) throw resolvedSettingsError;
  const target = String(guild.kind || '') === 'secondary' ? 'secondary' : 'primary';
  if (!(await routeChannelMatches(db, guild.organization_id, resolvedSettings, routeKey, target, channelId, interactionMessageId(interaction)))) throw new Error(`Acest canal nu este configurat pentru panoul ${routeKey === 'log_contracts' ? 'Log contracte' : 'Contracte'}.`);
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

function monthlySalary(value: unknown) {
  const text = String(value ?? '');
  const raw = text.match(/\d[\d\s.,]*/)?.[0];
  if (!raw) return null;
  const amount = Number(raw.trim().replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.'));
  if (!Number.isFinite(amount) || amount < 0) return null;
  const currency = /\$|usd|dolar/i.test(text) ? '$' : /€|eur|euro/i.test(text) ? '€' : /lei|ron/i.test(text) ? 'lei' : '$';
  return { amount, currency };
}

function money(value: any) {
  return `${Number(value?.amount ?? value ?? 0).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${value?.currency || '$'}`;
}

function universalTextInput(custom_id: string, label: string, style = 1, required = false, placeholder = '', max_length = 1000, value = '') {
  return { type: 4, custom_id, label, style, required, placeholder, max_length, ...(value ? { value } : {}) };
}

function marketplaceModal(kind: 'legal' | 'illegal') {
  const illegal = kind === 'illegal';
  return { type: 9, data: { custom_id: `panel:marketplace:${kind}:submit`, title: illegal ? 'Anunț Marketplace ilegal' : 'Anunț Marketplace', components: [
    { type: 1, components: [universalTextInput('name', 'Nume afișat', 1, true, 'Numele anunțului', 120)] },
    { type: 1, components: [universalTextInput('phone', 'Telefon', 1, true, 'Număr de contact', 40)] },
    { type: 1, components: [universalTextInput('action', 'Tip acțiune', 1, true, 'Vânzare / Cumpărare / Servicii', 40)] },
    { type: 1, components: [universalTextInput('products', 'Descriere', 2, true, 'Produse sau servicii oferite', 1400)] },
    { type: 1, components: [universalTextInput('price', 'Preț', 1, false, 'Negociabil / sumă', 80)] },
  ] } };
}

function discoveryReminderModal() {
  return { type: 9, data: { custom_id: 'panel:discovery:reminder_submit', title: 'Adaugă eveniment / reminder', components: [
    { type: 1, components: [universalTextInput('title', 'Titlu', 1, true, 'Ex: Ședință organizație', 160)] },
    { type: 1, components: [universalTextInput('event_type', 'Tip eveniment', 1, true, 'Ex: ședință, activitate, termen', 40)] },
    { type: 1, components: [universalTextInput('event_date', 'Data', 1, true, 'AAAA-LL-ZZ', 10)] },
    { type: 1, components: [universalTextInput('details', 'Detalii', 2, false, 'Detalii și instrucțiuni', 1200)] },
    { type: 1, components: [universalTextInput('evidence_url', 'Link dovadă', 1, false, 'https://...', 500)] },
  ] } };
}

async function resolveUniversalModuleContext(db: any, interaction: any, routeKey: string, feature: string) {
  const guildId = String(interaction.guild_id || '').trim();
  const channelId = String(interaction.channel_id || '').trim();
  const discordId = String(interaction.member?.user?.id || interaction.user?.id || '').trim();
  if (!/^\d{15,22}$/.test(guildId) || !/^\d{15,22}$/.test(channelId) || !/^\d{15,22}$/.test(discordId)) throw new Error('Interacțiunea Discord nu conține date valide.');
  const { data: guild, error: guildError } = await db.from('organization_guilds').select('organization_id,kind').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
  if (guildError) throw guildError;
  if (!guild?.organization_id) throw new Error('Serverul Discord nu este asociat unei organizații Panel Pro.');
  const [{ data: organization, error: organizationError }, { data: settings, error: settingsError }, { data: packageSetting, error: packageError }, { data: member, error: memberError }] = await Promise.all([
    db.from('organizations').select('id,name,active').eq('id', guild.organization_id).maybeSingle(),
    db.from('organization_settings').select('discord_channel_routes,panel_public_url').eq('organization_id', guild.organization_id).maybeSingle(),
    db.from('app_settings').select('value').eq('organization_id', guild.organization_id).eq('key', 'organization_package').maybeSingle(),
    db.from('organization_members').select('active,panel_role,permission_level').eq('organization_id', guild.organization_id).eq('discord_id', discordId).eq('active', true).maybeSingle(),
  ]);
  if (organizationError || settingsError || packageError || memberError) throw organizationError || settingsError || packageError || memberError;
  await requireActiveOrganizationAccess(db, organization);
  if (!resolvePackageFeatures(packageSetting?.value || {}).includes(feature) && !(await isPlatformAdminAccount(db, discordId)) && packageSetting?.value?.code !== 'discord') throw new Error('Acest modul nu este inclus în pachetul organizației.');
  const target = String(guild.kind || '') === 'secondary' ? 'secondary' : 'primary';
  const configuredRoute = settings?.discord_channel_routes?.[routeKey] || {};
  // Unele organizații au fost salvate înainte ca asocierea guild-ului
  // principal/secundar să fie sincronizată perfect cu ruta. Canalul este
  // deja asociat aceleiași organizații, deci acceptăm și ținta alternativă
  // dacă ID-ul canalului corespunde exact rutei modulului.
  const configured = configuredRoute?.[target]?.channel_id === channelId
    ? configuredRoute[target]
    : Object.values(configuredRoute).find((route: any) => String(route?.channel_id || '') === channelId);
  const logRouteKey = PANEL_LOG_ROUTES[routeKey] || routeKey;
  if (configured?.enabled === false || !(await routeChannelMatches(db, guild.organization_id, settings, routeKey, target, channelId, interactionMessageId(interaction)))) throw new Error('Acest canal nu este configurat pentru modulul selectat.');
  // These are dedicated Discord embeds. Discord already controls access via
  // channel visibility and roles, so a separate Panel Pro membership is not
  // required for any standard button interaction.
  const displayName = String(interaction.member?.nick || interaction.member?.user?.global_name || interaction.member?.user?.username || discordId).slice(0, 120);
  return { guildId, channelId, target, discordId, displayName, organization, settings, logRouteKey };
}

async function resolveWheelContext(db: any, interaction: any) {
  const guildId = String(interaction.guild_id || '').trim();
  const channelId = String(interaction.channel_id || '').trim();
  const discordId = String(interaction.member?.user?.id || interaction.user?.id || '').trim();
  if (!/^\d{15,22}$/.test(guildId) || !/^\d{15,22}$/.test(channelId) || !/^\d{15,22}$/.test(discordId)) throw new Error('Interacțiunea Discord nu conține date valide.');
  const { data: guild, error: guildError } = await db.from('organization_guilds').select('organization_id,kind').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
  if (guildError) throw guildError;
  if (!guild?.organization_id) throw new Error('Serverul Discord nu este asociat unei organizații Panel Pro.');
  const [{ data: organization, error: organizationError }, { data: settings, error: settingsError }] = await Promise.all([
    db.from('organizations').select('id,name,active').eq('id', guild.organization_id).maybeSingle(),
    db.from('organization_settings').select('discord_channel_routes,panel_public_url').eq('organization_id', guild.organization_id).maybeSingle(),
  ]);
  if (organizationError || settingsError) throw organizationError || settingsError;
  await requireActiveOrganizationAccess(db, organization);
  const target = String(guild.kind || '') === 'secondary' ? 'secondary' : 'primary';
  const wheelRoutes = settings?.discord_channel_routes?.wheel_timer || {};
  // Pentru organizațiile care au fost configurate înainte de separarea
  // primary/secondary, guild.kind poate să nu mai corespundă cheii salvate.
  // Verificăm în continuare strict canalul actual, dar acceptăm ruta Roții
  // dacă ea este salvată pe oricare dintre cele două ținte.
  const configured = wheelRoutes?.[target]?.channel_id === channelId
    ? wheelRoutes[target]
    : Object.values(wheelRoutes).find((route: any) => String(route?.channel_id || '') === channelId)
      // Compatibilitate pentru embedurile Roată publicate înainte ca ruta
      // dedicată wheel_timer să fie separată de ruta evenimentelor.
      || Object.values(settings?.discord_channel_routes?.event_reminders || {}).find((route: any) => String(route?.channel_id || '') === channelId)
      || Object.values(settings?.discord_channel_routes?.log_event_reminders || {}).find((route: any) => String(route?.channel_id || '') === channelId);
  const messageId = interactionMessageId(interaction);
  const registered = await routeChannelMatches(db, guild.organization_id, settings, 'wheel_timer', target, channelId, messageId)
    || await routeChannelMatches(db, guild.organization_id, settings, 'event_reminders', target, channelId, messageId)
    || await routeChannelMatches(db, guild.organization_id, settings, 'log_event_reminders', target, channelId, messageId);
  const messageTitle = String(interaction?.message?.embeds?.[0]?.title || '').trim().toLowerCase();
  const isOfficialWheelMessage = messageTitle.includes('roată') || messageTitle.includes('roata');
  // Compatibilitate pentru embedurile Roată deja publicate înainte ca ruta
  // dedicată să fie salvată în configurația organizației/registrul central.
  // Verificăm titlul embedului Panel Pro, nu acceptăm orice buton arbitrar.
  if ((!configured && !registered && !isOfficialWheelMessage) || configured?.enabled === false) throw new Error('Acest canal nu este configurat pentru embedul Roată.');
  return { guildId, channelId, target, discordId, organization, settings };
}

const wheelRemainingText = (completesAt: string) => {
  const remaining = Math.max(0, Date.parse(String(completesAt || '')) - Date.now());
  if (!remaining) return 'Timerul a expirat. Poți porni din nou roata.';
  const totalSeconds = Math.ceil(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `Mai ai **${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s**.`;
};

const ILLEGAL_LOCATION_MAP_ENDPOINT = 'https://vkvsabbbawyiurnaiugo.supabase.co/functions/v1/illegal-location-map';
// URL-ul trebuie să rămână stabil pentru ca Discord și proxy-ul de imagine să
// poată reutiliza rezultatul. Date.now() genera o imagine nouă la fiecare click,
// ceea ce ducea uneori la timeout / imagine lipsă în embed.
const ILLEGAL_LOCATION_MAP_VERSION = '20261007-1';
// 1024 evită răspunsurile 404 ale proxy-ului pentru harta mare Los Santos,
// păstrând totuși suficientă rezoluție pentru textul și pinurile afișate.
const renderedIllegalMap = (key: string) => `https://wsrv.nl/?url=${encodeURIComponent(`${ILLEGAL_LOCATION_MAP_ENDPOINT}?map=${key}&v=${ILLEGAL_LOCATION_MAP_VERSION}`)}&output=png&w=1024&q=80`;
const illegalLocationMap = (value: string) => {
  const maps: Record<string, { label: string; image: string; url: string; description: string }> = {
    ls: { label: 'Los Santos', image: renderedIllegalMap('ls'), url: 'https://panel-pro.ro/locatiiilegale.html?map=ls', description: 'Harta Los Santos și Blaine County cu locațiile ilegale disponibile.' },
    cayo: { label: 'Cayo Perico', image: renderedIllegalMap('cayo'), url: 'https://panel-pro.ro/locatiiilegale.html?map=cayo', description: 'Harta Cayo Perico cu locațiile ilegale disponibile.' },
    maldive: { label: 'Maldive', image: renderedIllegalMap('maldive'), url: 'https://panel-pro.ro/locatiiilegale.html?map=maldive', description: 'Harta Maldive cu locațiile ilegale disponibile.' },
  };
  return maps[value] || null;
};

const illegalLocationsMessage = (mapKey = '') => {
  const selected = illegalLocationMap(mapKey);
  const buttons = selected ? [
    { type: 2, style: 2, label: 'Înapoi la hărți', custom_id: 'panel:illegal_locations:maps' },
    { type: 2, style: 5, label: 'Deschide harta completă', url: selected.url },
  ] : [];
  const mapButtons = ['ls', 'cayo', 'maldive'].map((key) => {
    const item = illegalLocationMap(key)!;
    return { type: 2, style: 4, label: item.label, custom_id: `panel:illegal_locations:map:${key}` };
  });
  return { type: 7, data: { allowed_mentions: { parse: [] }, embeds: [{ title: selected ? `🗺️ ${selected.label} · Locații ilegale` : '🗺️ Locații ilegale · Panel Pro', description: selected ? selected.description : 'Alege una dintre cele 3 hărți. Embedul se va actualiza aici, fără să trimită un mesaj nou.', color: 0xef4444, ...(selected ? { image: { url: selected.image }, url: selected.url } : {}), footer: { text: 'Panel Pro - By Little Mario' } }], components: [{ type: 1, components: selected ? [...buttons, ...mapButtons].slice(0, 5) : mapButtons }] } };
};

const wheelPrivateMessage = (timer: any = null) => {
  const active = timer && Date.parse(String(timer.completes_at || '')) > Date.now();
  return interactionMessage('', { embeds: [{ title: active ? '⏳ Timerul tău este activ' : '🎡 Roata este disponibilă', description: active ? wheelRemainingText(timer.completes_at) : 'Poți apăsa „Am dat la roată” pentru a porni un nou timer de 6 ore.', color: active ? 0xf59e0b : 0x06b6d4, footer: { text: 'Panel Pro · răspuns vizibil doar pentru tine' } }], components: [{ type: 1, components: [{ type: 2, style: active ? 2 : 1, label: active ? 'Verifică timpul' : 'Am dat la roată', custom_id: active ? 'panel:wheel:status' : 'panel:wheel:start' }] }] });
};

function marketplaceEmbed(kind: 'legal' | 'illegal', values: Record<string, any>, context: any, id: string) {
  const illegal = kind === 'illegal';
  const sold = String(values.status || 'active') === 'sold';
  return { allowed_mentions: { parse: [] }, embeds: [{ title: `${sold ? '✅ Vândut · ' : ''}${illegal ? '🚨 Anunț nou · Marketplace ilegal' : '🛒 Anunț nou · Marketplace'}`, description: `${sold ? 'Acest anunț a fost marcat ca vândut. ' : ''}Publicat de **${context.displayName}**.`, color: sold ? 0x64748b : illegal ? 0xef4444 : 0x2563eb, fields: [
    { name: 'Nume', value: String(values.name || '—').slice(0, 1024), inline: true },
    { name: 'Telefon', value: String(values.phone || '—').slice(0, 1024), inline: true },
    { name: 'Tip acțiune', value: String(values.action || '—').slice(0, 1024), inline: true },
    { name: 'Descriere', value: String(values.products || '—').slice(0, 1024), inline: false },
    { name: 'Preț', value: String(values.price || 'Negociabil').slice(0, 1024), inline: true },
  ], footer: { text: 'Panel Pro · rezultat în canalul de log' }, timestamp: new Date().toISOString() }], components: [{ type: 1, components: [{ type: 2, style: 5, label: 'Deschide în panel', url: `https://panel-pro.ro/${illegal ? 'marketplace-ilegal.html' : 'marketplace.html'}?anunt=${encodeURIComponent(id)}` }, { type: 2, style: 4, label: sold ? 'Vândut' : 'Marchează ca vândut', custom_id: `panel:marketplace:${illegal ? 'illegal' : 'legal'}:sold:${encodeURIComponent(id)}`, ...(sold ? { disabled: true } : {}) }] }] };
}

async function markMarketplaceSoldFromDiscord(db: any, interaction: any, kind: 'legal' | 'illegal', itemId: string) {
  const routeKey = kind === 'illegal' ? 'illegal_marketplace' : 'marketplace';
  const feature = kind === 'illegal' ? 'illegal_marketplace' : 'legal_marketplace';
  let context;
  try { context = await resolveUniversalModuleContext(db, interaction, routeKey, feature); }
  catch (_) { context = await resolveUniversalModuleContext(db, interaction, kind === 'illegal' ? 'log_illegal_marketplace' : 'log_marketplace', feature); }
  const table = kind === 'illegal' ? 'marketplace_ilegal' : 'marketplace';
  const query = db.from(table).select('id,nume,telefon,tip_actiune,produse,pret,status,organization_id,created_by_discord_id').eq('id', itemId);
  if (kind === 'illegal') query.is('organization_id', null); else query.eq('organization_id', context.organization.id);
  const { data: item, error } = await query.maybeSingle();
  if (error) throw error;
  if (!item) throw new Error('Anunțul nu există sau nu mai este accesibil.');
  if (!isDiscordManager(interaction) && !context.platformAdmin && String(item.created_by_discord_id || '') !== context.discordId) throw new Error('Doar autorul, ownerul serverului sau administratorul global poate marca anunțul ca vândut.');
  if (String(item.status || 'active') !== 'sold') {
    const { error: updateError } = await db.from(table).update({ status: 'sold', sold_at: new Date().toISOString(), sold_by_discord_id: context.discordId, updated_at: new Date().toISOString() }).eq('id', itemId);
    if (updateError) throw updateError;
    item.status = 'sold';
  }
  const payload = marketplaceEmbed(kind, { ...item, name: item.nume, phone: item.telefon, action: item.tip_actiune, products: item.produse, price: item.pret }, context, itemId);
  return { type: 7, data: { allowed_mentions: payload.allowed_mentions, embeds: payload.embeds, components: payload.components } };
}

async function deliverGlobalMarketplaceResult(db: any, routeKey: string, body: BodyInit) {
  const { data: organizations, error: organizationsError } = await db.from('organizations').select('id').eq('active', true);
  if (organizationsError) throw organizationsError;
  const organizationIds = (organizations || []).map((organization: any) => String(organization.id)).filter(Boolean);
  if (!organizationIds.length) throw new Error('Nu există organizații active pentru livrarea Marketplace.');
  const { data: settingsRows, error: settingsError } = await db.from('organization_settings').select('organization_id,discord_channel_routes').in('organization_id', organizationIds);
  if (settingsError) throw settingsError;
  const results: any[] = [];
  const failures: string[] = [];
  for (const settings of settingsRows || []) {
    if (!routeCandidates(settings, routeKey).some((item: any) => item.candidates.length)) continue;
    try {
      const delivery = await deliverDiscordRoute(db, settings, routeKey, body, { postOnly: true, organizationId: String(settings.organization_id), messageKey: `global-${routeKey}-${crypto.randomUUID()}` });
      results.push(...delivery.results.map((item: any) => ({ ...item, organization_id: settings.organization_id })));
      failures.push(...delivery.failures.map((failure: string) => `${settings.organization_id}: ${failure}`));
    } catch (error) {
      failures.push(`${settings.organization_id}: ${error instanceof Error ? error.message : 'Eroare Discord.'}`);
    }
  }
  if (!results.length) throw new Error(failures.join(' | ') || 'Nu există canale Discord configurate pentru notificarea globală.');
  return { results, failures };
}

async function handleMarketplaceSubmit(db: any, context: any, kind: 'legal' | 'illegal', values: Record<string, any>) {
  const table = kind === 'illegal' ? 'marketplace_ilegal' : 'marketplace';
  const name = String(values.name || '').trim();
  const products = String(values.products || '').trim();
  if (name.length < 2 || products.length < 2) throw new Error('Completează numele și descrierea anunțului.');
  const row: any = { nume: name.slice(0, 120), telefon: String(values.phone || '').trim().slice(0, 40), tip_actiune: String(values.action || '').trim().slice(0, 40), categorie: 'General', produse: products.slice(0, 4000), pret: String(values.price || 'Negociabil').trim().slice(0, 80) || 'Negociabil', imagini_json: '[]', imagine_url: null, created_by_discord_id: context.discordId, organization_id: kind === 'illegal' ? null : context.organization.id };
  if (kind !== 'illegal') row.display_name = context.displayName;
  const { data, error } = await db.from(table).insert(row).select('id').single();
  if (error) throw error;
  const delivery = await deliverGlobalMarketplaceResult(db, context.logRouteKey, JSON.stringify(marketplaceEmbed(kind, values, context, String(data.id))));
  if (!delivery.results?.length) throw new Error(delivery.failures?.join(' | ') || 'Anunțul a fost salvat, dar logul Discord nu a putut fi trimis.');
  const failedTargets = Number(delivery.failures?.length || 0);
  const warning = failedTargets ? `\n⚠️ ${failedTargets} destinație(e) nu au primit notificarea: ${delivery.failures.join(' | ').slice(0, 1400)}` : '';
  return interactionMessage(`Anunțul a fost salvat și trimis în ${delivery.results.length} destinație(e) globale configurate.${warning}`);
}

async function handleReminderSubmit(db: any, context: any, values: Record<string, any>) {
  const title = String(values.title || '').trim();
  const eventDate = String(values.event_date || '').trim();
  if (title.length < 2 || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) throw new Error('Completează titlul și data în formatul AAAA-LL-ZZ.');
  const { data, error } = await db.from('organization_events').insert({ organization_id: context.organization.id, title: title.slice(0, 160), event_type: String(values.event_type || 'other').slice(0, 40), event_date: eventDate, details: String(values.details || '').slice(0, 5000), evidence_url: String(values.evidence_url || '').trim() || null, status: 'active', created_by_discord_id: context.discordId }).select('id,title,event_date').single();
  if (error) throw error;
  const payload = { allowed_mentions: { parse: [] }, embeds: [{ title: `🗓️ Eveniment nou · ${data.title}`, description: String(values.details || 'Fără detalii.').slice(0, 4096), color: 0xf59e0b, fields: [{ name: 'Data', value: String(data.event_date), inline: true }, { name: 'Tip', value: String(values.event_type || 'other'), inline: true }], timestamp: new Date().toISOString() }] };
  const delivery = await deliverDiscordRoute(db, context.settings, context.logRouteKey, JSON.stringify(payload), { postOnly: true, organizationId: String(context.organization.id), messageKey: `event-${String(data.id)}`, retryPayload: payload });
  if (!delivery.results?.length) throw new Error('Evenimentul a fost salvat, dar logul Discord nu a putut fi trimis.');
  return interactionMessage('Evenimentul a fost salvat și trimis în canalul de log.');
}

async function handleWeeklyReport(db: any, context: any) {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  const startIso = start.toISOString();
  const { data: contracts, error: contractsError } = await db.from('organization_contracts').select('employee_id,created_at').eq('organization_id', context.organization.id).gte('created_at', startIso).lte('created_at', end.toISOString()).order('created_at', { ascending: false }).limit(500);
  if (contractsError) throw contractsError;
  const ids = [...new Set((contracts || []).map((item: any) => String(item.employee_id)).filter(Boolean))];
  const { data: employees, error: employeesError } = ids.length ? await db.from('organization_employees').select('id,full_name,cnp,status').in('id', ids) : { data: [], error: null };
  if (employeesError) throw employeesError;
  const employeeMap = new Map((employees || []).map((employee: any) => [String(employee.id), employee]));
  const lines = ids.map((id) => employeeMap.get(id)).filter(Boolean).map((employee: any) => `${employee.status === 'inactive' ? '🔴' : '🟢'} ${String(employee.full_name || 'Angajat').slice(0, 100)} · CNP ${String(employee.cnp || '—')}`);
  const payload = { allowed_mentions: { parse: [] }, embeds: [{ title: '📋 Raport săptămânal · Contracte', description: lines.join('\n').slice(0, 4000) || 'Nu există contracte în ultimele 7 zile.', color: 0x14b8a6, fields: [{ name: 'Perioadă', value: `${start.toISOString().slice(0, 10)} – ${end.toISOString().slice(0, 10)}`, inline: true }, { name: 'Înregistrări', value: String(lines.length), inline: true }], footer: { text: 'Panel Pro · raport generat din baza web' }, timestamp: end.toISOString() }] };
  const delivery = await deliverDiscordRoute(db, context.settings, context.logRouteKey, JSON.stringify(payload), { postOnly: true, organizationId: String(context.organization.id), messageKey: `weekly-contract-report-${start.toISOString().slice(0, 10)}`, retryPayload: payload });
  if (!delivery.results?.length) throw new Error(delivery.failures?.join(' | ') || 'Raportul nu a putut fi trimis în canalul de log.');
  return interactionMessage('Raportul săptămânal a fost generat și trimis în canalul de log.');
}

const communityReactionChoices = ['✅', '❌', '👍', '❤️', '🤔'];

function communityPostComponents(post: any, options: any[] = []) {
  const audience = post.audience === 'departments' ? 'departments' : 'organization';
  if (post.post_type === 'proposal') return proposalComponents(post, audience);
  const rows: any[] = [];
  if (post.post_type === 'poll') {
    const pollOptions = options.slice(0, 10);
    for (let index = 0; index < pollOptions.length; index += 5) {
      rows.push({ type: 1, components: pollOptions.slice(index, index + 5).map((option: any) => ({ type: 2, style: 1, label: String(option.option_text || `Opțiunea ${option.position + 1}`).slice(0, 80), custom_id: `panel:announcements:${audience}:vote:${post.id}:${option.position}` })) });
    }
  }
  rows.push({ type: 1, components: [
    { type: 2, style: 3, label: '✅ Am citit', custom_id: `panel:announcements:${audience}:read:${post.id}` },
    { type: 2, style: 2, label: 'Editează', custom_id: `panel:announcements:${audience}:edit:${post.id}` },
    { type: 2, style: 4, label: 'Șterge', custom_id: `panel:announcements:${audience}:delete:${post.id}` },
  ] });
  return rows.slice(0, 5);
}

function communityPostEmbed(post: any, options: any[] = [], votes: any[] = [], reactions: any[] = [], reads: any[] = [], settings: any = {}) {
  const audience = post.audience === 'departments' ? 'Angajați' : 'Organizație';
  const site = String(settings?.panel_public_url || 'https://panel-pro.ro').replace(/\/$/, '');
  const postUrl = `${site}/anunturi.html?post=${post.id}`;
  const fields: any[] = [];
  if (post.post_type === 'proposal') {
    const support = votes.filter((vote: any) => String(vote.vote) === 'support');
    const against = votes.filter((vote: any) => String(vote.vote) === 'against');
    fields.push({ name: '📌 Status', value: proposalStatusLabel(post.proposal_status), inline: true });
    fields.push({ name: '📊 Voturi', value: `✅ Susțin: ${support.length}\n❌ Contra: ${against.length}`, inline: true });
    fields.push({ name: '👥 Membri care au votat', value: [...support.map((item: any) => `✅ ${item.display_name || item.user_discord_id}`), ...against.map((item: any) => `❌ ${item.display_name || item.user_discord_id}`)].join('\n').slice(0, 1024) || 'Încă nu există voturi.', inline: false });
    fields.push({ name: 'ℹ️ Cum funcționează', value: 'Folosește butoanele pentru a susține sau respinge propunerea. Statusul este schimbat de rolurile configurate în organizatii.html.', inline: false });
  }
  if (post.post_type === 'poll') {
    const total = votes.length;
    fields.push({ name: `🗳️ Rezultate · ${total} vot${total === 1 ? '' : 'uri'}`, value: options.map((option: any) => {
      const count = votes.filter((vote: any) => String(vote.option_id) === String(option.id)).length;
      const percentage = total ? Math.round((count * 100) / total) : 0;
      return `▫️ ${String(option.option_text || 'Opțiune').slice(0, 80)} — ${count} (${percentage}%)`;
    }).join('\n').slice(0, 1024) || 'Încă nu există opțiuni.' });
  }
  const readNames = reads.map((item: any) => String(item.display_name || item.user_discord_id || 'Membru').slice(0, 80));
  fields.push({ name: `✅ Au citit (${readNames.length})`, value: readNames.length ? readNames.map((name) => `• ${name}`).join('\n').slice(0, 1024) : 'Nimeni nu a confirmat încă.', inline: false });
  if (post.post_type !== 'proposal') fields.push({ name: post.post_type === 'poll' ? 'Votare' : 'Confirmare', value: post.post_type === 'poll' ? 'Alege o opțiune de mai jos.' : 'Folosește butonul „Am citit” pentru a confirma că ai văzut anunțul.', inline: false });
  return {
    title: String(post.title || 'Comunicare').slice(0, 256),
    description: String(post.content || '—').slice(0, 4096),
    color: post.post_type === 'proposal' ? 0xa855f7 : post.post_type === 'poll' ? 0x8b5cf6 : post.audience === 'organization' ? 0x22d3ee : 0x5865f2,
    url: postUrl,
    fields,
    footer: { text: `${post.post_type === 'proposal' ? 'Propunere' : post.post_type === 'poll' ? 'Sondaj' : post.post_type === 'question' ? 'Întrebare' : 'Anunț'} · ${audience} · ${String(post.author_name || 'Panel Pro').slice(0, 60)}` },
    timestamp: post.updated_at || post.created_at || new Date().toISOString(),
  };
}

async function loadCommunityPost(db: any, organizationId: string, postId: string) {
  let { data: post, error: postError } = await db.from('community_posts').select('*').eq('organization_id', organizationId).eq('id', postId).maybeSingle();
  if (postError) throw postError;
  if (!post) {
    const proposalResult = await db.from('community_proposals').select('*').eq('organization_id', organizationId).eq('id', postId).maybeSingle();
    if (proposalResult.error) throw proposalResult.error;
    if (proposalResult.data) post = { ...proposalResult.data, post_type: 'proposal' };
  }
  if (!post) throw new Error('Postarea nu mai există în organizația activă.');
  const [optionsResult, votesResult, reactionsResult, readsResult, proposalVotesResult] = await Promise.all([
    db.from('community_poll_options').select('id,post_id,option_text,position').eq('organization_id', organizationId).eq('post_id', postId).order('position'),
    db.from('community_poll_votes').select('post_id,option_id,user_discord_id').eq('organization_id', organizationId).eq('post_id', postId),
    db.from('community_reactions').select('post_id,user_discord_id,reaction').eq('organization_id', organizationId).eq('post_id', postId),
    db.from('community_post_reads').select('post_id,user_discord_id,display_name,confirmed_at').eq('organization_id', organizationId).eq('post_id', postId).order('confirmed_at'),
    db.from('community_proposal_votes_v2').select('proposal_id,user_discord_id,display_name,vote,created_at').eq('organization_id', organizationId).eq('proposal_id', postId).then((result: any) => ({ ...result, data: (result.data || []).map((vote: any) => ({ ...vote, post_id: vote.proposal_id })) })),
  ]);
  if (optionsResult.error) throw optionsResult.error;
  if (votesResult.error) throw votesResult.error;
  if (reactionsResult.error) throw reactionsResult.error;
  if (readsResult.error) throw readsResult.error;
  if (proposalVotesResult.error && post.post_type === 'proposal') throw proposalVotesResult.error;
  return { post, options: optionsResult.data || [], votes: post.post_type === 'proposal' ? (proposalVotesResult.data || []) : (votesResult.data || []), reactions: reactionsResult.data || [], reads: readsResult.data || [] };
}

function communityPayload(data: any) {
  return JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [communityPostEmbed(data.post, data.options, data.votes, data.reactions, data.reads, data.settings)], components: communityPostComponents(data.post, data.options) });
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

async function saveCommunityMessageRefs(db: any, organizationId: string, postId: string, results: any[], table = 'community_posts') {
  if (!results.length) return;
  const refs = results.filter((item: any) => item.id).map((item: any) => ({ target: String(item.target || ''), channel_id: String(item.channel_id || ''), id: String(item.id) }));
  const first = refs[0];
  const { error } = await db.from(table).update({ discord_message_id: first?.id || null, discord_message_ids: refs, updated_at: new Date().toISOString() }).eq('organization_id', organizationId).eq('id', postId);
  if (error) throw error;
}

async function syncCommunityPostDiscord(db: any, context: any, data: any) {
  const messageIds = communityMessageRefs(data.post);
  const communityBody = communityPayload({ ...data, settings: context.settings });
  const delivery = await deliverDiscordRoute(db, context.settings, context.routeKey, communityBody, { messageIds, organizationId: String(context.organization.id), messageKey: `community-post-${String(data.post.id)}`, retryPayload: JSON.parse(communityBody), targets: context.routeKey === 'proposals' ? [context.target] : undefined });
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

function proposalModal(audience: 'organization' | 'departments') {
  const input = (custom_id: string, label: string, style: number, placeholder: string, max_length: number) => ({ type: 4, custom_id, label, style, required: true, placeholder, max_length });
  return { type: 9, data: { custom_id: `panel:proposals:${audience}:submit`, title: 'Trimite propunere', components: [
    { type: 1, components: [input('title', 'Titlu propunere', 1, 'Ce propui?', 140)] },
    { type: 1, components: [input('content', 'Descrierea propunerii', 2, 'Explică ideea și avantajele ei...', 4000)] },
  ] } };
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
    const payload = { allowed_mentions: { parse: [] }, embeds: [{
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
    }] };
    const delivery = await deliverDiscordRoute(db, context.settings, context.logRouteKey, JSON.stringify(payload), { organizationId: String(context.organization.id), messageKey: `community-log-${String(post.id)}-${String(action).toLowerCase()}`, retryPayload: payload });
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
  ] } };
}

function contractSettingsModal() {
  const input = (custom_id: string, label: string, style: number, required: boolean, placeholder: string, max_length: number) => ({ type: 4, custom_id, label, style, required, placeholder, max_length });
  return { type: 9, data: { custom_id: 'panel:contracts:settings_submit', title: 'Setează contractul', components: [
    { type: 1, components: [input('title', 'Numele contractului', 1, true, 'Ex: Contract de colaborare', 100)] },
    { type: 1, components: [input('address', 'Adresă de lucru', 1, false, 'Ex: Str. Exemplu nr. 10, București', 200)] },
    { type: 1, components: [input('salary', 'Salariu implicit', 1, false, 'Ex: 100 lei/lună', 120)] },
    { type: 1, components: [input('schedule', 'Program implicit', 1, false, 'Ex: 20:00-23:00', 120)] },
    { type: 1, components: [input('template', 'Șablonul contractului', 2, true, 'Lipește textul contractului și folosește variabilele de mai jos', 4000)] },
  ] } };
}

function contractInfoMessage() {
  return interactionMessage('', { embeds: [{ title: 'ℹ️ Cum configurezi contractul', description: 'În șablon, folosește exact variabilele de mai jos între acolade duble. La generare, botul le înlocuiește automat cu datele organizației și ale angajatului.', color: 0x14b8a6, fields: [
    { name: 'Date completate automat', value: '`{{COMPANY}}` companie\n`{{ADDRESS}}` adresă\n`{{MANAGER}}` manager\n`{{POSITION}}` funcție\n`{{SALARY}}` salariu\n`{{PROGRAM}}` program\n`{{START_DATE}}` data începerii\n`{{CONTRACT_NUMBER}}` număr contract', inline: true },
    { name: 'Date cerute la generare', value: '`{{EMPLOYEE_NAME}}` nume și prenume\n`{{CNP}}` CNP', inline: true },
    { name: 'Exemplu', value: 'Angajat: `{{EMPLOYEE_NAME}}`\nCNP: `{{CNP}}`\nSalariu: `{{SALARY}}`', inline: false },
  ], footer: { text: 'Panel Pro · Contracte Discord' } }] });
}

function contractTemplateVariables() {
  return new Set(['{{COMPANY}}', '{{ADDRESS}}', '{{MANAGER}}', '{{EMPLOYEE_NAME}}', '{{CNP}}', '{{POSITION}}', '{{SALARY}}', '{{PROGRAM}}', '{{START_DATE}}', '{{CONTRACT_NUMBER}}']);
}

function stripContractPhone(value: unknown) {
  return String(value || '')
    .replace(/^[ \t]*(?:telefon|număr(?:ul)?(?: de)? telefon)[^\r\n]*(?:\r?\n|$)/gim, '')
    .replace(/\{\{PHONE\}\}/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function handleContractSettingsSubmit(db: any, context: any, interaction: any, values: Record<string, any>) {
  if (!isDiscordManager(interaction) && !context.platformAdmin) throw new Error('Doar ownerul serverului sau un administrator cu Manage Server poate seta contractul.');
  const title = contractValue(values.title, '');
  const template = stripContractPhone(String(values.template ?? '').trim().slice(0, 50000));
  const address = contractValue(values.address, context.organization.address || '');
  const salary = contractValue(values.salary, '');
  const schedule = contractValue(values.schedule, '20:00-23:00');
  if (title.length < 2) return interactionMessage('Numele contractului este obligatoriu.');
  if (template.length < 20) return interactionMessage('Șablonul contractului este prea scurt.');
  const unknown = [...template.matchAll(/{{[A-Z0-9_]+}}/g)].map((match) => match[0]).filter((value) => !contractTemplateVariables().has(value));
  if (unknown.length) return interactionMessage(`Variabile necunoscute în șablon: ${[...new Set(unknown)].join(', ')}`);
  const { data: previousTemplate } = await db.from('app_settings').select('value').eq('organization_id', context.organization.id).eq('key', 'contract_template').maybeSingle();
  const previousDefaults = previousTemplate?.value?.defaults && typeof previousTemplate.value.defaults === 'object' ? previousTemplate.value.defaults : {};
  const position = contractValue(previousDefaults.position, 'Angajat');
  const { error } = await db.from('app_settings').upsert({ organization_id: context.organization.id, key: 'contract_template', value: { title, template, defaults: { position, address: address || null, salary: salary || null, schedule } }, updated_at: new Date().toISOString() }, { onConflict: 'organization_id,key' });
  if (error) throw error;
  return interactionMessage(`Șablonul **${title}** a fost salvat. La generare se completează automat organizația, adresa de lucru, managerul, funcția, salariul, programul, data și numărul contractului; angajatul completează numele și CNP-ul.`);
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
    { name: '📍 Adresă de lucru', value: contract.address || organization.address || '—', inline: false },
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
  const text = stripContractPhone(String(contract?.contract_text || '').trim()).slice(0, 4000);
  return { type: 9, data: { custom_id: `panel:contracts:copy:modal:${String(contract?.id || '')}`, title: `Contract ${String(contract?.contract_number || '').slice(0, 28)}`, components: [{ type: 1, components: [{ type: 4, custom_id: 'contract_text', label: 'Contract generat · Ctrl+A / Ctrl+C', style: 2, required: true, value: text, max_length: 4000 }]}] } };
}

async function loadSavedContract(db: any, context: any, contractId: string) {
  const { data: contract, error: contractError } = await db.from('organization_contracts').select('id,employee_id,contract_number,contract_text,position,salary,schedule,start_date,created_by_discord_id,discord_message_id,discord_message_ids').eq('organization_id', context.organization.id).eq('id', contractId).maybeSingle();
  if (contractError) throw contractError;
  if (!contract) return null;
  const { data: employee, error: employeeError } = await db.from('organization_employees').select('full_name,cnp,discord_id').eq('organization_id', context.organization.id).eq('id', contract.employee_id).maybeSingle();
  if (employeeError) throw employeeError;
  return { ...contract, employee_name: employee?.full_name || 'Angajat', cnp: employee?.cnp || '—', manager: context.displayName };
}

async function handleContractSubmit(db: any, context: any, values: Record<string, any>) {
  const employeeName = contractValue(values.employee_name, '');
  const cnp = contractValue(values.cnp, '');
  if (!employeeName) return interactionMessage('Numele și prenumele sunt obligatorii.');
  if (!cnp) return interactionMessage('CNP-ul angajatului este obligatoriu.');
  const { data: templateSetting, error: templateError } = await db.from('app_settings').select('value').eq('organization_id', context.organization.id).eq('key', 'contract_template').maybeSingle();
  if (templateError) throw templateError;
  const custom = templateSetting?.value && typeof templateSetting.value === 'object' ? templateSetting.value : {};
  const defaults = custom.defaults && typeof custom.defaults === 'object' ? custom.defaults : {};
  const today = romanianDisplayDate();
  const contractNumber = await nextContractNumber(db, String(context.organization.id), today);
  const contract = {
    employee_name: employeeName,
    cnp,
    position: contractValue(defaults.position, 'Angajat'),
    address: contractValue(defaults.address, context.organization.address || '—'),
    salary: contractValue(defaults.salary, '100 lei/lună'),
    schedule: contractValue(defaults.schedule, '20:00-23:00'),
    start_date: contractValue(defaults.start_date, today),
    contract_number: contractNumber,
    manager: context.displayName,
  };
  const template = stripContractPhone(String(custom.template || contractTemplateFallback()).trim().slice(0, 50000));
  const contractText = replaceContractPlaceholders(template, {
    COMPANY: contractValue(context.organization.name, 'Organizație'),
    ADDRESS: contract.address,
    MANAGER: contract.manager,
    EMPLOYEE_NAME: contract.employee_name,
    CNP: contract.cnp,
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
  const { data: saved, error: contractError } = await db.from('organization_contracts').insert({ organization_id: context.organization.id, employee_id: employee.id, contract_number: contract.contract_number, contract_text: contractText, position: contract.position, salary: contract.salary, schedule: contract.schedule, start_date: contract.start_date, created_by_discord_id: context.discordId }).select('id').single();
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
  const delivery = await deliverDiscordRoute(db, context.settings, context.logRouteKey, payload, { postOnly: true, organizationId: String(context.organization.id), messageKey: `contract-${String(contract.id)}`, retryPayload: JSON.parse(payload) });
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
  const routeKey = context.logRouteKey || (kind === 'sanction' ? disciplineFineLogRoute(context.audience) : DISCIPLINE_LOG_ROUTES[context.audience]);
  const destinations = routeCandidates(context.settings, routeKey);
  if (!destinations.some((item: any) => item.candidates.length)) throw new Error(`Canalul Discord pentru ${routeKey} nu este configurat.`);
  const payload = JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [disciplineEmbed(record, kind, context, action)], components: disciplineComponents(context.audience, kind, String(record.id)) });
  const delivery = await deliverDiscordRoute(db, context.settings, routeKey, payload, { messageIds: record.discord_message_id ? { [context.target]: String(record.discord_message_id) } : {}, organizationId: String(context.organization.id), messageKey: `discipline-${kind}-${String(record.id)}`, retryPayload: JSON.parse(payload) });
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
  const routeKey = 'log_announcements_organization';
  const destinations = routeCandidates(context.settings, routeKey);
  if (!destinations.some((item: any) => item.candidates.length)) return interactionMessage('Acțiunea a fost salvată în Supabase, dar canalul „Log anunțuri organizație” nu este configurat.');
  const actionPayload = { allowed_mentions: { parse: [] }, embeds: [actionEmbed(record, context)], components: actionComponents(String(record.id)) };
  const delivery = await deliverDiscordRoute(db, context.settings, routeKey, JSON.stringify(actionPayload), { organizationId: String(context.organization.id), messageKey: `action-${String(record.id)}`, retryPayload: actionPayload });
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
  await requireActiveOrganizationAccess(db, organization);
  const discordOnly = packageSetting?.value?.code === 'discord';
  if (!resolvePackageFeatures(packageSetting?.value || {}).includes('stash')) throw new Error('Stash nu este inclus în pachetul organizației.');
  const target = String(guild.kind || '') === 'secondary' ? 'secondary' : 'primary';
  const controlRouteKey = ['stash_requests', 'stash_donations'].includes(routeKey) ? 'stash' : routeKey;
  const messageId = interactionMessageId(interaction);
  const legacyRouteAllowed = ['stash_requests', 'stash_donations'].includes(routeKey) && await routeChannelMatches(db, guild.organization_id, settings, routeKey, target, channelId, messageId);
  if (!(await routeChannelMatches(db, guild.organization_id, settings, controlRouteKey, target, channelId, messageId)) && !legacyRouteAllowed && !(controlRouteKey === 'log_stash' && await routeChannelMatches(db, guild.organization_id, settings, 'log_stash', target, channelId, messageId))) throw new Error(`Acest canal nu este configurat pentru panoul ${controlRouteKey === 'stash' ? 'Stash' : 'Log stash'}.`);
  const memberRoles = new Set((interaction.member?.roles || []).map((role: unknown) => String(role)));
  const { data: mappings, error: mappingsError } = await db.from('organization_role_mappings').select('discord_role_id,panel_role,priority').eq('organization_id', guild.organization_id).eq('guild_id', guildId).eq('enabled', true);
  if (mappingsError) throw mappingsError;
  const { data: member, error: memberError } = await db.from('organization_members').select('panel_role').eq('organization_id', guild.organization_id).eq('discord_id', discordId).eq('active', true).maybeSingle();
  if (memberError) throw memberError;
  const roleIds = new Set(member?.panel_role ? [...memberRoles, ...(mappings || []).filter((row: any) => String(row.panel_role || '').toLowerCase() === String(member.panel_role).toLowerCase()).map((row: any) => String(row.discord_role_id))] : [...memberRoles]);
  const platformAdmin = await isPlatformAdminAccount(db, discordId);
  const configured = Array.isArray(permissionSetting?.value?.[`stash.${permission}`]) ? permissionSetting.value[`stash.${permission}`].map(String) : [];
  if (!platformAdmin && !member && !(mappings || []).some((row: any) => roleIds.has(String(row.discord_role_id)))) throw new Error('Contul tău nu este membru activ al acestei organizații.');
  const displayName = String(interaction.member?.nick || user.global_name || user.username || discordId).trim().slice(0, 120) || discordId;
  return { guildId, channelId, target, discordId, displayName, organization, settings, logRouteKey: 'log_stash' };
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
  const payload = stashApprovalEmbed(kind, row);
  const delivery = await deliverDiscordRoute(db, context.settings, 'stash', JSON.stringify(payload), { postOnly: true, organizationId: String(context.organization.id), messageKey: `stash-${kind}-pending-${String(row.id)}`, retryPayload: payload });
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
    const payload = { allowed_mentions: { parse: [] }, embeds: [{ title: decision === 'approved' ? '✅ Cerere Stash aprobată' : '❌ Cerere Stash respinsă', fields: [{ name: 'Articol', value: String(data.item_title), inline: true }, { name: 'Număr iteme', value: String(data.quantity), inline: true }, { name: 'Solicitat de', value: String(data.requested_by_name), inline: true }, { name: 'Status', value: decision === 'approved' ? 'Aprobată' : 'Respinsă', inline: true }], color: decision === 'approved' ? 0x22c55e : 0xef4444, timestamp: now }] };
    const delivery = await deliverDiscordRoute(db, context.settings, 'log_stash', JSON.stringify(payload), { postOnly: true, organizationId: String(context.organization.id), messageKey: `stash-request-${String(data.id)}-${decision}`, retryPayload: payload });
    const messageIds = Object.fromEntries((delivery.results || []).filter((item: any) => item.id).map((item: any) => [item.target, String(item.id)]));
    if (Object.keys(messageIds).length) await db.from('organization_stash_requests').update({ discord_message_ids: messageIds }).eq('organization_id', context.organization.id).eq('id', id);
    return interactionMessage(`Cererea a fost ${decision === 'approved' ? 'aprobată' : 'respinsă'} și logul a fost actualizat.`);
  }
  if (decision === 'approved') {
    const { data: item, error: itemError } = await db.from('organization_stash_items').insert({ organization_id: context.organization.id, title: row.title, category: row.category || 'General', quantity: row.quantity, unit: 'buc.', description: row.note || '', status: 'available', source_type: 'donation', created_by_discord_id: row.donated_by_discord_id, created_by_name: row.donated_by_name, updated_by_discord_id: context.discordId, created_at: now, updated_at: now }).select('*').single();
    if (itemError) throw itemError;
    const { data: donation, error } = await db.from('organization_stash_donations').update({ status: 'approved', reviewed_by_discord_id: context.discordId, reviewed_by_name: context.displayName, reviewed_at: now, stash_item_id: item.id, updated_at: now }).eq('organization_id', context.organization.id).eq('id', id).eq('status', 'pending').select('*').single();
    if (error) throw error;
    const itemPayload = { allowed_mentions: { parse: [] }, embeds: [{ title: '✅ Donație aprobată și adăugată în Stash', fields: [{ name: 'Articol', value: String(item.title), inline: true }, { name: 'Categorie', value: String(item.category), inline: true }, { name: 'Număr iteme', value: String(item.quantity), inline: true }, { name: 'Donat de', value: String(donation.donated_by_name), inline: true }, { name: 'Status', value: 'Disponibil', inline: true }], color: 0x22c55e, timestamp: now }], components: [{ type: 1, components: [{ type: 2, style: 4, label: 'Șterge articolul', custom_id: `panel:stash:delete_item:${item.id}` }] }] };
    const itemDelivery = await deliverDiscordRoute(db, context.settings, 'log_stash', JSON.stringify(itemPayload), { postOnly: true, organizationId: String(context.organization.id), messageKey: `stash-item-${String(item.id)}-approved`, retryPayload: itemPayload });
    const itemMessageIds = Object.fromEntries((itemDelivery.results || []).filter((entry: any) => entry.id).map((entry: any) => [entry.target, String(entry.id)]));
    if (Object.keys(itemMessageIds).length) await db.from('organization_stash_items').update({ discord_message_ids: itemMessageIds }).eq('organization_id', context.organization.id).eq('id', item.id);
    const donationPayload = { allowed_mentions: { parse: [] }, embeds: [{ title: '✅ Donație Stash aprobată', fields: [{ name: 'Articol', value: String(donation.title), inline: true }, { name: 'Număr iteme', value: String(donation.quantity), inline: true }, { name: 'Donat de', value: String(donation.donated_by_name), inline: true }, { name: 'Status', value: 'Aprobată', inline: true }], color: 0x22c55e, timestamp: now }] };
    const donationDelivery = await deliverDiscordRoute(db, context.settings, 'log_stash', JSON.stringify(donationPayload), { postOnly: true, organizationId: String(context.organization.id), messageKey: `stash-donation-${String(donation.id)}-approved`, retryPayload: donationPayload });
    const donationMessageIds = Object.fromEntries((donationDelivery.results || []).filter((entry: any) => entry.id).map((entry: any) => [entry.target, String(entry.id)]));
    if (Object.keys(donationMessageIds).length) await db.from('organization_stash_donations').update({ discord_message_ids: donationMessageIds }).eq('organization_id', context.organization.id).eq('id', id);
  } else {
    const { data: donation, error } = await db.from('organization_stash_donations').update({ status: 'rejected', reviewed_by_discord_id: context.discordId, reviewed_by_name: context.displayName, reviewed_at: now, updated_at: now }).eq('organization_id', context.organization.id).eq('id', id).eq('status', 'pending').select('*').single();
    if (error) throw error;
    const payload = { allowed_mentions: { parse: [] }, embeds: [{ title: '❌ Donație Stash respinsă', fields: [{ name: 'Articol', value: String(donation.title), inline: true }, { name: 'Număr iteme', value: String(donation.quantity), inline: true }, { name: 'Donat de', value: String(donation.donated_by_name), inline: true }, { name: 'Status', value: 'Respinsă', inline: true }], color: 0xef4444, timestamp: now }] };
    const delivery = await deliverDiscordRoute(db, context.settings, 'log_stash', JSON.stringify(payload), { postOnly: true, organizationId: String(context.organization.id), messageKey: `stash-donation-${String(donation.id)}-rejected`, retryPayload: payload });
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
    const payload = { allowed_mentions: { parse: [] }, embeds: [{ title: '📦 Articol nou în Stash', color: 0x22c55e, fields: [{ name: 'Articol', value: title, inline: true }, { name: 'Categorie', value: String(values.category || 'General').trim(), inline: true }, { name: 'Număr iteme', value: String(quantity), inline: true }, { name: 'Status', value: 'Disponibil', inline: true }, { name: 'Detalii', value: String(values.description || '').trim() || 'Fără detalii.', inline: false }, { name: 'Retrageri recente', value: 'Nu au fost înregistrate retrageri.', inline: false }], footer: { text: `Postat de ${context.displayName}` }, timestamp: now }], components: [{ type: 1, components: [{ type: 2, style: 4, label: 'Șterge articolul', custom_id: `panel:stash:delete_item:${data.id}` }] }] };
    const delivery = await deliverDiscordRoute(db, context.settings, 'log_stash', JSON.stringify(payload), { postOnly: true, organizationId: String(context.organization.id), messageKey: `stash-item-${String(data.id)}-created`, retryPayload: payload });
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
    const absencePayload = { allowed_mentions: { parse: [] }, embeds: [requestEmbed(absence, context, title)] };
    const delivery = await deliverDiscordRoute(db, context.settings, context.logRouteKey, JSON.stringify(absencePayload), { messageIds, messageIdsOnly: true, organizationId: String(context.organization.id), messageKey: `absence-${String(absence.id)}`, retryPayload: absencePayload });
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
  try { await syncAbsenceLiveEmbeds(db, String(context.organization.id), context.settings, context.audience); } catch (error) { console.error('[discord-interactions] absence live embed failed', error); }
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
  const isProposal = postType === 'proposal';
  const { data: created, error: createError } = await db.from(isProposal ? 'community_proposals' : 'community_posts').insert({
    organization_id: context.organization.id,
    audience: context.audience,
    ...(isProposal ? { proposal_status: 'new', proposal_decision_note: '' } : { post_type: postType }),
    title,
    content,
    author_discord_id: context.discordId,
    author_name: context.displayName,
    created_at: now,
    updated_at: now,
  }).select('*').single();
  if (createError) throw createError;
  if (isProposal) created.post_type = 'proposal';
  if (postType === 'poll') {
    const { error: optionsError } = await db.from('community_poll_options').insert(options.map((option, position) => ({ organization_id: context.organization.id, post_id: created.id, option_text: option, position })));
    if (optionsError) throw optionsError;
  }
  const data = await loadCommunityPost(db, String(context.organization.id), String(created.id));
  try {
    const communityBody = communityPayload({ ...data, settings: context.settings });
    const deliveryRoute = isProposal ? 'log_proposals' : context.routeKey;
    const delivery = await deliverDiscordRoute(db, context.settings, deliveryRoute, communityBody, { postOnly: isProposal, organizationId: String(context.organization.id), messageKey: `community-post-${String(created.id)}`, retryPayload: JSON.parse(communityBody), targets: isProposal || context.routeKey === 'proposals' ? [context.target] : undefined });
    await saveCommunityMessageRefs(db, String(context.organization.id), String(created.id), delivery.results || [], isProposal ? 'community_proposals' : 'community_posts');
    return interactionMessage(`Postarea a fost salvată și publicată în ${delivery.results.length} canal${delivery.results.length === 1 ? '' : 'e'} Discord.`);
  } catch (error) {
    console.error('[discord-interactions] community post delivery failed', error);
    return interactionMessage(`Postarea a fost salvată în Supabase, dar nu a putut fi publicată pe Discord: ${error instanceof Error ? error.message : 'eroare necunoscută'}`);
  }
}

async function handleProposalButton(db: any, interaction: any, context: any, parts: string[]) {
  const action = String(parts[3] || '');
  const postId = String(parts[4] || '');
  const data = await loadCommunityPost(db, String(context.organization.id), postId);
  if (data.post.post_type !== 'proposal' || data.post.audience !== context.audience) throw new Error('Propunerea nu aparține acestei organizații.');
  if (action === 'delete') {
    const { error: votesError } = await db.from('community_proposal_votes_v2').delete().eq('organization_id', context.organization.id).eq('proposal_id', postId);
    if (votesError) throw votesError;
    const { error: deleteError } = await db.from('community_proposals').delete().eq('organization_id', context.organization.id).eq('id', postId);
    if (deleteError) throw deleteError;
    const response = await requestDiscordTarget(db, { target: context.target, transport: 'bot', channel_id: context.channelId }, '', { method: 'DELETE', messageId: String(interaction.message?.id || '') });
    if (!response.ok && response.status !== 404) throw new Error('Propunerea a fost ștearsă din Supabase, dar mesajul Discord nu a putut fi șters.');
    return interactionMessage('Propunerea a fost ștearsă.');
  }
  if (['support', 'against'].includes(action)) {
    const { error } = await db.from('community_proposal_votes_v2').upsert({ organization_id: context.organization.id, proposal_id: postId, user_discord_id: context.discordId, display_name: context.displayName, vote: action, updated_at: new Date().toISOString() }, { onConflict: 'proposal_id,user_discord_id' });
    if (error) throw error;
  } else {
    const allowed = ['review', 'accept', 'reject'];
    if (!allowed.includes(action)) return interactionMessage('Acțiunea propunerii nu este disponibilă.');
    const { error } = await db.from('community_proposals').update({ proposal_status: action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : 'review', proposal_decision_note: `Actualizat de ${context.displayName}`, updated_at: new Date().toISOString() }).eq('organization_id', context.organization.id).eq('id', postId);
    if (error) throw error;
  }
  const refreshed = await loadCommunityPost(db, String(context.organization.id), postId);
  const payload = JSON.parse(communityPayload({ ...refreshed, settings: context.settings }));
  const response = await requestDiscordTarget(db, { target: context.target, transport: 'bot', channel_id: context.channelId }, JSON.stringify(payload), { method: 'PATCH', messageId: String(interaction.message?.id || '') });
  if (!response.ok) throw new Error('Propunerea a fost salvată, dar embedul nu a putut fi actualizat.');
  const logPayload = { allowed_mentions: { parse: [] }, embeds: [{ title: `${action === 'support' ? '✅ Vot pentru' : action === 'against' ? '❌ Vot contra' : proposalStatusLabel(refreshed.post.proposal_status)} · Propunere`, description: String(refreshed.post.title || 'Propunere'), color: 0xa855f7, fields: [{ name: '👤 Membru', value: context.displayName, inline: true }, { name: '📌 Status', value: proposalStatusLabel(refreshed.post.proposal_status), inline: true }], timestamp: new Date().toISOString() }] };
  await deliverDiscordRoute(db, context.settings, 'log_proposals', JSON.stringify(logPayload), { postOnly: true, organizationId: String(context.organization.id), messageKey: `proposal-log-${postId}-${context.discordId}-${action}`, retryPayload: logPayload, targets: [context.target] }).catch((error) => console.error('[discord-interactions] proposal log failed', error));
  return interactionMessage(action === 'support' ? 'Votul „Susțin” a fost înregistrat.' : action === 'against' ? 'Votul „Contra” a fost înregistrat.' : `Propunerea este acum ${proposalStatusLabel(refreshed.post.proposal_status)}.`);
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

  if (action === 'read') {
    const { error } = await db.from('community_post_reads').upsert({ organization_id: context.organization.id, post_id: postId, user_discord_id: context.discordId, display_name: context.displayName, confirmed_at: new Date().toISOString() }, { onConflict: 'post_id,user_discord_id' });
    if (error) throw error;
    const refreshed = await loadCommunityPost(db, String(context.organization.id), postId);
    const response = await requestDiscordTarget(db, { target: context.target, transport: 'bot', channel_id: context.channelId }, communityPayload({ ...refreshed, settings: context.settings }), { method: 'PATCH', messageId: String(interaction.message?.id || '') });
    if (!response.ok) throw new Error('Confirmarea a fost salvată, dar embedul nu a putut fi actualizat.');
    return interactionMessage('Confirmarea „Am citit” a fost înregistrată, iar embedul a fost actualizat.');
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

async function sendActionNotification(db: any, settings: any, embed: any, messageIds: Record<string, string> = {}, organizationId = '', messageKey = '') {
  const destinations = routeCandidates(settings, 'log_pontaj');
  if (!destinations.some((item) => item.candidates.length)) return { error: 'Canalul „Log pontaj” nu este configurat pentru această organizație.', messageIds: {} };
  try {
    const pontajPayload = { allowed_mentions: { parse: [] }, embeds: [embed] };
    const delivery = await deliverDiscordRoute(db, settings, 'log_pontaj', JSON.stringify(pontajPayload), { messageIds, messageIdsOnly: true, organizationId, messageKey, retryPayload: pontajPayload });
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
  const parts = romanianParts(now);
  const today = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const weekday = today.getUTCDay();
  const monday = new Date(today);
  monday.setUTCDate(monday.getUTCDate() - (weekday === 0 ? 6 : weekday - 1));
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  const start = monday.toISOString().slice(0, 10);
  const end = sunday.toISOString().slice(0, 10);
  const [{ data: shifts, error }, { data: employee, error: employeeError }, { data: templateSetting, error: templateError }] = await Promise.all([
    db.from('shifts').select('date,shift_type,status,duration,duration_ms,started_at,ended_at,paused_at,paused_seconds').eq('organization_id', context.organization.id).eq('discord_id', context.discordId).gte('date', start).lte('date', end).order('date', { ascending: true }).order('created_at', { ascending: true }).limit(100),
    db.from('organization_employees').select('id').eq('organization_id', context.organization.id).eq('discord_id', context.discordId).maybeSingle(),
    db.from('app_settings').select('value').eq('organization_id', context.organization.id).eq('key', 'contract_template').maybeSingle(),
  ]);
  if (error) throw error;
  if (employeeError) throw employeeError;
  if (templateError) throw templateError;
  const rows = shifts || [];
  let salary = monthlySalary(templateSetting?.value?.defaults?.salary);
  if (employee?.id) {
    const { data: contract, error: contractError } = await db.from('organization_contracts').select('salary,created_at').eq('organization_id', context.organization.id).eq('employee_id', employee.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (contractError) throw contractError;
    salary = monthlySalary(contract?.salary) ?? salary;
  }
  const secondsForShift = (shift: any) => {
    if (['active', 'paused'].includes(String(shift.status))) return workedSeconds(shift, now);
    const durationMs = Number(shift.duration_ms);
    if (Number.isFinite(durationMs) && durationMs >= 0) return Math.floor(durationMs / 1000);
    const match = /^(\d+):(\d{2}):(\d{2})$/.exec(String(shift.duration || ''));
    return match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) : 0;
  };
  const secondsByDate = new Map<string, { total: number; day: number; night: number; shifts: number }>();
  for (const shift of rows) {
    const date = String(shift.date || '');
    const value = secondsByDate.get(date) || { total: 0, day: 0, night: 0, shifts: 0 };
    const seconds = secondsForShift(shift);
    value.total += seconds;
    value.shifts += 1;
    if (String(shift.shift_type) === 'zi') value.day += seconds;
    if (String(shift.shift_type) === 'noapte') value.night += seconds;
    secondsByDate.set(date, value);
  }
  const total = [...secondsByDate.values()].reduce((sum, value) => sum + value.total, 0);
  const day = [...secondsByDate.values()].reduce((sum, value) => sum + value.day, 0);
  const night = [...secondsByDate.values()].reduce((sum, value) => sum + value.night, 0);
  const salaryTotal = salary == null ? null : { amount: (total / 3600) * salary.amount, currency: salary.currency };
  const active = rows.find((shift: any) => ['active', 'paused'].includes(String(shift.status)));
  const activeLabel = active ? `${active.status === 'paused' ? 'În pauză' : 'În tură'} · ${String(active.shift_type || '').toUpperCase()} · ${formatDuration(workedSeconds(active, now))}` : 'Nicio tură activă';
  const dayNames = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];
  const dailyFields = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setUTCDate(date.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    const value = secondsByDate.get(key) || { total: 0, day: 0, night: 0, shifts: 0 };
    const label = `${dayNames[date.getUTCDay()]} · ${String(date.getUTCDate()).padStart(2, '0')}.${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    return { name: label, value: value.shifts ? `Total: **${formatDuration(value.total)}** · Zi: ${formatDuration(value.day)} · Noapte: ${formatDuration(value.night)} · ${value.shifts} tur${value.shifts === 1 ? 'ă' : 'e'}` : 'Fără ture înregistrate.', inline: false };
  });
  return interactionMessage('', { embeds: [{ title: `📊 Pontajul meu · ${context.organization.name}`, color: 3447003, fields: [
    { name: 'Săptămâna', value: `${start} – ${end}`, inline: false },
    ...dailyFields,
    { name: 'Total lucrat', value: `**${formatDuration(total)}**`, inline: true },
    { name: 'Total de plată', value: salaryTotal == null ? 'Salariul nu este configurat.' : `**${money(salaryTotal)}**`, inline: true },
    { name: 'Ture de zi', value: formatDuration(day), inline: true },
    { name: 'Ture de noapte', value: formatDuration(night), inline: true },
    { name: 'Status curent', value: activeLabel, inline: false },
  ], footer: { text: 'Panel Pro · datele sunt salvate în Supabase' }, timestamp: now.toISOString() }] });
}

async function handleButton(db: any, interaction: any, context: any, action: string) {
  const orgId = String(context.organization.id);
  if (action === 'shift_day' || action === 'shift_night') {
    return interactionMessage('Tura se stabilește automat când apeși **Start**, după ora României și programul configurat în panel.');
  }
  if (action === 'my_stats') return myStats(db, context);
  if (!['start', 'pause', 'stop'].includes(action)) return interactionMessage('Acest buton Pontaj nu este încă disponibil.');

  const current = await activeShift(db, orgId, context.discordId);
  if (action === 'start') {
    if (current) return interactionMessage('Ai deja o tură activă. Folosește **Pauză** sau **Stop**.');
    const now = new Date();
    const { data: pontajSetting } = await db.from('app_settings').select('value').eq('organization_id', orgId).eq('key', 'pontaj_config').maybeSingle();
    const shiftType = automaticShiftType(pontajSetting?.value || {}, now);
    const configuredTime = shiftType === 'noapte'
      ? String(pontajSetting?.value?.nightEndTime || '23:00')
      : String(pontajSetting?.value?.dayEndTime || '19:59');
    const { data: created, error } = await db.from('shifts').insert({ organization_id: orgId, discord_id: context.discordId, colleague_name: context.displayName, date: romanianDate(now), start_time: romanianTime(now), end_time: null, duration: '00:00:00', duration_ms: 0, shift_type: shiftType, status: 'active', started_at: now.toISOString(), auto_stop_at: shiftDeadline(shiftType, now, configuredTime).toISOString(), paused_seconds: 0, paused_at: null, stop_reason: null, created_at: now.toISOString(), updated_at: now.toISOString() }).select('*').single();
    if (error) throw error;
    const logResult = await sendActionNotification(db, context.settings, shiftLogEmbed(created, context, 'started', now), {}, String(context.organization.id), `shift-${String(created.id)}`);
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
    const logResult = await sendActionNotification(db, context.settings, shiftLogEmbed(data, context, paused ? 'paused' : 'resumed', now), current.discord_log_message_ids || {}, String(context.organization.id), `shift-${String(current.id)}`);
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
  const logResult = await sendActionNotification(db, context.settings, shiftLogEmbed(data, context, 'completed', now), current.discord_log_message_ids || {}, String(context.organization.id), `shift-${String(current.id)}`);
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
          const panelPayload = controlPayload(routeKey, trialText, !premiumActive, routeKey === 'proposals' ? (target === 'secondary' ? 'organization' : 'departments') : '');
          await deliverDiscordRoute(db, { discord_channel_routes: settings.discord_channel_routes }, routeKey, JSON.stringify(panelPayload), { postOnly: true, organizationId: String(guild.organization_id), messageKey: `${routeKey}-control`, retryPayload: panelPayload });
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
  const isCommand = Number(interaction?.type) === 2;
  const isButton = isComponent && Number(interaction?.data?.component_type || 2) === 2;
  const isSelect = isComponent && [3, 5].includes(Number(interaction?.data?.component_type || 0));
  const isModalSubmit = Number(interaction?.type) === 5;
  const isPontaj = customId.startsWith('panel:pontaj:');
  const isRequests = customId.startsWith('panel:requests:');
  const isContracts = customId.startsWith('panel:contracts:');
  const isAnnouncements = customId.startsWith('panel:announcements:');
  const isProposals = customId.startsWith('panel:proposals:');
  const isDiscipline = customId.startsWith('panel:discipline:');
  const isActions = customId.startsWith('panel:actions:');
  const isStash = customId.startsWith('panel:stash:');
  const isMarketplace = customId.startsWith('panel:marketplace:');
  const isDiscovery = customId.startsWith('panel:discovery:');
  const isCalculator = customId.startsWith('panel:calculator:');
  const isIllegalLocations = customId.startsWith('panel:illegal_locations:');
  const isWheel = customId.startsWith('panel:wheel:');
  const isPresenceEvents = customId.startsWith('panel:presence_events:');
  const isTasks = customId.startsWith('panel:tasks:');
  const isCustomModule = customId.startsWith('panel:custom:');
  if (isCommand) {
    const commandKey = customModuleKey(interaction?.data?.name);
    if (commandKey) {
      const commandSecret = serviceKey();
      if (!commandSecret) return reply(interactionMessage('Cheia secretă Supabase lipsește.'));
      const commandDb = createClient(Deno.env.get('SUPABASE_URL')!, commandSecret);
      const commandModule = await loadCustomModule(commandDb, commandKey);
      if (!commandModule) return reply(interactionMessage('Modulul nu mai există sau este dezactivat.'));
      const commandModal = customModuleModal(commandModule, 'slash');
      if (commandModal) return reply(commandModal);
      return reply({ type: 4, data: { embeds: [customModulePayload(commandModule).embeds[0]], flags: 64 } });
    }
    return reply(interactionMessage('Comanda Panel Pro nu este disponibilă.'));
  }
  if (!isComponent && !isModalSubmit) return reply(interactionMessage('Acest tip de interacțiune nu este disponibil.'));
  if (isTasks && isButton && ['accept', 'refuse'].includes(String(customId.split(':')[2] || ''))) {
    const secret = serviceKey();
    if (!secret) return reply(interactionMessage('Cheia secretă Supabase lipsește.'));
    const db = createClient(Deno.env.get('SUPABASE_URL')!, secret);
    const deferred = await deferInteraction(interaction, false);
    let result;
    try { result = await handleTaskDmAction(db, interaction, String(customId.split(':')[2]), String(customId.split(':')[3] || '')); }
    catch (error) { result = interactionMessage(readableError(error, 'Răspunsul la task nu a putut fi salvat.')); }
    await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
    return new Response(null, { status: 204 });
  }
  if (!isPontaj && !isRequests && !isContracts && !isAnnouncements && !isProposals && !isDiscipline && !isActions && !isStash && !isMarketplace && !isDiscovery && !isCalculator && !isIllegalLocations && !isWheel && !isPresenceEvents && !isTasks && !isCustomModule) return reply(interactionMessage('Acest buton nu aparține unui modul Panel Pro.'));

  if (isTasks) {
    const secret = serviceKey();
    if (!secret) return reply(interactionMessage('Cheia secretă Supabase lipsește.'));
    const db = createClient(Deno.env.get('SUPABASE_URL')!, secret);
    let context: any;
    try { context = await resolveUniversalModuleContext(db, interaction, 'tasks', 'core'); }
    catch (error) { return reply(interactionMessage(readableError(error, 'Taskurile nu sunt disponibile pe acest canal.'))); }
    if (!isDiscordManager(interaction) && !(await isPlatformAdminAccount(db, context.discordId))) return reply(interactionMessage('Doar un administrator poate crea taskuri.'));
    if (isButton && customId.split(':')[2] === 'create') return reply(interactionMessage('Selectează angajatul sau angajații care vor primi taskul:', { components: [{ type: 1, components: [{ type: 5, custom_id: 'panel:tasks:select_assignees', placeholder: 'Alege membri din acest server', min_values: 1, max_values: 10 }] }] }));
    if (isSelect && customId.split(':')[2] === 'select_assignees') {
      const assigneeIds = [...new Set((Array.isArray(interaction.data?.values) ? interaction.data.values : []).map(taskUserId).filter((value: string) => /^\d{15,22}$/.test(value)))];
      if (!assigneeIds.length) return reply(interactionMessage('Selectează cel puțin un membru.'));
      const { data: draft, error: draftError } = await db.from('platform_task_drafts').insert({ organization_id: context.organization.id, guild_id: context.guildId, created_by_discord_id: context.discordId, assignee_ids: assigneeIds }).select('id').single();
      if (draftError) throw draftError;
      return reply(taskModal(String(draft.id)));
    }
    if (isModalSubmit && customId.split(':')[2] === 'submit') {
      const deferred = await deferInteraction(interaction, false);
      let result;
      try {
        const draftId = String(customId.split(':')[3] || '');
        const { data: draft, error: draftError } = await db.from('platform_task_drafts').select('id,assignee_ids,expires_at').eq('id', draftId).eq('organization_id', context.organization.id).eq('created_by_discord_id', context.discordId).maybeSingle();
        if (draftError) throw draftError;
        if (!draft || new Date(String(draft.expires_at || '')).getTime() <= Date.now()) throw new Error('Selecția angajaților a expirat. Începe din nou crearea taskului.');
        const values = modalValues(interaction);
        values.assignee = (Array.isArray(draft.assignee_ids) ? draft.assignee_ids : []).join(',');
        result = await createTask(db, context, values);
        await db.from('platform_task_drafts').delete().eq('id', draft.id);
      }
      catch (error) { result = interactionMessage(readableError(error, 'Taskul nu a putut fi creat.')); }
      await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
      return new Response(null, { status: 204 });
    }
    return reply(interactionMessage('Acțiunea pentru task nu este disponibilă.'));
  }

  if (isCalculator) {
    const parts = customId.split(':');
    const kind = calculatorKind(parts[2]);
    if (!kind) return reply(interactionMessage('Tipul calculatorului nu este valid.'));
    const routeKey = kind === 'illegal' ? 'illegal_calculator' : 'calculator';
    const feature = kind === 'illegal' ? 'illegal_calculator' : 'legal_tools';
    const secret = serviceKey();
    if (!secret) return reply(interactionMessage('Cheia secretă Supabase lipsește.'));
    const db = createClient(Deno.env.get('SUPABASE_URL')!, secret);
    try { await resolveUniversalModuleContext(db, interaction, routeKey, feature); }
    catch (error) { return reply(interactionMessage(readableError(error, 'Calculatorul nu este disponibil pe acest canal.'))); }
    if (parts[3] === 'start' || parts[3] === 'categories') return reply(calculatorStartMessage(kind));
    if (parts[3] === 'category' && isSelect) {
      const categoryId = String(interaction.data?.values?.[0] || '');
      if (!findCategory(kind, categoryId)) return reply(interactionMessage('Categoria selectată nu este validă.'));
      return reply(interactionMessage('', { content: 'Alege articolul pentru calcul:', components: calculatorRows(kind, categoryId, 0) }));
    }
    if (parts[3] === 'page') return reply(interactionMessage('', { content: 'Alege articolul pentru calcul:', components: calculatorRows(kind, parts[4], Math.max(0, Number(parts[5]) || 0)) }));
    if (parts[3] === 'mushroom_mode' && kind === 'illegal') return reply(interactionMessage('', { content: 'Alege materialul pe care îl ai disponibil:', components: mushroomMaterialRows() }));
    if (parts[3] === 'mushroom_material' && kind === 'illegal' && isSelect) {
      const materialId = String(interaction.data?.values?.[0] || '');
      if (!mushroomAvailableMaterials.some((item) => item.id === materialId)) return reply(interactionMessage('Materialul selectat nu este valid.'));
      return reply(calculatorAvailableQuantityModal(materialId));
    }
    if (parts[3] === 'item' && isSelect) {
      const categoryId = String(parts[4] || '');
      const recipeId = String(interaction.data?.values?.[0] || '');
      if (!findRecipe(kind, categoryId, recipeId)) return reply(interactionMessage('Articolul selectat nu este valid.'));
      if (kind === 'illegal' && ['plicuri', 'marijuana'].includes(categoryId)) return reply(calculatorResourceQuantityModal(categoryId, recipeId));
      return reply(calculatorQuantityModal(kind, categoryId, recipeId));
    }
    if (parts[3] === 'quantity_again' && isButton) return reply(calculatorQuantityModal(kind, String(parts[4] || ''), String(parts[5] || '')));
    if (parts[3] === 'quantity' && isModalSubmit) {
      const categoryId = String(parts[4] || '');
      const recipeId = String(parts[5] || '');
      const quantity = Math.floor(Number(modalValues(interaction).quantity || 0));
      if (!findRecipe(kind, categoryId, recipeId) || !Number.isFinite(quantity) || quantity < 1 || quantity > 100000) return reply(interactionMessage('Introdu o cantitate între 1 și 100.000.'));
      return reply(calculatorResultMessage(kind, categoryId, recipeId, quantity));
    }
    if (parts[3] === 'resource_quantity' && isModalSubmit && kind === 'illegal') {
      const categoryId = String(parts[4] || '');
      const recipeId = String(parts[5] || '');
      const quantity = Number(modalValues(interaction).quantity || 0);
      if (!['plicuri', 'marijuana'].includes(categoryId) || !findRecipe(kind, categoryId, recipeId) || !Number.isFinite(quantity) || quantity < 1 || quantity > 1000000) return reply(interactionMessage('Introdu o cantitate între 1 și 1.000.000.'));
      return reply(calculatorResourceResultMessage(categoryId, recipeId, quantity));
    }
    if (parts[3] === 'quantity_available' && isModalSubmit && kind === 'illegal') {
      const materialId = String(parts[4] || '');
      const quantity = Math.floor(Number(modalValues(interaction).quantity || 0));
      if (!mushroomAvailableMaterials.some((item) => item.id === materialId) || !Number.isFinite(quantity) || quantity < 1 || quantity > 100000) return reply(interactionMessage('Introdu o cantitate între 1 și 100.000.'));
      return reply(calculatorAvailableResultMessage(materialId, quantity));
    }
    return reply(calculatorStartMessage(kind));
  }

  if (isIllegalLocations) {
    const secret = serviceKey();
    if (!secret) return reply(interactionMessage('Cheia secretă Supabase lipsește.'));
    const db = createClient(Deno.env.get('SUPABASE_URL')!, secret);
    try { await resolveUniversalModuleContext(db, interaction, 'illegal_locations', 'illegal_locations'); }
    catch (error) { return reply(interactionMessage(readableError(error, 'Locațiile ilegale nu sunt disponibile pe acest canal.'))); }
    const parts = customId.split(':');
    const mapKey = parts[2] === 'map' ? String(parts[3] || '') : '';
    return reply(illegalLocationsMessage(mapKey));
  }

  if (isWheel) {
    const secret = serviceKey();
    if (!secret) return reply(interactionMessage('Cheia secretă Supabase lipsește.'));
    const db = createClient(Deno.env.get('SUPABASE_URL')!, secret);
    const deferred = await deferInteraction(interaction, false);
    let result;
    let context;
    try {
      context = await resolveWheelContext(db, interaction);
      const action = customId.split(':')[2] === 'start' ? 'start' : 'status';
      const { data: active, error: activeError } = await db.from('wheel_timers').select('*').eq('organization_id', context.organization.id).eq('discord_id', context.discordId).eq('status', 'active').maybeSingle();
      if (activeError) throw new Error('Nu am putut verifica timerul. Încearcă din nou.');
      if (active && Date.parse(String(active.completes_at || '')) <= Date.now()) {
        await db.from('wheel_timers').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', active.id).eq('status', 'active');
      }
      if (action === 'status') result = wheelPrivateMessage(active && Date.parse(String(active.completes_at || '')) > Date.now() ? active : null);
      else if (active && Date.parse(String(active.completes_at || '')) > Date.now()) result = wheelPrivateMessage(active);
      else {
        const started = new Date();
        const completes = new Date(started.getTime() + 6 * 60 * 60 * 1000);
        const { data: timer, error: insertError } = await db.from('wheel_timers').insert({ organization_id: context.organization.id, discord_id: context.discordId, started_at: started.toISOString(), completes_at: completes.toISOString() }).select('*').single();
        if (insertError) throw insertError;
        result = wheelPrivateMessage(timer);
      }
    } catch (error) {
      console.error('[discord-interactions] wheel timer failed', error);
      result = interactionMessage(readableError(error, 'Timerul nu este disponibil pe acest canal.'));
    }
    await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
    return new Response(null, { status: 204 });
  }

  if (isPresenceEvents) {
    const secret = serviceKey();
    if (!secret) return reply(interactionMessage('Cheia secretă Supabase lipsește.'));
    const db = createClient(Deno.env.get('SUPABASE_URL')!, secret);
    const module = standardPresenceEventModule();
    let deferred: any = null;
    try {
      const action = String(customId.split(':')[2] || '');
      if (isButton && ['present', 'cancel', 'close'].includes(action)) deferred = await deferInteraction(interaction, false);
      let context: any;
      try {
        context = await resolveUniversalModuleContext(db, interaction, 'presence_events', 'event_reminders');
      } catch (primaryError) {
        if (!['present', 'cancel', 'close'].includes(action)) throw primaryError;
        context = await resolveUniversalModuleContext(db, interaction, 'log_presence_events', 'event_reminders');
      }
      const routes = context.settings?.discord_channel_routes || {};
      const logRoute = routes.log_presence_events || {};
      const controlRoute = routes.presence_events || {};
      const logTarget = logRoute?.[context.target] || Object.values(logRoute).find((route: any) => String(route?.channel_id || '').trim());
      const controlTarget = controlRoute?.[context.target] || Object.values(controlRoute).find((route: any) => String(route?.channel_id || '').trim());
      context.publication = { embed_channel_id: String((controlTarget as any)?.channel_id || context.channelId), result_channel_id: String((logTarget as any)?.channel_id || ''), message_id: String(interaction.message?.id || '') };
      if (isButton && action === 'create') return reply(standardPresenceEventModal());
      if (isButton && ['present', 'cancel', 'close'].includes(action)) {
        let result;
        try {
          const resolvedAction = action === 'close' ? 'close_event' : action === 'cancel' ? 'cancel' : 'present';
          result = await handlePresenceEventAction(db, context, module, resolvedAction, interaction);
        }
        catch (error) { result = interactionMessage(readableError(error, 'Acțiunea de prezență nu a putut fi executată.')); }
        await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
        return new Response(null, { status: 204 });
      }
      if (isModalSubmit && action === 'submit') {
        const deferred = await deferInteraction(interaction, false);
        let result;
        try { result = await createPresenceEvent(db, context, module, modalValues(interaction)); }
        catch (error) { result = interactionMessage(readableError(error, 'Evenimentul nu a putut fi creat.')); }
        await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
        return new Response(null, { status: 204 });
      }
    } catch (error) {
      if (deferred) {
        await sendFollowup(deferred.applicationId, deferred.interactionToken, interactionMessage(readableError(error, 'Acțiunea de prezență nu a putut fi executată.')));
        return new Response(null, { status: 204 });
      }
      return reply(interactionMessage(readableError(error, 'Evenimentele cu prezență nu sunt disponibile pe acest canal.')));
    }
  }

  if (isCustomModule) {
    const key = customModuleKey(customId.split(':')[2]);
    if (!key) return reply(interactionMessage('Modulul Panel Pro nu este valid.'));
    const secret = serviceKey();
    if (!secret) return reply(interactionMessage('Cheia secretă Supabase lipsește.'));
    const customDb = createClient(Deno.env.get('SUPABASE_URL')!, secret);
    const module = await loadCustomModule(customDb, key);
    if (!module) return reply(interactionMessage('Modulul nu mai există sau este dezactivat.'));
    const parts = customId.split(':');
    if (isSelect && parts[3] === 'decision_select') {
      const status = parts[4] === 'approved' ? 'approved' : parts[4] === 'rejected' ? 'rejected' : '';
      const submissionId = String(interaction.data?.values?.[0] || '').trim();
      if (!status || !/^[0-9a-f-]{36}$/i.test(submissionId)) return reply(interactionMessage('Selecția deciziei nu este validă.'));
      const deferred = await deferInteraction(interaction, false); let result;
      try { const context = await resolveCustomModulePublication(customDb, interaction, key); assertCustomModulePermission(interaction, module, 'approve', context.publication); await applyCustomDecision(customDb, interaction, module, context, submissionId, status); result = interactionMessage(status === 'approved' ? 'Cererea a fost aprobată.' : 'Cererea a fost respinsă.'); } catch (error) { result = interactionMessage(readableError(error, 'Decizia nu a putut fi salvată.')); }
      await sendFollowup(deferred.applicationId, deferred.interactionToken, result); return new Response(null, { status: 204 });
    }
    if (isButton && parts[3] === 'decision') {
      const submissionId = String(parts[4] || '').trim();
      const status = parts[5] === 'approved' ? 'approved' : parts[5] === 'rejected' ? 'rejected' : '';
      if (!/^[0-9a-f-]{36}$/i.test(submissionId) || !status) return reply(interactionMessage('Decizia modulului nu este validă.'));
      const deferred = await deferInteraction(interaction, false);
      let result;
      try {
        const context = await resolveCustomModulePublication(customDb, interaction, key);
        assertCustomModulePermission(interaction, module, 'approve', context.publication);
        await applyCustomDecision(customDb, interaction, module, context, submissionId, status);
        result = interactionMessage(status === 'approved' ? 'Cererea a fost aprobată.' : 'Cererea a fost respinsă.');
      } catch (error) { result = interactionMessage(readableError(error, 'Decizia nu a putut fi salvată.')); }
      await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
      return new Response(null, { status: 204 });
    }
    if (isButton) {
      const action = String(parts[4] || 'open_form');
      const context = await resolveCustomModulePublication(customDb, interaction, key);
      try { assertCustomModulePermission(interaction, module, 'use', context.publication); } catch (error) { return reply(interactionMessage(readableError(error, 'Nu ai acces la această acțiune.'))); }
      const definition = module.definition && typeof module.definition === 'object' ? module.definition : {};
      const handler = String(definition.handler || '').toLowerCase();
      if (handler === 'prezenta_eveniment' && ['present', 'close_event'].includes(action)) {
        const deferred = await deferInteraction(interaction, false);
        let result;
        try { result = await handlePresenceEventAction(customDb, context, module, action, interaction); }
        catch (error) { console.error('[discord-interactions] presence event action failed', error); result = interactionMessage(readableError(error, 'Acțiunea de prezență nu a putut fi executată.')); }
        await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
        return new Response(null, { status: 204 });
      }
      const pontajActions: Record<string, string> = { start_shift: 'start', pause_shift: 'pause', stop_shift: 'stop', my_stats: 'my_stats' };
      if (handler === 'pontaj' && pontajActions[action]) {
        const deferred = await deferInteraction(interaction, pontajActions[action] === 'my_stats');
        let result;
        try { result = await handleButton(customDb, interaction, context, pontajActions[action]); }
        catch (error) { console.error('[discord-interactions] custom pontaj failed', error); result = interactionMessage(readableError(error, 'Acțiunea Pontaj nu a putut fi executată.')); }
        const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
        if (followupId && pontajActions[action] !== 'my_stats') { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
        return new Response(null, { status: 204 });
      }
      if (handler === 'prezenta' && ['presence', 'presence_report'].includes(action)) {
        const deferred = await deferInteraction(interaction, false);
        let result;
        try {
          if (!context.publication.message_id) throw new Error('Embedul de prezență nu are încă un mesaj publicat.');
          const payload = await customPresencePayload(customDb, module, context);
          const response = await requestDiscordTarget(customDb, { target: context.target, transport: 'bot', channel_id: context.publication.embed_channel_id }, JSON.stringify(payload), { method: 'PATCH', messageId: String(context.publication.message_id) });
          if (!response.ok) throw new Error(`Embedul de prezență nu a putut fi actualizat (HTTP ${response.status}).`);
          result = interactionMessage('Prezența a fost actualizată în embed.');
        } catch (error) { console.error('[discord-interactions] custom presence failed', error); result = interactionMessage(readableError(error, 'Prezența nu a putut fi actualizată.')); }
        await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
        return new Response(null, { status: 204 });
      }
      if (handler === 'prezenta_eveniment' && action === 'create_event') {
        return reply(customModuleModal(module, String(parts[3] || '0')) || interactionMessage('Formularul evenimentului nu este disponibil.'));
      }
      if (action === 'open_form') {
        const modal = customModuleModal(module, String(parts[3] || '0'));
        if (modal) return reply(modal);
      }
      if (action === 'report') {
        const { data: rows } = await customDb.from('platform_module_submissions').select('display_name,status,created_at').eq('organization_id', context.organization.id).eq('module_key', key).order('created_at', { ascending: false }).limit(10);
        const report = Array.isArray(rows) && rows.length ? rows.map((row: any) => `• ${String(row.display_name || 'Membru')} — ${String(row.status || 'submitted')} — ${new Date(row.created_at).toLocaleDateString('ro-RO')}`).join('\n') : 'Nu există cereri înregistrate pentru acest modul.';
        return reply({ type: 4, data: { flags: 64, embeds: [{ title: `Raport · ${String(module.label || 'Modul').slice(0, 240)}`, description: report.slice(0, 4000), color: 0x5865f2 }] } });
      }
      if (action === 'update_message') {
        if (!context.publication.message_id) return reply(interactionMessage('Modulul nu are încă un mesaj publicat care să poată fi actualizat.'));
        const bodyJson = JSON.stringify(customModulePayload(module));
        let response = await requestDiscordTarget(customDb, { target: context.target, transport: 'bot', channel_id: context.publication.embed_channel_id }, bodyJson, { method: 'PATCH', messageId: String(context.publication.message_id) });
        let messageId = String(context.publication.message_id);
        if (!response.ok && [400, 404].includes(response.status)) {
          response = await requestDiscordTarget(customDb, { target: context.target, transport: 'bot', channel_id: context.publication.embed_channel_id }, bodyJson, { method: 'POST' });
          if (response.ok) {
            const sent = await response.json().catch(() => ({}));
            messageId = String(sent?.id || '');
            await customDb.from('platform_module_publications').update({ message_id: messageId || null, updated_at: new Date().toISOString(), last_error: null }).eq('id', context.publication.id);
          }
        }
        if (!response.ok) return reply(interactionMessage('Embedul nu a putut fi actualizat pe Discord.'));
        return reply(interactionMessage(String(definition.responses?.success || 'Embedul a fost actualizat.')));
      }
      if (action === 'notify_submitter') {
        const sent = await notifyCustomModuleUser(customDb, context.discordId, String(definition.responses?.success || definition.responses?.button || 'Ai primit o notificare de la Panel Pro.'));
        return reply(interactionMessage(sent ? 'Notificarea a fost trimisă.' : 'Notificarea nu a putut fi trimisă.'));
      }
      if ((action === 'save_submission' || action === 'send_log') && Array.isArray(definition.form_schema) && definition.form_schema.length) return reply(customModuleModal(module, String(parts[3] || '0')) || interactionMessage('Formularul modulului nu este disponibil.'));
      if (action === 'approve' || action === 'reject') {
        try { assertCustomModulePermission(interaction, module, 'approve', context.publication); } catch (error) { return reply(interactionMessage(readableError(error, 'Nu ai dreptul să iei această decizie.'))); }
        const { data: pending } = await customDb.from('platform_module_submissions').select('id,display_name,created_at').eq('organization_id', context.organization.id).eq('module_key', key).eq('guild_id', context.guildId).eq('status', 'submitted').order('created_at', { ascending: false }).limit(25);
        if (!Array.isArray(pending) || !pending.length) return reply(interactionMessage('Nu există cereri în așteptarea unei decizii.'));
        return reply({ type: 4, data: { flags: 64, content: action === 'approve' ? 'Alege cererea de aprobat:' : 'Alege cererea de respins:', components: [{ type: 1, components: [{ type: 3, custom_id: `panel:custom:${key}:decision_select:${action === 'approve' ? 'approved' : 'rejected'}`, placeholder: 'Selectează cererea', options: pending.map((row: any) => ({ label: String(row.display_name || 'Membru').slice(0, 100), value: String(row.id), description: new Date(row.created_at).toLocaleDateString('ro-RO').slice(0, 100) })) }] }] } });
      }
      if (action === 'save_submission' || action === 'send_log') {
        const deferred = await deferInteraction(interaction, false);
        let result;
        try { result = await handleCustomModuleSubmit(customDb, context, module, {}); } catch (error) { result = interactionMessage(readableError(error, 'Acțiunea nu a putut fi executată.')); }
        await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
        return new Response(null, { status: 204 });
      }
      return reply(interactionMessage(String(definition.responses?.button || 'Acțiunea modulului a fost primită.')));
    }
    if (isModalSubmit && parts[3] === 'submit') {
      const deferred = await deferInteraction(interaction, false);
      let result;
      try {
        const context = await resolveCustomModulePublication(customDb, interaction, key);
        assertCustomModulePermission(interaction, module, 'use', context.publication);
        const definition = module.definition && typeof module.definition === 'object' ? module.definition : {};
        result = String(definition.handler || '').toLowerCase() === 'prezenta_eveniment'
          ? await createPresenceEvent(customDb, context, module, modalValues(interaction))
          : await handleCustomModuleSubmit(customDb, context, module, modalValues(interaction));
      }
      catch (error) { const definition = module.definition && typeof module.definition === 'object' ? module.definition : {}; const responses = definition.responses && typeof definition.responses === 'object' ? definition.responses : {}; result = interactionMessage(String(responses.error || readableError(error, 'Formularul modulului nu a putut fi procesat.'))); }
      await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
      return new Response(null, { status: 204 });
    }
  }

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
  if (isButton && isMarketplace) {
    const parts = customId.split(':');
    const kind = parts[2] === 'illegal' ? 'illegal' : parts[2] === 'legal' ? 'legal' : null;
    if (!kind) return reply(interactionMessage('Tipul Marketplace nu este valid.'));
    if (parts[3] === 'sold') {
      const itemId = decodeURIComponent(String(parts[4] || ''));
      if (!/^[0-9a-f-]{36}$/i.test(itemId)) return reply(interactionMessage('ID-ul anunțului nu este valid.'));
      const key = serviceKey();
      if (!key) return reply(interactionMessage('Cheia secretă Supabase lipsește.'));
      const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
      try { return reply(await markMarketplaceSoldFromDiscord(db, interaction, kind, itemId)); }
      catch (error) { return reply(interactionMessage(error instanceof Error ? error.message : 'Anunțul nu a putut fi marcat ca vândut.')); }
    }
    if (parts[3] === 'create') {
      const key = serviceKey();
      if (!key) return reply(interactionMessage('Cheia secretă Supabase lipsește.'));
      const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
      await resolveUniversalModuleContext(db, interaction, kind === 'illegal' ? 'illegal_marketplace' : 'marketplace', kind === 'illegal' ? 'illegal_marketplace' : 'legal_marketplace');
      return reply(marketplaceModal(kind));
    }
    if (parts[3] === 'mine') {
      const key = serviceKey();
      if (!key) return reply(interactionMessage('Cheia secretă Supabase lipsește.'));
      const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
      const context = await resolveUniversalModuleContext(db, interaction, kind === 'illegal' ? 'illegal_marketplace' : 'marketplace', kind === 'illegal' ? 'illegal_marketplace' : 'legal_marketplace');
      const table = kind === 'illegal' ? 'marketplace_ilegal' : 'marketplace';
      let query = db.from(table).select('id,nume,tip_actiune,pret,created_at').eq('created_by_discord_id', context.discordId).order('created_at', { ascending: false }).limit(10);
      if (kind === 'illegal') query = query.is('organization_id', null);
      else query = query.eq('organization_id', context.organization.id);
      const { data, error } = await query;
      if (error) throw error;
      const lines = (data || []).map((row: any) => `• **${String(row.nume || 'Anunț').slice(0, 80)}** · ${String(row.tip_actiune || '—')} · ${String(row.pret || 'Negociabil')}`);
      return reply(interactionMessage(lines.length ? `Anunțurile tale:\n${lines.join('\n')}` : 'Nu ai încă anunțuri în acest marketplace.'));
    }
  }
  if (isDiscovery && isButton) {
    const key = serviceKey();
    if (!key) return reply(interactionMessage('Cheia secretă Supabase lipsește.'));
    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    if (customId === 'panel:discovery:reminder_create') {
      await resolveUniversalModuleContext(db, interaction, 'event_reminders', 'event_reminders');
      return reply(discoveryReminderModal());
    }
    if (customId === 'panel:discovery:reminder_info') return reply(interactionMessage('Evenimentele se salvează în istoricul organizației. Reminder-ele automate sunt trimise în canalul modulului, iar rezultatele și erorile în canalul de log configurat.'));
    if (customId === 'panel:discovery:report_info') return reply(interactionMessage('Raportul săptămânal centralizează contractele și identificatorii angajaților din perioada curentă. Publicarea se face în canalul de log al raportului.'));
    if (customId === 'panel:discovery:weekly_report') {
      const context = await resolveUniversalModuleContext(db, interaction, 'contract_identity_weekly', 'reports');
      const deferred = await deferInteraction(interaction, false);
      let result;
      try { result = await handleWeeklyReport(db, context); } catch (error) { result = interactionMessage(readableError(error, 'Raportul nu a putut fi generat.')); }
      const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
      if (followupId) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
      return new Response(null, { status: 204 });
    }
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
      const routeKey = 'stash';
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
      const routeKey = 'stash';
      const permission = kind === 'request' ? 'request' : kind === 'donation' ? 'donate' : 'write';
      const deferred = await deferInteraction(interaction, false);
      let result;
      try { result = await handleStashSubmit(db, await resolveStashContext(db, interaction, routeKey, permission), kind, modalValues(interaction)); }
      catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(readableError(error, 'Acțiunea Stash nu a putut fi executată.')); }
      const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
      if (followupId) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
      return new Response(null, { status: 204 });
    }
    if (isMarketplace && isModalSubmit) {
      const parts = customId.split(':');
      const kind = parts[2] === 'illegal' ? 'illegal' : parts[2] === 'legal' ? 'legal' : null;
      if (!kind || parts[3] !== 'submit') return reply(interactionMessage('Formularul Marketplace nu este valid.'));
      const deferred = await deferInteraction(interaction, false);
      let result;
      try {
        const context = await resolveUniversalModuleContext(db, interaction, kind === 'illegal' ? 'illegal_marketplace' : 'marketplace', kind === 'illegal' ? 'illegal_marketplace' : 'legal_marketplace');
        result = await handleMarketplaceSubmit(db, context, kind, modalValues(interaction));
      } catch (error) { result = interactionMessage(readableError(error, 'Anunțul nu a putut fi salvat.')); }
      const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
      if (followupId) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
      return new Response(null, { status: 204 });
    }
    if (isDiscovery && isModalSubmit && customId === 'panel:discovery:reminder_submit') {
      const deferred = await deferInteraction(interaction, false);
      let result;
      try { const context = await resolveUniversalModuleContext(db, interaction, 'event_reminders', 'event_reminders'); result = await handleReminderSubmit(db, context, modalValues(interaction)); }
      catch (error) { result = interactionMessage(readableError(error, 'Evenimentul nu a putut fi salvat.')); }
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
    if (isProposals && isButton) {
      const parts = customId.split(':');
      const audience = parts[2] === 'departments' ? 'departments' : parts[2] === 'organization' ? 'organization' : null;
      if (!audience) return reply(interactionMessage('Categoria propunerii nu este validă.'));
      if (parts[3] === 'create') return reply(proposalModal(audience));
      const permission = ['review', 'accept', 'reject', 'delete'].includes(String(parts[3] || '')) ? 'write' : 'read';
      const deferred = await deferInteraction(interaction, false);
      let result;
      try {
        const context = await resolveAnnouncementContext(db, interaction, audience, permission);
        result = await handleProposalButton(db, interaction, context, parts);
      } catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(readableError(error, 'Propunerea nu a putut fi actualizată.')); }
      const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
      if (followupId) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
      return new Response(null, { status: 204 });
    }
    if (isProposals && isModalSubmit) {
      const parts = customId.split(':');
      const audience = parts[2] === 'departments' ? 'departments' : parts[2] === 'organization' ? 'organization' : null;
      if (!audience || parts[3] !== 'submit') return reply(interactionMessage('Formularul Propuneri nu este valid.'));
      const deferred = await deferInteraction(interaction, false);
      let result;
      try {
        const context = await resolveAnnouncementContext(db, interaction, audience, 'write');
        result = await handleAnnouncementSubmit(db, context, interaction, 'proposal' as any, modalValues(interaction));
      } catch (error) { console.error('[discord-interactions]', error); result = interactionMessage(readableError(error, 'Propunerea nu a putut fi salvată.')); }
      const followupId = await sendFollowup(deferred.applicationId, deferred.interactionToken, result);
      if (followupId) { await new Promise((resolve) => setTimeout(resolve, 5000)); await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId); }
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
        result = await handleDisciplineSubmit(db, context, interaction, kind, modalValues(interaction), targetId);
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
    if (followupId && action !== 'my_stats') {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await deleteFollowup(deferred.applicationId, deferred.interactionToken, followupId);
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('[discord-interactions]', error);
    return reply(interactionMessage(error instanceof Error ? error.message : 'Acțiunea Pontaj nu a putut fi executată.'));
  }
});
