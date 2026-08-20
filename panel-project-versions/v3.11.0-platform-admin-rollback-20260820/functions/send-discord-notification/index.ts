import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { requirePanelSession } from '../_shared/panel-session.ts';
import { resolvePackageFeatures } from '../_shared/package-features.ts';

const cors = {
  'Access-Control-Allow-Origin': 'https://lttlmario.github.io',
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
  marketplace: 1,
  illegal_marketplace: 1,
  live_status: 1
};

const channels = new Set(Object.keys(levels));


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
        'Cheia service role lipseÈ™te.'
      );
    }


    const supabaseUrl =
      Deno.env.get('SUPABASE_URL');


    if (!supabaseUrl) {
      throw new Error(
        'SUPABASE_URL lipseÈ™te.'
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
        'OrganizaÈ›ia activă nu a fost identificată.'
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
        'OrganizaÈ›ia solicitată nu corespunde organizaÈ›iei active.'
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
     * CONFIG ORGANIZAÈšIE
     * ============================================================
     */


    let config: any = null;

    if (finalChannel !== 'illegal_marketplace') {
      const {
        data: organizationConfig,
        error: configError

    } =
      await db
        .from('organization_settings')
        .select('webhook_routes, marketplace_webhook_url, marketplace_secondary_webhook_url')
        .eq(
          'organization_id',
          sessionOrganizationId
        )
        .maybeSingle();



      if (configError)
        throw configError;



      if (!organizationConfig) {

      throw new Error(
        'ConfiguraÈ›ia organizaÈ›iei active nu a fost găsită.'
      );

      }

      config = organizationConfig;
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
 *  - primary = cereri organizaÈ›ie
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


  if (!webhooks.length) {

    throw new Error(
      'Webhook-ul requests.primary nu este configurat pentru cereri organizaÈ›ie.'
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


  if (!webhooks.length) {

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

if (finalChannel === 'illegal_marketplace') {
  const { data: activeOrganizations, error: organizationsError } = await db
    .from('organizations')
    .select('id')
    .eq('active', true);

  if (organizationsError) throw organizationsError;

  const organizationIds = (activeOrganizations || []).map((organization: any) => organization.id);
  if (!organizationIds.length) {
    throw new Error('Nu există organizații active pentru Marketplace ilegal.');
  }

  const { data: settingsRows, error: settingsError } = await db
    .from('organization_settings')
    .select('organization_id, webhook_routes, illegal_marketplace_webhook_url, illegal_marketplace_secondary_webhook_url')
    .in('organization_id', organizationIds);

  if (settingsError) throw settingsError;

  webhooks = [...new Set(
    (settingsRows || []).flatMap((settings: any) => [
      settings.webhook_routes?.illegal_marketplace?.primary?.url,
      settings.webhook_routes?.illegal_marketplace?.secondary?.url,
      settings.illegal_marketplace_webhook_url,
      settings.illegal_marketplace_secondary_webhook_url
    ]).filter(Boolean).map(String)
  )];

  if (!webhooks.length) {
    throw new Error('Nu există niciun webhook configurat pentru Marketplace ilegal.');
  }
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



  if (!webhooks.length) {

      throw new Error(
        `Webhook-ul ${finalChannel} nu este configurat pentru organizaÈ›ia activă.`
      );

  }
}



    /*
     * ============================================================
     * TRIMITERE DISCORD
     * ============================================================
     */


    const deliveredMessages: any[] = [];
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



      const discordUrl = `${webhook}${webhook.includes('?') ? '&' : '?'}wait=true`;
      const sent =
        await fetch(
          discordUrl,
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
      try {
        const message = await sent.json();
        if (message?.id) deliveredMessages.push({ webhook, id: String(message.id) });
      } catch (_) {}

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
