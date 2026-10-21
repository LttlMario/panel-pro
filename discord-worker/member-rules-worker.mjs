// Ascultă intrările pe server și trimite membrului un DM cu link direct către
// canalul de regulament configurat în Panel Pro. Rulează cu același bot token.
const supabaseUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const discordToken = String(process.env.DISCORD_BOT_TOKEN || '');
const api = 'https://discord.com/api/v10';
const gatewayUrl = 'wss://gateway.discord.gg/?v=10&encoding=json';
if (!supabaseUrl || !serviceKey || !discordToken) throw new Error('Setează SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY și DISCORD_BOT_TOKEN.');

const dbHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
const discordHeaders = { Authorization: `Bot ${discordToken}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function discord(path, options = {}) {
  const response = await fetch(`${api}${path}`, { ...options, headers: { ...discordHeaders, ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`Discord ${response.status}: ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

async function loadGuildRules() {
  const guildsResponse = await fetch(`${supabaseUrl}/rest/v1/organization_guilds?enabled=eq.true&select=organization_id,guild_id,kind`, { headers: dbHeaders });
  if (!guildsResponse.ok) throw new Error(`Supabase guilds ${guildsResponse.status}: ${await guildsResponse.text()}`);
  const guilds = await guildsResponse.json();
  const ids = [...new Set(guilds.map((row) => row.organization_id).filter(Boolean))];
  if (!ids.length) return new Map();
  const settingsResponse = await fetch(`${supabaseUrl}/rest/v1/organization_settings?organization_id=in.(${ids.join(',')})&select=organization_id,discord_channel_routes`, { headers: dbHeaders });
  if (!settingsResponse.ok) throw new Error(`Supabase settings ${settingsResponse.status}: ${await settingsResponse.text()}`);
  const settings = new Map((await settingsResponse.json()).map((row) => [String(row.organization_id), row]));
  return new Map(guilds.map((guild) => {
    const route = settings.get(String(guild.organization_id))?.discord_channel_routes?.rules?.[guild.kind === 'secondary' ? 'secondary' : 'primary'];
    return [String(guild.guild_id), { organizationId: String(guild.organization_id), channelId: String(route?.channel_id || ''), kind: guild.kind }];
  }).filter(([, item]) => /^\d{15,22}$/.test(item.channelId)));
}

async function sendRulesDm(guildId, member, config) {
  const userId = String(member?.user?.id || '');
  if (!/^\d{15,22}$/.test(userId)) return;
  const channelUrl = `https://discord.com/channels/${guildId}/${config.channelId}`;
  const dm = await discord('/users/@me/channels', { method: 'POST', body: JSON.stringify({ recipient_id: userId }) });
  await discord(`/channels/${dm.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      allowed_mentions: { parse: [] },
      embeds: [{
        title: '📜 Bine ai venit pe server!',
        description: 'Înainte să folosești serverul, te rugăm să citești regulamentul organizației. Deschide canalul de mai jos, parcurge regulile și apasă butonul **✅ Am citit regulamentul**.',
        color: 0xf59e0b,
        footer: { text: 'Panel Pro · Regulament' },
      }],
      components: [{ type: 1, components: [{ type: 2, style: 5, label: '📖 Deschide regulamentul', url: channelUrl }] }],
    }),
  });
}

async function connect() {
  const socket = new WebSocket(gatewayUrl);
  let heartbeat;
  socket.addEventListener('message', async (event) => {
    const packet = JSON.parse(String(event.data));
    if (packet.op === 10) {
      const interval = Number(packet.d?.heartbeat_interval || 41250);
      heartbeat = setInterval(() => socket.send(JSON.stringify({ op: 1, d: null })), interval);
      socket.send(JSON.stringify({ op: 2, d: { token: discordToken, intents: 3, properties: { os: 'linux', browser: 'panel-pro', device: 'panel-pro' } } }));
      return;
    }
    if (packet.op === 0 && packet.t === 'GUILD_MEMBER_ADD') {
      try {
        // Lăsăm puțin timp fluxului existent de auto-rol să se încheie.
        await sleep(1200);
        const configs = await loadGuildRules();
        const config = configs.get(String(packet.d?.guild_id));
        if (config) await sendRulesDm(String(packet.d.guild_id), packet.d, config);
      } catch (error) { console.error('[member-rules]', error.message || error); }
    }
    if (packet.op === 9) { clearInterval(heartbeat); socket.close(); setTimeout(connect, 3000); }
  });
  socket.addEventListener('close', () => { clearInterval(heartbeat); setTimeout(connect, 3000); });
  socket.addEventListener('error', (error) => console.error('[member-rules gateway]', error.message || error));
}

console.log('Panel Pro member-rules worker pornit.');
connect();
