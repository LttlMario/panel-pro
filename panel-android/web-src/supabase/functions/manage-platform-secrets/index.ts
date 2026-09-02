import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { requirePanelSession } from '../_shared/panel-session.ts';
import { isPlatformAdminAccount } from '../_shared/platform-admin.ts';

const headers = {
  'Access-Control-Allow-Origin': 'https://panel-pro.ro',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const allowed = new Set([
  'project_url', 'publishable_key', 'cron_secret', 'discord_bot_token',
  'platform_owner_discord_ids', 'status_live_cron_secret',
  'public_community_channel_primary', 'public_community_channel_secondary',
  'public_rating_channel_primary', 'public_rating_channel_secondary',
]);
// URL-ul proiectului și cheia publishable sunt valori publice de conectare,
// nu secrete operaționale. Ele rămân disponibile server-side pentru joburile
// vechi, dar sunt administrate separat în Setări platformă.
const visibleSecrets = new Set([...allowed].filter((name) => ![
  'project_url', 'publishable_key',
].includes(name)));
const appliedTo: Record<string, string[]> = {
  project_url: ['joburile cron din Supabase'],
  publishable_key: ['joburile cron din Supabase', 'conectarea publică a panelului'],
  cron_secret: ['close-expired-shifts', 'send-weekly-shift-report', 'send-organization-expiry-notifications', 'status-live-sync'],
  discord_bot_token: ['sincronizarea rolurilor Discord', 'configurarea serverelor', 'verificările organizațiilor'],
  platform_owner_discord_ids: ['autorizarea administratorilor globali'],
  status_live_cron_secret: ['status-live-sync'],
  public_community_channel_primary: ['sugestii globale · bot · Discord principal'],
  public_community_channel_secondary: ['sugestii globale · bot · Discord secundar'],
  public_rating_channel_primary: ['Rate the Panel · bot · Discord principal'],
  public_rating_channel_secondary: ['Rate the Panel · bot · Discord secundar'],
};
const secretKey = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);
  if (!String(request.headers.get('x-panel-session') || '').trim()) return reply({ error: 'Sesiunea securizată a panelului lipsește.' }, 401);
  try {
    const key = secretKey();
    if (!key) return reply({ error: 'Cheia serverului lipsește.' }, 500);
    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    const session = await requirePanelSession(db, request, 0, true);
    if (!(await isPlatformAdminAccount(db, session.discord_id))) return reply({ error: 'Acces permis doar administratorului platformei.' }, 403);
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'list').trim();
    if (action === 'list') {
      const { data, error } = await db.rpc('get_panel_platform_secret_status');
      if (error) throw error;
      return reply({ secrets: (Array.isArray(data) ? data : []).filter((item: any) => visibleSecrets.has(String(item.name))).map((item: any) => ({ ...item, applied_to: appliedTo[item.name] || [] })) });
    }
    const name = String(body.name || '').trim();
    if (!allowed.has(name)) return reply({ error: 'Secret necunoscut sau nepermis.' }, 400);
    if (action === 'apply') {
      const { data, error } = await db.rpc('get_panel_platform_secret', { secret_name: name });
      if (error) throw error;
      if (!String(data || '').trim()) return reply({ error: 'Secretul nu este configurat.' }, 409);
      return reply({ ok: true, name, applied_to: appliedTo[name] || [] });
    }
    if (action === 'test_bot_channel') {
      if (!name.startsWith('public_community_channel_') && !name.startsWith('public_rating_channel_')) return reply({ error: 'Testarea este disponibilă doar pentru canalele globale ale botului.' }, 400);
      const secretResult = await db.rpc('get_panel_platform_secret', { secret_name: name });
      const channelId = String(secretResult.data || '').trim();
      if (secretResult.error) throw secretResult.error;
      if (!/^\d{15,22}$/.test(channelId)) return reply({ error: 'Secretul nu conține un Channel ID Discord valid.' }, 400);
      const botToken = await db.rpc('get_panel_platform_secret', { secret_name: 'discord_bot_token' });
      if (botToken.error || !String(botToken.data || '').trim()) return reply({ error: 'Tokenul botului Discord nu este configurat.' }, 409);
      const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, { method: 'POST', headers: { Authorization: `Bot ${String(botToken.data).trim()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ content: '✅ Test canal bot global Panel Pro.', allowed_mentions: { parse: [] } }) });
      if (!response.ok) return reply({ error: `Discord a răspuns cu HTTP ${response.status}.` }, 400);
      return reply({ ok: true, name });
    }
    if (action === 'set') {
      const value = String(body.value || '').trim();
      if (!value) return reply({ error: 'Introdu o valoare.' }, 400);
      if (name === 'project_url' && !/^https:\/\//i.test(value)) return reply({ error: 'URL-ul trebuie să înceapă cu https://.' }, 400);
      if (name === 'platform_owner_discord_ids' && value.split(',').some((id: string) => !/^\d{15,22}$/.test(id.trim()))) return reply({ error: 'ID-urile Discord sunt invalide.' }, 400);
      if (name === 'cron_secret' && value.length < 32) return reply({ error: 'Secretul cron trebuie să aibă cel puțin 32 de caractere.' }, 400);
      if (name.startsWith('public_community_channel_') || name.startsWith('public_rating_channel_')) {
        if (!/^\d{15,22}$/.test(value)) return reply({ error: 'Introdu un Channel ID Discord valid.' }, 400);
      }
      const { data, error } = await db.rpc('set_panel_platform_secret', { secret_name: name, secret_value: value });
      if (error) throw error;
      await db.from('admin_audit_log').insert({ organization_id: session.organization_id, actor_discord_id: session.discord_id, action: 'platform_secret_updated', target_type: 'platform_secret', target_id: name, details: { applied_to: appliedTo[name] || [] } });
      return reply({ ...data, applied_to: appliedTo[name] || [] });
    }
    return reply({ error: 'Acțiune necunoscută.' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Eroare internă.';
    if (/Sesiunea panelului|Sesiunea securizată|Autentifică-te din nou/i.test(message)) return reply({ error: message }, 401);
    return reply({ error: message }, 500);
  }
});
