import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { requirePanelSession } from '../_shared/panel-session.ts';
import { resolvePackageFeatures } from '../_shared/package-features.ts';
import { deliverDiscordRoute, routeCandidates } from '../_shared/discord-delivery.ts';

const cors = {
  'Access-Control-Allow-Origin': 'https://panel-pro.ro',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session',
  'Content-Type': 'application/json'
};

const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: cors
  });

const levels: Record<string, number> = {
  organization: 1,
  pontaj: 1,
  weekly_reports: 1,

  requests_organization: 1,
  requests_departments: 1,

  // compatibilitate versiuni vechi
  requests: 1,

  contracts: 1,
  contract_identity_weekly: 1,
  marketplace: 1,
  illegal_marketplace: 1,
  live_status: 1
};

const channels = new Set(Object.keys(levels));
const MESSAGE_REFS_KEY = 'discord_message_refs';

const executeWebhookUrl = (webhook: string) => {
  const url = new URL(webhook);
  url.searchParams.set('wait', 'true');
  return url.toString();
};

const editWebhookMessageUrl = (webhook: string, messageId: string) => {
  const url = new URL(webhook);
  url.pathname = `${url.pathname.replace(/\/$/, '')}/messages/${encodeURIComponent(messageId)}`;
  url.searchParams.delete('wait');
  return url.toString();
};


