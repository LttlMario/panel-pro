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
const secretKey = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;

const definitions: Record<string, { label: string; description: string; type: string; defaultValue: string }> = {
  site_mode: { label: 'Adresă activă', description: 'Alege adresa publică principală a platformei.', type: 'select', defaultValue: 'custom_domain' },
  primary_public_url: { label: 'Domeniu public principal', description: 'Adresa principală pe care o distribui utilizatorilor.', type: 'url', defaultValue: 'https://panel-pro.ro' },
  github_pages_url: { label: 'Adresă GitHub Pages de rezervă', description: 'Adresa proiectului GitHub Pages, păstrată pentru testare sau revenire.', type: 'url', defaultValue: 'https://lttlmario.github.io/panel-pro' },
  discord_oauth_redirect_uri: { label: 'Callback Discord OAuth', description: 'Adresa exactă în care Discord întoarce autentificarea.', type: 'url', defaultValue: 'https://panel-pro.ro/login.html' },
  supabase_project_url: { label: 'URL proiect Supabase', description: 'Endpointul public al proiectului Supabase folosit de frontend și funcții.', type: 'url', defaultValue: 'https://vkvsabbbawyiurnaiugo.supabase.co' },
  supabase_publishable_key: { label: 'Cheie publică Supabase', description: 'Cheia publishable/anon. Nu este cheia service role.', type: 'public_key', defaultValue: 'sb_publishable_gRM7uXmfknjfFiOg7jjqDA_y-VGPMVD' },
  discord_client_id: { label: 'Discord Application / Client ID', description: 'ID-ul public al aplicației Discord folosite la OAuth.', type: 'discord_id', defaultValue: '1531023771211792384' },
  github_repository_url: { label: 'Repository GitHub', description: 'Repository-ul din care se publică frontendul.', type: 'url', defaultValue: 'https://github.com/lttlmario/panel-pro' },
};
const allowed = new Set(Object.keys(definitions));
const normalizeUrl = (value: unknown, label: string, allowPath = true) => {
  const raw = String(value || '').trim().replace(/\/+$/, '');
  if (!raw) throw new Error(`${label} nu poate fi gol.`);
  let parsed: URL;
  try { parsed = new URL(raw); } catch (_) { throw new Error(`${label} nu este un URL valid.`); }
  if (parsed.protocol !== 'https:') throw new Error(`${label} trebuie să înceapă cu https://.`);
  if (!allowPath && parsed.pathname !== '/') throw new Error(`${label} trebuie să conțină doar domeniul, fără cale.`);
  return raw;
};
const validateValue = (name: string, value: unknown) => {
  const raw = String(value || '').trim();
  if (name === 'site_mode') {
    if (!['custom_domain', 'github_pages'].includes(raw)) throw new Error('Adresa activă este invalidă.');
    return raw;
  }
  if (name === 'primary_public_url') return normalizeUrl(raw, 'Domeniul public principal', false);
  if (name === 'github_pages_url') return normalizeUrl(raw, 'Adresa GitHub Pages');
  if (name === 'discord_oauth_redirect_uri') {
    const result = normalizeUrl(raw, 'Callback Discord OAuth');
    if (!new URL(result).pathname.endsWith('/login.html')) throw new Error('Callback-ul Discord trebuie să se termine în /login.html.');
    return result;
  }
  if (name === 'supabase_project_url') {
    const result = normalizeUrl(raw, 'URL proiect Supabase', false);
    if (!new URL(result).hostname.endsWith('.supabase.co')) throw new Error('URL-ul Supabase trebuie să fie un proiect Supabase valid.');
    return result;
  }
  if (name === 'supabase_publishable_key') {
    if (raw.length < 20 || !/^(sb_publishable_|eyJ|anon)/i.test(raw)) throw new Error('Cheia publică Supabase nu pare validă.');
    return raw;
  }
  if (name === 'discord_client_id') {
    if (!/^\d{15,22}$/.test(raw)) throw new Error('Discord Client ID este invalid.');
    return raw;
  }
  return normalizeUrl(raw, 'Repository GitHub');
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);
  try {
    const key = secretKey();
    if (!key) return reply({ error: 'Cheia serverului lipsește.' }, 500);
    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    const session = await requirePanelSession(db, request, 0, true);
    if (!(await isPlatformAdminAccount(db, session.discord_id))) return reply({ error: 'Acces permis doar administratorului platformei.' }, 403);
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'list').trim();
    if (action === 'list') {
      const { data, error } = await db.from('platform_settings').select('key,value,updated_at').in('key', [...allowed]);
      if (error) throw error;
      const stored = new Map((data || []).map((item: any) => [String(item.key), item]));
      return reply({ settings: Object.entries(definitions).map(([keyName, definition]) => ({ name: keyName, ...definition, value: String(stored.get(keyName)?.value?.value ?? definition.defaultValue), updated_at: stored.get(keyName)?.updated_at || null })) });
    }
    if (action !== 'set') return reply({ error: 'Acțiune necunoscută.' }, 400);
    const name = String(body.name || '').trim();
    if (!allowed.has(name)) return reply({ error: 'Setare necunoscută sau nepermisă.' }, 400);
    const value = validateValue(name, body.value);
    const { error } = await db.from('platform_settings').upsert({ key: name, value: { value, source: 'platform-settings' }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
    await db.from('admin_audit_log').insert({ organization_id: session.organization_id, actor_discord_id: session.discord_id, action: 'platform_setting_updated', target_type: 'platform_setting', target_id: name, details: { setting: name } });
    return reply({ ok: true, name, value });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Eroare internă.';
    return reply({ error: message }, /Sesiunea panelului|Autentifică-te din nou/i.test(message) ? 401 : 400);
  }
});
