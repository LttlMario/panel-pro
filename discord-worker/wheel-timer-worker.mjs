const supabaseUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const discordToken = String(process.env.DISCORD_BOT_TOKEN || '');
const intervalMs = Math.max(1000, Number(process.env.WHEEL_TIMER_INTERVAL_MS || 1000));
const api = 'https://discord.com/api/v10';

if (!supabaseUrl || !serviceKey || !discordToken) throw new Error('Setează SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY și DISCORD_BOT_TOKEN.');

const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
const discordHeaders = { Authorization: `Bot ${discordToken}`, 'Content-Type': 'application/json' };
const pad = (value) => String(value).padStart(2, '0');
const content = (completesAt) => {
  const remaining = Math.max(0, Date.parse(String(completesAt || '')) - Date.now());
  const total = Math.ceil(remaining / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const updatedAt = Math.floor(Date.now() / 1000);
  return remaining > 0
    ? `🎡 **Timer roată activ**\n\n**Timp rămas:** **${hours}h ${pad(minutes)}m ${pad(seconds)}s**\n\nAcest mesaj se actualizează automat.\n🕒 **Edited at:** <t:${updatedAt}:f>`
    : '✅ **Timerul roții a expirat.**\n\nPoți folosi din nou roata.';
};

async function loadTimers() {
  const response = await fetch(`${supabaseUrl}/rest/v1/wheel_timers?status=eq.active&select=id,completes_at,notification_error`, { headers });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  return response.json();
}

async function editMessage(timer, metadata) {
  const response = await fetch(`${api}/channels/${metadata.channel_id}/messages/${metadata.message_id}`, {
    method: 'PATCH', headers: discordHeaders, body: JSON.stringify({ allowed_mentions: { parse: [] }, content: content(timer.completes_at) }),
  });
  if (response.ok) return true;
  const body = await response.text();
  if (response.status === 404) return false;
  throw new Error(`Discord ${response.status}: ${body}`);
}

async function tick() {
  const timers = await loadTimers();
  for (const timer of timers) {
    let metadata;
    try { metadata = JSON.parse(String(timer.notification_error || '')).wheel_live; } catch (_) { metadata = null; }
    if (!metadata?.channel_id || !metadata?.message_id) continue;
    try { await editMessage(timer, metadata); } catch (error) { console.error(`[wheel ${timer.id}]`, error.message || error); }
  }
}

console.log(`Panel Pro wheel worker pornit; interval ${intervalMs}ms.`);
await tick().catch((error) => console.error(error));
setInterval(() => tick().catch((error) => console.error('[wheel-worker]', error)), intervalMs);
