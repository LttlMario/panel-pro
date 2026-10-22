import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';
import { requestDiscordTarget } from '../_shared/discord-delivery.ts';

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://panel-pro.ro', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-cron-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const secretKey = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
const footer = 'Panel Pro - By Little Mario · Giveaway';
const payloadFor = (row: any, participants: any[], winners: any[]) => ({ allowed_mentions: { parse: [] }, embeds: [{ title: `🏁 Giveaway închis · ${String(row.title).slice(0, 200)}`, description: String(row.details || 'Giveaway închis automat la expirarea termenului.').slice(0, 4000), color: 0x64748b, fields: [{ name: '🎁 Premiu', value: String(row.prize).slice(0, 1024), inline: true }, { name: '👥 Participanți', value: String(participants.length), inline: true }, { name: '🏆 Câștigători', value: winners.length ? winners.map((item: any) => `<@${item.discord_id}>`).join(', ') : 'Nu au existat participanți.', inline: false }], footer: { text: footer }, timestamp: new Date().toISOString() }], components: [{ type: 1, components: [{ type: 2, style: 3, label: '🎉 Participă', custom_id: `panel:giveaway:join:${row.id}`, disabled: true }] }] });
const resultPayloadFor = (row: any, participants: any[], winners: any[]) => ({ allowed_mentions: { parse: [] }, embeds: [{ title: `🏆 Rezultat giveaway · ${String(row.title).slice(0, 200)}`, description: `🎁 Premiu: **${String(row.prize).slice(0, 200)}**\n👥 Participanți: **${participants.length}**\n🏆 Câștigători: ${winners.length ? winners.map((item: any) => `<@${item.discord_id}>`).join(', ') : 'Nu au existat participanți.'}`, color: 0xf59e0b, footer: { text: footer }, timestamp: new Date().toISOString() }] });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, secretKey());
  const cronSecret = await getPlatformSecret(db, 'cron_secret');
  if (!cronSecret || request.headers.get('x-cron-secret') !== cronSecret) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  const now = new Date();
  const { data: rows, error } = await db.from('discord_giveaways').select('*').eq('status', 'active').lte('ends_at', now.toISOString()).limit(100);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
  let processed = 0;
  for (const row of rows || []) {
    const { data: participants } = await db.from('discord_giveaway_participants').select('discord_id,display_name').eq('giveaway_id', row.id).order('joined_at', { ascending: true });
    const list = participants || [];
    const winners = [...list].sort(() => Math.random() - 0.5).slice(0, Math.min(Number(row.winner_count || 1), list.length));
    const closedAt = now.toISOString();
    const { data: closed } = await db.from('discord_giveaways').update({ status: 'closed', winners, closed_at: closedAt, updated_at: closedAt }).eq('id', row.id).eq('status', 'active').select('*').maybeSingle();
    if (!closed) continue;
    const payload = payloadFor(closed, list, winners);
    if (closed.message_id) await requestDiscordTarget(db, { target: row.target, transport: 'bot', channel_id: row.channel_id }, JSON.stringify(payload), { method: 'PATCH', messageId: row.message_id });
    await requestDiscordTarget(db, { target: row.target, transport: 'bot', channel_id: row.channel_id }, JSON.stringify(resultPayloadFor(closed, list, winners)), { method: 'POST' });
    processed += 1;
  }
  return new Response(JSON.stringify({ ok: true, processed }), { headers });
});
