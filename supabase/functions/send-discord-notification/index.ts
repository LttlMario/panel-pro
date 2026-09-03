import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { requirePanelSession } from '../_shared/panel-session.ts';
import { resolvePackageFeatures } from '../_shared/package-features.ts';
import { deliverDiscordRoute, routeCandidates } from '../_shared/discord-delivery.ts';
import { corsOptions, getCorsHeaders } from '../_shared/cors.ts';

const reply = (request: Request, data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: getCorsHeaders(request) });
const errorMessage = (error: unknown, fallback = 'Eroare necunoscută.') => {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object') {
    const value = error as Record<string, unknown>;
    const nested = value.error;
    if (nested && typeof nested === 'object' && String((nested as Record<string, unknown>).message || '').trim()) return String((nested as Record<string, unknown>).message).trim();
    if (String(value.message || '').trim()) return String(value.message).trim();
    if (String(value.details || '').trim()) return String(value.details).trim();
    if (String(value.hint || '').trim()) return String(value.hint).trim();
    try { return JSON.stringify(error); } catch (_) {}
  }
  return fallback;
};
const levels: Record<string, number> = {
  organization: 1,
  departments: 1,
  pontaj: 1,
  log_pontaj: 1,
  log_requests_organization: 1,
  log_requests_departments: 1,
  log_announcements_organization: 1,
  log_announcements_departments: 1,
  weekly_reports: 1,
  requests_organization: 1,
  requests_departments: 1,
  requests: 1,
  contracts: 1,
  contract_uploads: 1,
  log_contracts: 1,
  contract_identity_weekly: 1,
  marketplace: 1,
  illegal_marketplace: 1,
  live_status: 1,
  stash: 1,
  log_stash: 1,
  stash_requests: 1,
  log_stash_requests: 1,
  stash_donations: 1,
  log_stash_donations: 1,
};
const channels = new Set(Object.keys(levels));
const MESSAGE_REFS_KEY = 'discord_message_refs';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const consolidatedContentRoutes: Record<string, string> = {
  fines_organization: 'organization',
  warnings_organization: 'organization',
  sanctions_organization: 'organization',
  actions_organization: 'organization',
  fines_departments: 'departments',
  warnings_departments: 'departments',
  sanctions_departments: 'departments',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return corsOptions(request);
  if (request.method !== 'POST') return reply(request, { error: 'Metodă invalidă.' }, 405);

  try {
    const contentType = request.headers.get('content-type') || '';
    let channel = '';
    let payload: any = null;
    let requestedOrganizationId = '';
    let requestedMessageKey = '';
    let requestedChannelRoutes: any = null;
    let requestedPostOnly = false;
    let forwardBody: BodyInit;
    let forwardHeaders: Record<string, string> = {};

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      channel = String(form.get('_panel_channel') || '');
      requestedOrganizationId = String(form.get('_panel_organization_id') || '');
      requestedMessageKey = String(form.get('_panel_message_key') || '').trim().slice(0, 120);
      requestedPostOnly = String(form.get('_panel_post_only') || '') === '1';
      try {
        const rawRoutes = form.get('_panel_channel_routes');
        requestedChannelRoutes = rawRoutes ? JSON.parse(String(rawRoutes)) : null;
      } catch (_) {
        requestedChannelRoutes = null;
      }
      form.delete('_panel_channel');
      form.delete('_panel_access_token');
      form.delete('_panel_organization_id');
      form.delete('_panel_message_key');
      form.delete('_panel_post_only');
      form.delete('_panel_channel_routes');
      forwardBody = form;
    } else {
      const body = await request.json();
      channel = String(body.channel || '');
      requestedOrganizationId = String(body.organization_id || '');
      requestedMessageKey = String(body.message_key || '').trim().slice(0, 120);
      requestedChannelRoutes = body.channel_routes && typeof body.channel_routes === 'object' ? body.channel_routes : null;
      payload = body.payload;
      forwardBody = JSON.stringify(payload);
      forwardHeaders['Content-Type'] = 'application/json';
    }

    // Compatibilitate cu pagini sau funcții mai vechi: categoriile de
    // disciplină/acțiuni folosesc acum canalul principal de anunțuri.
    let finalChannel = consolidatedContentRoutes[channel] || channel;
    if (channel === 'requests') {
      finalChannel = payload?.request_type === 'organization' ? 'requests_organization' : 'requests_departments';
    }
    // Compatibilitate pentru pagini/cache-uri mai vechi care încă trimit
    // log_requests. Logurile rămân separate; alegem ruta după tipul cererii.
    if (channel === 'log_requests') {
      finalChannel = payload?.request_type === 'organization'
        ? 'log_requests_organization'
        : 'log_requests_departments';
    }
    if (!channels.has(finalChannel)) return reply(request, { error: 'Canal Discord invalid.' }, 400);

    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || keys.default;
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    if (!serviceKey) throw new Error('Cheia service role lipsește.');
    if (!supabaseUrl) throw new Error('SUPABASE_URL lipsește.');
    const db = createClient(supabaseUrl, serviceKey);

    let session;
    try {
      session = await requirePanelSession(db, request, levels[finalChannel]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sesiunea panelului nu este validă.';
      if (/sesiunea|autentifică-te|reautentifică-te|expirat|invalidă/i.test(message)) {
        return reply(request, { error: message }, 401);
      }
      throw error;
    }
    const requestIp = String(request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown')
      .split(',')[0].trim().slice(0, 120);
    const { data: notificationAllowed, error: notificationRateError } = await db.rpc('consume_panel_rate_limit', {
      p_key: `discord-notification:${session.organization_id}:${session.discord_id}:${requestIp}`,
      p_limit: 120,
      p_window_seconds: 900,
    });
    if (notificationRateError) throw notificationRateError;
    if (notificationAllowed === false) return reply(request, { error: 'Ai atins limita temporară de notificări Discord. Încearcă din nou mai târziu.' }, 429);

    const sessionOrganizationId = String(session.organization_id || '');
    if (!sessionOrganizationId) throw new Error('Organizația activă nu a fost identificată.');
    if (requestedOrganizationId && requestedOrganizationId !== sessionOrganizationId) {
      throw new Error('Organizația solicitată nu corespunde organizației active.');
    }

    const { data: packageSetting, error: packageError } = await db
      .from('app_settings')
      .select('value')
      .eq('organization_id', sessionOrganizationId)
      .eq('key', 'organization_package')
      .maybeSingle();
    if (packageError) throw packageError;
    const packageFeatures = resolvePackageFeatures(packageSetting?.value || {});
    // Organizațiile cu abonament web Premium nu afișează butonul de donație.
    // Eliminăm componenta și pe server, inclusiv pentru pagini/cache-uri mai vechi
    // care încă o injectează în payload înainte de trimitere.
    if (packageSetting?.value?.code === 'full' && payload && typeof payload === 'object' && Array.isArray(payload.components)) {
      payload = {
        ...payload,
        components: payload.components.filter((row: any) => !row?.components?.some((component: any) => component?.type === 2 && component?.style === 5 && component?.url === 'https://revolut.me/mariomihail')),
      };
      forwardBody = JSON.stringify(payload);
    }
    const requiredFeature = finalChannel === 'organization'
      ? 'announcements_organization'
      : finalChannel === 'departments'
        ? 'announcements_departments'
      : finalChannel === 'requests_organization'
        ? 'requests_organization'
        : finalChannel === 'requests_departments'
          ? 'requests_departments'
          : finalChannel === 'illegal_marketplace'
            ? 'illegal_marketplace'
            : null;
    if (requiredFeature && !packageFeatures.includes(requiredFeature)) {
      return reply(request, { error: 'Acest canal Discord nu este inclus în pachetul organizației.' }, 403);
    }

    const isGlobalMarketplace = ['marketplace', 'illegal_marketplace'].includes(finalChannel);
    const fallbackRouteKey = ['requests_organization', 'requests_departments'].includes(finalChannel) ? 'requests' : '';

    if (isGlobalMarketplace) {
      const { data: organizations, error: organizationsError } = await db
        .from('organizations')
        .select('id')
        .eq('active', true);
      if (organizationsError) throw organizationsError;
      const ids = (organizations || []).map((organization: any) => organization.id);
      if (!ids.length) throw new Error(`Nu există organizații active pentru ${finalChannel === 'marketplace' ? 'Marketplace' : 'Marketplace ilegal'}.`);
      const { data: settingsRows, error: settingsError } = await db
        .from('organization_settings')
        .select('organization_id,discord_channel_routes')
        .in('organization_id', ids);
      if (settingsError) throw settingsError;

      const messages: any[] = [];
      const failures: string[] = [];
      for (const settings of settingsRows || []) {
        if (!routeCandidates(settings, finalChannel).some((item) => item.candidates.length)) continue;
        try {
          const delivery = await deliverDiscordRoute(db, settings, finalChannel, forwardBody, { headers: forwardHeaders });
          messages.push(...delivery.results.map((item) => ({ ...item, organization_id: settings.organization_id })));
          failures.push(...delivery.failures.map((failure) => `${settings.organization_id}: ${failure}`));
        } catch (error) {
          failures.push(`${settings.organization_id}: ${error instanceof Error ? error.message : 'Eroare Discord.'}`);
        }
      }
      if (!messages.length) throw new Error(failures.join(' | ') || 'Nu există canale Discord configurate pentru acest mesaj.');
      return reply(request, { ok: true, channel: finalChannel, organization_id: sessionOrganizationId, routes: messages.length, messages, fallback_failures: failures });
    }

    const { data: settings, error: settingsError } = await db
      .from('organization_settings')
      .select('discord_client_id,panel_public_url,webhook_routes,discord_channel_routes')
      .eq('organization_id', sessionOrganizationId)
      .maybeSingle();
    if (settingsError) throw settingsError;
    if (!settings) throw new Error('Configurația organizației active nu a fost găsită.');
    // Publicarea panourilor folosește și selecția curentă din pagină. Astfel,
    // butonul de publicare nu eșuează dacă utilizatorul a ales canalul, dar
    // încă nu a apăsat butonul general de salvare al organizației.
    const selectedRoute = requestedChannelRoutes?.[finalChannel];
    const linkedLogRouteKey = finalChannel === 'organization'
      ? 'log_announcements_organization'
      : finalChannel === 'departments'
        ? 'log_announcements_departments'
      : finalChannel === 'contracts'
          ? 'log_contracts'
        : finalChannel === 'stash'
          ? 'log_stash'
        : finalChannel === 'stash_requests'
          ? 'log_stash_requests'
        : finalChannel === 'stash_donations'
          ? 'log_stash_donations'
        : '';
    const selectedLogRoute = linkedLogRouteKey ? requestedChannelRoutes?.[linkedLogRouteKey] : null;
    if (selectedRoute && typeof selectedRoute === 'object') {
      settings.discord_channel_routes = {
        ...(settings.discord_channel_routes && typeof settings.discord_channel_routes === 'object' ? settings.discord_channel_routes : {}),
        [finalChannel]: selectedRoute,
      };
      if (selectedLogRoute && typeof selectedLogRoute === 'object') {
        settings.discord_channel_routes[linkedLogRouteKey] = selectedLogRoute;
      }
      // Panourile cu butoane trebuie să rămână funcționale după publicare.
      // Persistăm ruta aleasă aici, astfel încât verificarea făcută ulterior
      // de discord-interactions să vadă exact canalul în care a fost publicat
      // embedul, chiar dacă utilizatorul nu a apăsat încă salvarea generală.
      const { error: routeSaveError } = await db.from('organization_settings')
        .update({ discord_channel_routes: settings.discord_channel_routes, updated_at: new Date().toISOString() })
        .eq('organization_id', sessionOrganizationId);
      if (routeSaveError) throw routeSaveError;
    }

    const alternateControlRouteKey = finalChannel === 'requests_organization'
      ? 'requests_departments'
      : finalChannel === 'requests_departments'
        ? 'requests_organization'
        : '';
    let effectiveRouteKey = finalChannel;
    let effectiveFallbackRouteKey = fallbackRouteKey;
    let configuredRoutes = routeCandidates(settings, finalChannel, [], fallbackRouteKey);
    // Cele două panouri de învoiri pot fi publicate în același canal dacă
    // este selectat doar unul dintre ele. Logurile nu folosesc acest fallback.
    if (!configuredRoutes.some((item) => item.candidates.length) && alternateControlRouteKey) {
      const alternateRoutes = routeCandidates(settings, alternateControlRouteKey, [], fallbackRouteKey);
      if (alternateRoutes.some((item) => item.candidates.length)) {
        effectiveRouteKey = alternateControlRouteKey;
        effectiveFallbackRouteKey = fallbackRouteKey;
        configuredRoutes = alternateRoutes;
      }
    }
    if (!configuredRoutes.some((item) => item.candidates.length)) {
      throw new Error(`Canalul Discord pentru ${finalChannel} nu este configurat pentru organizația activă.`);
    }

    const editExistingControlMessage = !requestedPostOnly && ['pontaj', 'requests_organization', 'requests_departments', 'organization', 'departments', 'contracts', 'stash', 'stash_requests', 'stash_donations'].includes(finalChannel);
    const isPontajLog = finalChannel === 'log_pontaj';
    const isRequestsLog = ['log_requests_organization', 'log_requests_departments'].includes(finalChannel);
    const pontajMessageKey = requestedMessageKey || 'organization';
    let shiftLogRecord: any = null;
    let shiftLogMessageIds: Record<string, string> = {};
    if (isPontajLog && UUID_RE.test(requestedMessageKey)) {
      const { data, error } = await db.from('shifts').select('id,discord_log_message_ids').eq('id', requestedMessageKey).eq('organization_id', sessionOrganizationId).maybeSingle();
      if (error) throw error;
      shiftLogRecord = data || null;
      shiftLogMessageIds = shiftLogRecord?.discord_log_message_ids && typeof shiftLogRecord.discord_log_message_ids === 'object' ? shiftLogRecord.discord_log_message_ids : {};
    }
    let absenceLogRecord: any = null;
    let absenceLogMessageIds: Record<string, string> = {};
    if (isRequestsLog && UUID_RE.test(requestedMessageKey)) {
      const { data, error } = await db.from('absences').select('id,discord_log_message_ids').eq('id', requestedMessageKey).eq('organization_id', sessionOrganizationId).maybeSingle();
      if (error) throw error;
      absenceLogRecord = data || null;
      absenceLogMessageIds = absenceLogRecord?.discord_log_message_ids && typeof absenceLogRecord.discord_log_message_ids === 'object' ? absenceLogRecord.discord_log_message_ids : {};
    }
    let messageRefsSetting: any = null;
    let storedPontajMessageRefs: Record<string, any> = {};
    let storedMessageRefs: Record<string, string> = {};
    if (editExistingControlMessage) {
      const { data, error: messageRefsError } = await db
        .from('app_settings')
        .select('value')
        .eq('organization_id', sessionOrganizationId)
        .eq('key', MESSAGE_REFS_KEY)
        .maybeSingle();
      if (messageRefsError) throw messageRefsError;
      messageRefsSetting = data;
      const savedPontajRefs = messageRefsSetting?.value?.[finalChannel];
      if (savedPontajRefs && typeof savedPontajRefs === 'object') {
        storedPontajMessageRefs = savedPontajRefs;
        const savedForMessage = savedPontajRefs[pontajMessageKey];
        const isMessageMap = savedForMessage && typeof savedForMessage === 'object' && !Array.isArray(savedForMessage);
        const isLegacyMap = pontajMessageKey === 'organization' && Object.values(savedPontajRefs).every((value) => typeof value === 'string');
        if (isMessageMap) storedMessageRefs = savedForMessage;
        else if (isLegacyMap) storedMessageRefs = savedPontajRefs;
      }
    }

    const messageIds: Record<string, string> = {};
    if (isPontajLog) Object.assign(messageIds, shiftLogMessageIds);
    if (isRequestsLog) Object.assign(messageIds, absenceLogMessageIds);
    if (editExistingControlMessage) {
      for (const item of configuredRoutes) {
        const channelId = settings.discord_channel_routes?.[effectiveRouteKey]?.[item.target]?.channel_id
          || settings.discord_channel_routes?.[effectiveFallbackRouteKey]?.[item.target]?.channel_id;
        if (channelId && storedMessageRefs[String(channelId)]) messageIds[item.target] = storedMessageRefs[String(channelId)];
      }
    }

    const delivery = await deliverDiscordRoute(db, settings, effectiveRouteKey, forwardBody, {
      headers: forwardHeaders,
      messageIds,
      fallbackRouteKey: effectiveFallbackRouteKey,
      postOnly: requestedPostOnly,
    });
    const messages = (delivery.results || []).map((result) => ({
      channel_id: result.channel_id || null,
      id: result.id,
      action: messageIds[result.target] ? 'edited' : 'created',
    }));
    if (!messages.length) throw new Error(delivery.failures.join(' | ') || 'Discord nu a acceptat notificarea.');

    if (editExistingControlMessage) {
      const updatedMessageRefs = { ...storedMessageRefs };
      for (const result of delivery.results || []) {
        const channelId = result.channel_id || result.target;
        if (result.id) updatedMessageRefs[String(channelId)] = String(result.id);
      }
      const { error: saveMessageRefsError } = await db.from('app_settings').upsert({
        organization_id: sessionOrganizationId,
        key: MESSAGE_REFS_KEY,
        value: { ...(messageRefsSetting?.value && typeof messageRefsSetting.value === 'object' ? messageRefsSetting.value : {}), [finalChannel]: { ...storedPontajMessageRefs, [pontajMessageKey]: updatedMessageRefs } },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id,key' });
      if (saveMessageRefsError) throw saveMessageRefsError;
    }

    if (isPontajLog && shiftLogRecord) {
      const updatedShiftMessageIds = { ...shiftLogMessageIds };
      for (const result of delivery.results || []) {
        if (result.id) updatedShiftMessageIds[String(result.target)] = String(result.id);
      }
      const { error: shiftMessageError } = await db.from('shifts').update({ discord_log_message_ids: updatedShiftMessageIds, updated_at: new Date().toISOString() }).eq('id', shiftLogRecord.id).eq('organization_id', sessionOrganizationId);
      if (shiftMessageError) throw shiftMessageError;
    }
    if (isRequestsLog && absenceLogRecord) {
      const updatedAbsenceMessageIds = { ...absenceLogMessageIds };
      for (const result of delivery.results || []) {
        if (result.id) updatedAbsenceMessageIds[String(result.target)] = String(result.id);
      }
      const { error: absenceMessageError } = await db.from('absences').update({ discord_log_message_ids: updatedAbsenceMessageIds }).eq('id', absenceLogRecord.id).eq('organization_id', sessionOrganizationId);
      if (absenceMessageError) throw absenceMessageError;
    }

    return reply(request, {
      ok: true,
      channel: finalChannel,
      organization_id: sessionOrganizationId,
      routes: messages.length,
      messages,
      fallback_failures: delivery.failures,
    });
  } catch (error) {
    console.error('[send-discord-notification]', error);
    const message = errorMessage(error);
    const status = /Botul Discord nu are permisiuni|Discord bot HTTP 403/i.test(message) ? 403 : 400;
    return reply(request, { error: message }, status);
  }
});
