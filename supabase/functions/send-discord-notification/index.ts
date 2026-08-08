import { createClient } from 'jsr:@supabase/supabase-js@2';
import { requirePanelSession } from '../_shared/panel-session.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
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
        error: 'MetodÄƒ invalidÄƒ.'
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


    if (!session?.organization_id) {

      throw new Error(
        'OrganizaÈ›ia activÄƒ nu a fost identificatÄƒ.'
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
        'OrganizaÈ›ia solicitatÄƒ nu corespunde organizaÈ›iei active.'
      );

    }



    /*
     * ============================================================
     * CONFIG ORGANIZAÈšIE
     * ============================================================
     */


    const {
      data: config,
      error: configError

    } =
      await db
        .from('organization_settings')
        .select('webhook_routes')
        .eq(
          'organization_id',
          sessionOrganizationId
        )
        .maybeSingle();



    if (configError)
      throw configError;



    if (!config) {

      throw new Error(
        'ConfiguraÈ›ia organizaÈ›iei active nu a fost gÄƒsitÄƒ.'
      );

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
        `Discord a rÄƒspuns cu HTTP ${sent.status}.`
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
        `Discord a rÄƒspuns cu HTTP ${sent.status}.`
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
 * Restul canalelor rÄƒmÃ¢n exact cum erau
 */

route =
      config.webhook_routes?.[finalChannel];


const webhooks =
      [
        route?.primary?.url,
        route?.secondary?.url
      ]
      .filter(Boolean)
      .map(String);



    if (!webhooks.length) {

      throw new Error(
        `Webhook-ul ${finalChannel} nu este configurat pentru organizaÈ›ia activÄƒ.`
      );

    }



    /*
     * ============================================================
     * TRIMITERE DISCORD
     * ============================================================
     */


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
          `Discord a rÄƒspuns cu HTTP ${sent.status}.`
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
            : 'Eroare necunoscutÄƒ.'
      },
      400
    );

  }

});