Deno.serve(async (request) => {

if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: cors
    });
}


  if (request.method !== 'POST') {
    return reply(
      {
        error: 'Metodă invalidă.'
      },
      405
    );
  }


  try {

    const contentType =
      request.headers.get('content-type') || '';


    let channel = '';
    let finalChannel = '';

    let payload: any = null;

    let requestedOrganizationId = '';
    let requestedMessageKey = '';

    let forwardBody: BodyInit;
    let forwardHeaders: Record<string,string> = {};


    /*
     * ============================================================
     * CITIRE REQUEST
     * ============================================================
     */


    if (contentType.includes('multipart/form-data')) {


      const form =
        await request.formData();


      channel =
        String(
          form.get('_panel_channel') || ''
        );


      requestedOrganizationId =
        String(
          form.get('_panel_organization_id') || ''
        );


      form.delete('_panel_channel');
      form.delete('_panel_access_token');
      form.delete('_panel_organization_id');


      forwardBody = form;


    } else {


      const body =
        await request.json();


      channel =
        String(
          body.channel || ''
        );


      requestedOrganizationId =
        String(
          body.organization_id || ''
        );
      requestedMessageKey = String(body.message_key || '').trim().slice(0, 120);


      payload =
        body.payload;


      forwardBody =
        JSON.stringify(payload);


      forwardHeaders['Content-Type'] =
        'application/json';

    }



    /*
     * ============================================================
     * COMPATIBILITATE CERERI
     * ============================================================
     */


    finalChannel = channel;


    if (channel === 'requests') {


      if (
        payload &&
        typeof payload === 'object' &&
        payload.request_type
      ) {


        finalChannel =
          payload.request_type === 'organization'
            ? 'requests_organization'
            : 'requests_departments';


      } else {


        /*
         * Pentru paginile vechi
         * folosim departamente
         */
        finalChannel =
          'requests_departments';

      }

    }



    /*
     * ============================================================
     * VALIDARE CANAL
     * ============================================================
     */


    if (!channels.has(finalChannel)) {

      return reply(
        {
          error:'Canal Discord invalid.'
        },
        400
      );

    }



    /*
     * ============================================================
     * SUPABASE
     * ============================================================
     */


    const keys =
      JSON.parse(
        Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}'
      );


    const serviceKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
      keys.default;


    if (!serviceKey) {
      throw new Error(
        'Cheia service role lipsește.'
      );
    }


    const supabaseUrl =
      Deno.env.get('SUPABASE_URL');


    if (!supabaseUrl) {
      throw new Error(
        'SUPABASE_URL lipsește.'
      );
    }


    const db =
      createClient(
        supabaseUrl,
        serviceKey
      );



    /*
     * ============================================================
     * SESIUNE PANEL
     * ============================================================
     */


    const session =
      await requirePanelSession(
        db,
        request,
        levels[finalChannel]
      );

    const requestIp = String(request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown')
      .split(',')[0].trim().slice(0, 120);
    const { data: notificationAllowed, error: notificationRateError } = await db.rpc('consume_panel_rate_limit', {
      p_key: `discord-notification:${session.organization_id}:${session.discord_id}:${requestIp}`,
      p_limit: 120,
      p_window_seconds: 900,
    });
    if (notificationRateError) {
      console.error('Discord notification rate-limit unavailable:', notificationRateError.message);
      return reply({ error: 'Protecția anti-abuz este temporar indisponibilă. Încearcă din nou în câteva minute.' }, 503);
    }
    if (notificationAllowed === false) return reply({ error: 'Ai atins limita temporară de notificări Discord. Încearcă din nou mai târziu.' }, 429);


    if (!session?.organization_id) {

      throw new Error(
        'Organizația activă nu a fost identificată.'
      );

    }



    const sessionOrganizationId =
      String(
        session.organization_id
      );



    if (
      requestedOrganizationId &&
      requestedOrganizationId !== sessionOrganizationId
    ) {

      throw new Error(
        'Organizația solicitată nu corespunde organizației active.'
      );

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



    /*
     * ============================================================
     * CONFIG ORGANIZAȚIE
     * ============================================================
     */


    let config: any = null;

    const globalMarketplaceChannel = ['marketplace', 'illegal_marketplace'].includes(finalChannel);

    if (!globalMarketplaceChannel) {
      const {
        data: organizationConfig,
        error: configError

    } =
      await db
        .from('organization_settings')
        .select('webhook_routes, discord_channel_routes, marketplace_webhook_url, marketplace_secondary_webhook_url')
        .eq(
          'organization_id',
          sessionOrganizationId
        )
        .maybeSingle();



      if (configError)
        throw configError;



      if (!organizationConfig) {

      throw new Error(
        'Configurația organizației active nu a fost găsită.'
      );

      }

      config = organizationConfig;
    }

    // Dacă există o rută configurată pe channel_id, botul are prioritate.
    // deliverDiscordRoute încearcă webhook-ul aceleiași destinații ca fallback.
    const channelFallbackRoute = ['requests_organization', 'requests_departments'].includes(finalChannel) ? 'requests' : '';
    const hasConfiguredBotRoute = Object.keys(config?.discord_channel_routes?.[finalChannel] || {}).length
      || Object.keys(config?.discord_channel_routes?.[channelFallbackRoute] || {}).length;
    if (!globalMarketplaceChannel && finalChannel !== 'pontaj' && hasConfiguredBotRoute) {
      const delivery = await deliverDiscordRoute(db, config, finalChannel, forwardBody, { headers: forwardHeaders, fallbackRouteKey: channelFallbackRoute });
      return reply({ ok: true, channel: finalChannel, organization_id: sessionOrganizationId, routes: delivery.results.length, messages: delivery.results, fallback_failures: delivery.failures });
    }



    /*
     * ============================================================
     * WEBHOOK SELECTAT
     * ============================================================
     */


let route = null;


/*
 * ============================================================
 * ROUTARE CERERI
 * ============================================================
 *
 * requests:
 *  - primary = cereri organizație
 *  - secondary = cereri departamente
 *
 * Canalele noi:
 *  - requests_organization
 *  - requests_departments
 *
 */

if (finalChannel === 'requests_organization') {

  route =
    config.webhook_routes?.requests_organization || {
      primary: config.webhook_routes?.requests?.primary
    };

  const webhooks = [
    route?.primary?.url
  ]
  .filter(Boolean)
  .map(String);


  if (!webhooks.length && !routeCandidates(config, finalChannel, [], channelFallbackRoute).some((item) => item.candidates.length)) {

    throw new Error(
      'Webhook-ul requests.primary nu este configurat pentru cereri organizație.'
    );

  }


  forwardHeaders['X-Panel-Route'] =
    'requests.primary';


  // trimitem direct
  for (const webhook of webhooks) {

    const parsed = new URL(webhook);

    if (
      parsed.protocol !== 'https:' ||
      parsed.hostname !== 'discord.com'
    ) {

      throw new Error(
        'Webhook Discord invalid.'
      );

    }


    const sent =
      await fetch(
        webhook,
        {
          method:'POST',
          headers:forwardHeaders,
          body:forwardBody
        }
      );


    if (!sent.ok) {

      throw new Error(
        `Discord a răspuns cu HTTP ${sent.status}.`
      );

    }

  }


  return reply({

    ok:true,

    channel:
      finalChannel,

    organization_id:
      sessionOrganizationId,

    routes:
      webhooks.length

  });

}



if (finalChannel === 'requests_departments') {

  route =
    config.webhook_routes?.requests_departments || {
      primary: config.webhook_routes?.requests?.secondary
    };

  const webhooks = [
    route?.secondary?.url ||
    route?.primary?.url
  ]
  .filter(Boolean)
  .map(String);


  if (!webhooks.length && !routeCandidates(config, finalChannel, [], channelFallbackRoute).some((item) => item.candidates.length)) {

    throw new Error(
      'Webhook-ul requests.secondary nu este configurat pentru cereri departamente.'
    );

  }


  forwardHeaders['X-Panel-Route'] =
    'requests.secondary';


  for (const webhook of webhooks) {

    const parsed = new URL(webhook);


    if (
      parsed.protocol !== 'https:' ||
      parsed.hostname !== 'discord.com'
    ) {

      throw new Error(
        'Webhook Discord invalid.'
      );

    }


    const sent =
      await fetch(
        webhook,
        {
          method:'POST',
          headers:forwardHeaders,
          body:forwardBody
        }
      );


    if (!sent.ok) {

      throw new Error(
        `Discord a răspuns cu HTTP ${sent.status}.`
      );

    }

  }


  return reply({

    ok:true,

    channel:
      finalChannel,

    organization_id:
      sessionOrganizationId,

    routes:
      webhooks.length

  });

}


/*
 * Restul canalelor rămân exact cum erau
 */

let webhooks: string[];
let globalSettingsRows: any[] = [];

if (['marketplace', 'illegal_marketplace'].includes(finalChannel)) {
  const { data: activeOrganizations, error: organizationsError } = await db
    .from('organizations')
    .select('id')
    .eq('active', true);

  if (organizationsError) throw organizationsError;

  const organizationIds = (activeOrganizations || []).map((organization: any) => organization.id);
  if (!organizationIds.length) {
    throw new Error(`Nu există organizații active pentru ${finalChannel === 'marketplace' ? 'Marketplace' : 'Marketplace ilegal'}.`);
  }

  const { data: settingsRows, error: settingsError } = await db
    .from('organization_settings')
    .select('organization_id, webhook_routes, discord_channel_routes, marketplace_webhook_url, marketplace_secondary_webhook_url, illegal_marketplace_webhook_url, illegal_marketplace_secondary_webhook_url')
    .in('organization_id', organizationIds);

  if (settingsError) throw settingsError;
  globalSettingsRows = settingsRows || [];

  webhooks = [...new Set(
    (settingsRows || []).flatMap((settings: any) => {
      const route = settings.webhook_routes?.[finalChannel] || {};
      const legacy = finalChannel === 'marketplace'
        ? [settings.marketplace_webhook_url, settings.marketplace_secondary_webhook_url]
        : [settings.illegal_marketplace_webhook_url, settings.illegal_marketplace_secondary_webhook_url];
      return [route.primary?.url, route.secondary?.url, ...legacy].filter(Boolean).map(String);
    })
  )];

  if (!webhooks.length && !globalSettingsRows.some((settings) => {
    const legacy = finalChannel === 'marketplace'
      ? [settings.marketplace_webhook_url, settings.marketplace_secondary_webhook_url]
      : [settings.illegal_marketplace_webhook_url, settings.illegal_marketplace_secondary_webhook_url];
    return routeCandidates(settings, finalChannel, legacy).some((item) => item.candidates.length);
  })) {
    throw new Error(`Nu există niciun canal sau webhook configurat pentru ${finalChannel === 'marketplace' ? 'Marketplace' : 'Marketplace ilegal'}.`);
  }

  const globalMessages: any[] = [];
  const globalFailures: string[] = [];
  for (const settings of globalSettingsRows) {
    const legacy = finalChannel === 'marketplace'
      ? [settings.marketplace_webhook_url, settings.marketplace_secondary_webhook_url]
      : [settings.illegal_marketplace_webhook_url, settings.illegal_marketplace_secondary_webhook_url];
    if (!routeCandidates(settings, finalChannel, legacy).some((item) => item.candidates.length)) continue;
    try {
      const delivery = await deliverDiscordRoute(db, settings, finalChannel, forwardBody, { headers: forwardHeaders, legacyWebhookUrls: legacy });
      globalMessages.push(...delivery.results.map((item) => ({ ...item, organization_id: settings.organization_id })));
      globalFailures.push(...delivery.failures.map((failure) => `${settings.organization_id}: ${failure}`));
    } catch (error) {
      globalFailures.push(`${settings.organization_id}: ${error instanceof Error ? error.message : 'Eroare Discord.'}`);
    }
  }
  if (globalMessages.length) {
    return reply({ ok: true, channel: finalChannel, organization_id: sessionOrganizationId, routes: globalMessages.length, messages: globalMessages, fallback_failures: globalFailures });
  }
  if (globalFailures.length) throw new Error(globalFailures.join(' | '));
} else {
  route =
      config.webhook_routes?.[finalChannel];

  webhooks =
      [
        route?.primary?.url,
        route?.secondary?.url
      ]
      .filter(Boolean)
      .map(String);

  // Compatibilitate cu configurarea veche, care salvează Marketplace-ul
  // în coloanele dedicate, nu în webhook_routes.
  if (!webhooks.length && finalChannel === 'marketplace') {
    webhooks = [
      config.marketplace_webhook_url,
      config.marketplace_secondary_webhook_url
    ]
      .filter(Boolean)
      .map(String);
  }



  if (!webhooks.length && !routeCandidates(config, finalChannel).some((item) => item.candidates.length)) {

      throw new Error(
        `Webhook-ul ${finalChannel} nu este configurat pentru organizația activă.`
      );

  }
}



    /*
     * ============================================================
     * TRIMITERE DISCORD
     * ============================================================
     */


    const deliveredMessages: any[] = [];
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
    const updatedMessageRefs = { ...storedMessageRefs };
    const channelTargets = routeCandidates(config, finalChannel);
    if (channelTargets.some((item) => item.candidates.some((candidate) => candidate.transport === 'bot'))) {
      const messageIds: Record<string, string> = {};
      for (const item of channelTargets) {
        const channelId = config?.discord_channel_routes?.[finalChannel]?.[item.target]?.channel_id;
        const legacyRef = channelId ? storedMessageRefs[String(channelId)] : '';
        if (legacyRef) messageIds[item.target] = legacyRef;
      }
      const delivery = await deliverDiscordRoute(db, config, finalChannel, forwardBody, { headers: forwardHeaders, messageIds });
      for (const result of delivery.results || []) {
        const key = result.channel_id || result.url || result.target;
        if (result.id) updatedMessageRefs[String(key)] = String(result.id);
        deliveredMessages.push({ channel_id: result.channel_id || null, webhook: result.url || null, id: result.id, action: messageIds[result.target] ? 'edited' : 'created' });
      }
      if (!delivery.results.length) throw new Error(delivery.failures.join(' | ') || 'Discord nu a acceptat notificarea.');
    } else {
    for (const webhook of webhooks) {


      let parsed: URL;


      try {

        parsed =
          new URL(webhook);

      } catch {

        throw new Error(
          'Webhook Discord invalid.'
        );

      }



      if (
        parsed.protocol !== 'https:' ||
        parsed.hostname !== 'discord.com'
      ) {

        throw new Error(
          'Webhook Discord invalid.'
        );

      }



      let messageId = editExistingPontajMessage ? String(storedMessageRefs[webhook] || '') : '';
      let sent: Response | null = null;
      if (messageId) {
        sent = await fetch(editWebhookMessageUrl(webhook, messageId), {
          method: 'PATCH',
          headers: forwardHeaders,
          body: forwardBody
        });
        if (!sent.ok && [400, 404].includes(sent.status)) {
          messageId = '';
          sent = null;
        }
      }
      if (!sent) {
        sent = await fetch(executeWebhookUrl(webhook), {
          method: 'POST',
          headers: forwardHeaders,
          body: forwardBody
        });
      }



      if (!sent.ok) {

        throw new Error(
          `Discord a răspuns cu HTTP ${sent.status}.`
        );

      }
      if (editExistingPontajMessage) {
        if (!messageId) {
          try {
            const message = await sent.json();
            messageId = String(message?.id || '');
          } catch (_) {}
        }
        if (messageId) {
          updatedMessageRefs[webhook] = messageId;
          deliveredMessages.push({ webhook, id: messageId, action: storedMessageRefs[webhook] ? 'edited' : 'created' });
        }
      } else {
        try {
          const message = await sent.json();
          if (message?.id) deliveredMessages.push({ webhook, id: String(message.id), action: 'created' });
        } catch (_) {}
      }

    }
    }

    if (editExistingPontajMessage) {
      const { error: saveMessageRefsError } = await db.from('app_settings').upsert({
        organization_id: sessionOrganizationId,
        key: MESSAGE_REFS_KEY,
        value: { pontaj: { ...storedPontajMessageRefs, [pontajMessageKey]: updatedMessageRefs } },
        updated_at: new Date().toISOString()
      }, { onConflict: 'organization_id,key' });
      if (saveMessageRefsError) throw saveMessageRefsError;
    }



    return reply({

      ok:true,

      channel:
        finalChannel,

      organization_id:
        sessionOrganizationId,

      routes:
        webhooks.length,
      messages: deliveredMessages

    });



  } catch(error) {


    console.error(
      '[send-discord-notification]',
      error
    );


    return reply(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Eroare necunoscută.'
      },
      400
    );

  }

});
