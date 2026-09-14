import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { requirePanelSession } from '../_shared/panel-session.ts';

const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-panel-session', 'Access-Control-Allow-Methods':'POST, OPTIONS', 'Content-Type':'application/json' };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: cors });
const db = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default, { auth: { persistSession:false } });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const body = await request.json().catch(() => ({}));
    const client = db();
    const session = await requirePanelSession(client, request, 0);
    if (!session.is_platform_admin) return reply({ error:'Acces permis doar administratorului global.' }, 403);
    const action = String(body.action || 'list');
    if (action === 'list') {
      const { data, error } = await client.from('platform_media_assets').select('*').order('created_at', { ascending:false });
      if (error) throw error; return reply({ assets:data || [] });
    }
    if (action === 'upload') {
      const dataUrl = String(body.data_url || '');
      const match = dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
      if (!match) throw new Error('Imaginea trebuie trimisă în format PNG.');
      const binary = Uint8Array.from(atob(match[1]), (char) => char.charCodeAt(0));
      if (!binary.length || binary.length > 8 * 1024 * 1024) throw new Error('Imaginea trebuie să aibă maximum 8 MB.');
      const path = `platform/${crypto.randomUUID()}.png`;
      const { error: uploadError } = await client.storage.from('panel-media').upload(path, binary, { contentType:'image/png', cacheControl:'31536000', upsert:false });
      if (uploadError) throw uploadError;
      const publicUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/panel-media/${path}`;
      const { data, error } = await client.from('platform_media_assets').insert({ file_path:path, public_url:publicUrl, original_name:String(body.original_name || 'imagine.png').slice(0,180), size_bytes:binary.length, created_by_discord_id:session.discord_id }).select('*').single();
      if (error) { await client.storage.from('panel-media').remove([path]); throw error; }
      return reply({ asset:data });
    }
    if (action === 'delete') {
      const { data: asset, error: readError } = await client.from('platform_media_assets').select('file_path').eq('id', String(body.id)).maybeSingle();
      if (readError) throw readError; if (!asset) return reply({ error:'Imaginea nu există.' }, 404);
      const { error: storageError } = await client.storage.from('panel-media').remove([asset.file_path]); if (storageError) throw storageError;
      const { error } = await client.from('platform_media_assets').delete().eq('id', String(body.id)); if (error) throw error;
      return reply({ ok:true });
    }
    return reply({ error:'Acțiune necunoscută.' }, 400);
  } catch (error) { return reply({ error:error instanceof Error ? error.message : 'Eroare internă.' }, 400); }
});
