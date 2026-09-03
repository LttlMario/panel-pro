import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';

const DISCORD_PUBLIC_KEY = () => String(Deno.env.get('DISCORD_PUBLIC_KEY') || Deno.env.get('DISCORD_APPLICATION_PUBLIC_KEY') || '').trim();
const id = (value: unknown) => /^\d{15,22}$/.test(String(value || '').trim());
const hexBytes = (value: string, length: number) => {
  if (!new RegExp(`^[0-9a-f]{${length * 2}}$`, 'i').test(value)) return null;
  const bytes = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  return bytes;
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

async function verifySignature(request: Request, rawBody: string) {
  const publicKey = hexBytes(DISCORD_PUBLIC_KEY(), 32);
  const signature = hexBytes(String(request.headers.get('x-signature-ed25519') || '').trim(), 64);
  const timestamp = String(request.headers.get('x-signature-timestamp') || '').trim();
  if (!publicKey || !signature || !/^\d{1,20}$/.test(timestamp)) return false;
  try {
    const key = await crypto.subtle.importKey('raw', publicKey, { name: 'Ed25519' }, false, ['verify']);
    return await crypto.subtle.verify({ name: 'Ed25519' }, key, signature, new TextEncoder().encode(`${timestamp}${rawBody}`));
  } catch (error) {
    console.error('[discord-app-events] signature verification failed', error);
    return false;
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Metoda nu este permisă.' }, 405);
  const rawBody = await request.text();
  if (!(await verifySignature(request, rawBody))) return json({ error: 'Semnătură Discord invalidă.' }, 401);
  let body: any;
  try { body = JSON.parse(rawBody); } catch { return json({ error: 'Payload invalid.' }, 400); }
  if (Number(body?.type) === 0) return new Response(null, { status: 204 });
  if (Number(body?.type) !== 1 || !body?.event?.type) return new Response(null, { status: 204 });
  const event = body.event;
  const data = event.data || {};
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default);
  const eventType = String(event.type);
  const guild = data.guild || {};
  const guildId = String(guild.id || '').trim();
  if (eventType === 'APPLICATION_AUTHORIZED' && Number(data.integration_type) === 0 && id(guildId)) {
    const { data: linked } = await db.from('organization_guilds').select('organization_id').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
    const now = String(event.timestamp || new Date().toISOString());
    const { error } = await db.from('discord_bot_installations').upsert({
      guild_id: guildId,
      guild_name: String(guild.name || `Server Discord ${guildId}`).trim().slice(0, 120),
      authorized_by_discord_id: id(data.user?.id) ? String(data.user.id) : null,
      organization_id: linked?.organization_id || null,
      integration_type: 0,
      status: 'active',
      installed_at: now,
      removed_at: null,
      last_event_at: now,
      raw_event: body,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'guild_id' });
    if (error) { console.error('[discord-app-events] install upsert failed', error); return json({ error: 'Nu s-a putut salva instalarea.' }, 500); }
  }
  // Discord's deauthorization event contains the user, but not a guild. It is
  // intentionally not used to remove guild rows because a user can deauthorize
  // while the bot remains installed in a server.
  return new Response(null, { status: 204 });
});
