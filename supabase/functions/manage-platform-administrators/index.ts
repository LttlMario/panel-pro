import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { requirePanelSession } from '../_shared/panel-session.ts';
import { isPlatformOwnerDiscordId } from '../_shared/platform-admin.ts';

const headers = {
  'Access-Control-Allow-Origin': 'https://lttlmario.github.io',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json'
};

const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const idPattern = /^\d{15,22}$/;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);

  try {
    const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    if (!secret) return reply({ error: 'Cheia secretă Supabase lipsește.' }, 500);

    const db = createClient(Deno.env.get('SUPABASE_URL')!, secret);
    const session = await requirePanelSession(db, request, 0, true);
    if (!isPlatformOwnerDiscordId(session.discord_id)) {
      return reply({ error: 'Doar proprietarul platformei poate acorda sau revoca administratori.' }, 403);
    }

    const { data: allowed, error: rateError } = await db.rpc('consume_panel_rate_limit', {
      p_key: `platform-admins:${session.discord_id}`,
      p_limit: 30,
      p_window_seconds: 900
    });
    if (rateError) throw rateError;
    if (allowed !== true) return reply({ error: 'Prea multe modificări. Încearcă din nou peste câteva minute.' }, 429);

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'list').trim();

    if (action === 'list') {
      const { data, error } = await db.from('platform_administrators')
        .select('discord_id,display_name,active,created_by_discord_id,created_at,updated_at,revoked_at')
        .order('active', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return reply({ ok: true, can_manage: true, owner_ids: [session.discord_id], administrators: data || [] });
    }

    const discordId = String(body.discord_id || '').trim();
    if (!idPattern.test(discordId)) return reply({ error: 'Discord ID invalid.' }, 400);
    if (isPlatformOwnerDiscordId(discordId)) return reply({ error: 'Proprietarul platformei este deja administrator principal.' }, 409);

    if (action === 'grant') {
      const displayName = String(body.display_name || '').trim().slice(0, 100) || null;
      const { data, error } = await db.from('platform_administrators').upsert({
        discord_id: discordId,
        display_name: displayName,
        active: true,
        created_by_discord_id: session.discord_id,
        updated_at: new Date().toISOString(),
        revoked_at: null
      }, { onConflict: 'discord_id' }).select('discord_id,display_name,active,created_at,updated_at,revoked_at').single();
      if (error) throw error;
      await db.from('admin_audit_log').insert({
        organization_id: session.organization_id,
        actor_discord_id: session.discord_id,
        action: 'platform_administrator_granted',
        target_type: 'platform_administrator',
        target_id: discordId,
        details: { display_name: displayName }
      });
      return reply({ ok: true, administrator: data });
    }

    if (action === 'revoke') {
      const { data, error } = await db.from('platform_administrators').update({
        active: false,
        revoked_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('discord_id', discordId).select('discord_id,display_name,active,created_at,updated_at,revoked_at').maybeSingle();
      if (error) throw error;
      if (!data) return reply({ error: 'Administratorul delegat nu există.' }, 404);
      await db.from('panel_sessions').update({ is_platform_admin: false }).eq('discord_id', discordId).is('revoked_at', null);
      await db.from('admin_audit_log').insert({
        organization_id: session.organization_id,
        actor_discord_id: session.discord_id,
        action: 'platform_administrator_revoked',
        target_type: 'platform_administrator',
        target_id: discordId,
        details: {}
      });
      return reply({ ok: true, administrator: data });
    }

    return reply({ error: 'Acțiune necunoscută.' }, 400);
  } catch (error) {
    console.error(error);
    return reply({ error: error instanceof Error ? error.message : 'Eroare internă.' }, 500);
  }
});
