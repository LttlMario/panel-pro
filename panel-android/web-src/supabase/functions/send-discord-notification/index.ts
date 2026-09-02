import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { requirePanelSession } from '../_shared/panel-session.ts';
import { resolvePackageFeatures } from '../_shared/package-features.ts';
import { deliverDiscordRoute, routeCandidates } from '../_shared/discord-delivery.ts';

const cors = {
  'Access-Control-Allow-Origin': 'https://panel-pro.ro',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session',
  'Content-Type': 'application/json',
};

const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: cors });
const levels: Record<string, number> = {
  organization: 1,
  pontaj: 1,
  weekly_reports: 1,
  requests_organization: 1,
  requests_departments: 1,
  requests: 1,
  contracts: 1,
  contract_identity_weekly: 1,
  marketplace: 1,
  illegal_marketplace: 1,
  live_status: 1,
};
const channels = new Set(Object.keys(levels));
const MESSAGE_REFS_KEY = 'discord_message_refs';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);

  try {
    const contentType = request.headers.get('content-type') || '';
    let channel = '';
    let payload: any = null;
    let requestedOrganizationId = '';
    let requestedMessageKey = '';
    let forwardBody: BodyInit;
    let forwardHeaders: Record<string, string> = {};

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      channel = String(form.get('_panel_channel') || '');
      requestedOrganizationId = String(form.get('_panel_organization_id') || '');
      form.delete('_panel_channel');
      form.delete('_panel_access_token');
      form.delete('_panel_organization_id');
      forwardBody = form;
    } else {
      const body = await request.json();
      channel = String(body.channel || '');
      requestedOrganizationId = String(body.organization_id || '');
      requestedMessageKey = String(body.message_key || '').trim().slice(0, 120);
      payload = body.payload;
      forwardBody = JSON.stringify(payload);
      forwardHeaders['Content-Type'] = 'application/json';
    }

    let finalChannel = channel;
    if (channel === 'requests') {
      finalChannel = payload?.request_type === 'organization' ? 'requests_organization' : 'requests_departments';
    }
    if (!channels.has(finalChannel)) return reply({ error: 'Canal Discord invalid.' }, 400);

    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || keys.default;
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    if (!serviceKey) throw new Error('Cheia service role lipsește.');
    if (!supabaseUrl) throw new Error('SUPABASE_URL lipsește.');
    const db = createClient(supabaseUrl, serviceKey);

    const session = await requirePanelSession(db, request, levels[finalChannel]);
    const requestIp = String(request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown')
      .split(',')[0].trim().slice(0, 120);
    const { data: notificationAllowed, error: notificationRateError } = await db.rpc('consume_panel_rate_limit', {
      p_key: `discord-notification:${session.organization_id}:${session.discord_id}:${requestIp}`,
      p_limit: 120,
      p_window_seconds: 900,
    });
    if (notificationRateError) throw notificationRateError;
    if (notificationAllowed === false) return reply({ error: 'Ai atins limita temporară de notificări Discord. Încearcă din nou mai târziu.' }, 429);

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
    const requiredFeature = finalChannel === 'organization'
      ? 'announcements_organization'
      : finalChannel === 'requests_organization'
        ? 'requests_organization'
        : finalChannel === 'requests_departments'
          ? 'requests_departments'
          : finalChannel === 'illegal_marketplace'
            ? 'illegal_marketplace'
            : null;
    if (requiredFeature && !packageFeatures.includes(requiredFeature)) {
      return reply({ error: 'Acest canal Discord nu este inclus în pachetul organizației.' }, 403);
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
      return reply({ ok: true, channel: finalChannel, organization_id: sessionOrganizationId, routes: messages.length, messages, fallback_failures: failures });
    }

    const { data: settings, error: settingsError } = await db
      .from('organization_settings')
      .select('discord_channel_routes')
      .eq('organization_id', sessionOrganizationId)
      .maybeSingle();
    if (settingsError) throw settingsError;
    if (!settings) throw new Error('Configurația organizației active nu a fost găsită.');

    const configuredRoutes = routeCandidates(settings, finalChannel, [], fallbackRouteKey);
    if (!configuredRoutes.some((item) => item.candidates.length)) {
      throw new Error(`Canalul Discord pentru ${finalChannel} nu este configurat pentru organizația activă.`);
    }

    const editExistingPontajMessage = finalChannel === 'pontaj';
    const pontajMessageKey = requestedMessageKey || 'organization';
    let storedPontajMessageRefs: Record<string, any> = {};
    let storedMessageRefs: Record<string, string> = {};
    if (editExistingPontajMessage) {
      const { data: messageRefsSetting, error: messageRefsError } = await db
        .from('app_settings')
        .select('value')
        .eq('organization_id', sessionOrganizationId)
        .eq('key', MESSAGE_REFS_KEY)
        .maybeSingle();
      if (messageRefsError) throw messageRefsError;
      const savedPontajRefs = messageRefsSetting?.value?.pontaj;
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
    if (editExistingPontajMessage) {
      for (const item of configuredRoutes) {
        const channelId = settings.discord_channel_routes?.[finalChannel]?.[item.target]?.channel_id
          || settings.discord_channel_routes?.[fallbackRouteKey]?.[item.target]?.channel_id;
        if (channelId && storedMessageRefs[String(channelId)]) messageIds[item.target] = storedMessageRefs[String(channelId)];
      }
    }

    const delivery = await deliverDiscordRoute(db, settings, finalChannel, forwardBody, {
      headers: forwardHeaders,
      messageIds,
      fallbackRouteKey,
    });
    const messages = (delivery.results || []).map((result) => ({
      channel_id: result.channel_id || null,
      id: result.id,
      action: messageIds[result.target] ? 'edited' : 'created',
    }));
    if (!messages.length) throw new Error(delivery.failures.join(' | ') || 'Discord nu a acceptat notificarea.');

    if (editExistingPontajMessage) {
      const updatedMessageRefs = { ...storedMessageRefs };
      for (const result of delivery.results || []) {
        const channelId = result.channel_id || result.target;
        if (result.id) updatedMessageRefs[String(channelId)] = String(result.id);
      }
      const { error: saveMessageRefsError } = await db.from('app_settings').upsert({
        organization_id: sessionOrganizationId,
        key: MESSAGE_REFS_KEY,
        value: { pontaj: { ...storedPontajMessageRefs, [pontajMessageKey]: updatedMessageRefs } },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id,key' });
      if (saveMessageRefsError) throw saveMessageRefsError;
    }

    return reply({
      ok: true,
      channel: finalChannel,
      organization_id: sessionOrganizationId,
      routes: messages.length,
      messages,
      fallback_failures: delivery.failures,
    });
  } catch (error) {
    console.error('[send-discord-notification]', error);
    return reply({ error: error instanceof Error ? error.message : 'Eroare necunoscută.' }, 400);
  }
});
