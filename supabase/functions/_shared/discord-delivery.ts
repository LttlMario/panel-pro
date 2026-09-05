import { getPlatformSecret } from './platform-secrets.ts';

const DISCORD_API = 'https://discord.com/api/v10';
const TARGETS = ['primary', 'secondary'] as const;

export type DiscordDeliveryTarget = {
  target: string;
  transport: 'bot';
  channel_id?: string;
  guild_id?: string;
  message_id?: string;
};

export const validDiscordChannelId = (value: unknown) => /^\d{15,22}$/.test(String(value || '').trim());

const clean = (value: unknown, max = 500) => String(value || '').trim().slice(0, max);
const errorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object') {
    const value = error as Record<string, unknown>;
    if (String(value.message || '').trim()) return String(value.message).trim();
    if (String(value.details || '').trim()) return String(value.details).trim();
    if (String(value.hint || '').trim()) return String(value.hint).trim();
  }
  return 'Eroare Discord.';
};

export const routeCandidates = (settings: any, routeKey: string, _legacyWebhookUrls: string[] = [], fallbackRouteKey = '') => {
  const channelRoutes = settings?.discord_channel_routes || {};
  const channelRoute = channelRoutes?.[routeKey] || {};
  const fallbackRoute = channelRoutes?.[fallbackRouteKey] || {};
  return TARGETS.map((target) => {
    const candidates: DiscordDeliveryTarget[] = [];
    const channel = channelRoute?.[target] || fallbackRoute?.[target];
    if (channel?.enabled !== false && validDiscordChannelId(channel?.channel_id)) {
      candidates.push({
        target,
        transport: 'bot',
        channel_id: clean(channel.channel_id, 30),
        guild_id: validDiscordChannelId(channel.guild_id) ? clean(channel.guild_id, 30) : '',
        message_id: validDiscordChannelId(channel.message_id) ? clean(channel.message_id, 30) : '',
      });
    }
    return { target, candidates };
  });
};

const jsonHeaders = (body: BodyInit | null, headers: Record<string, string> = {}) => {
  const result = { 'User-Agent': 'Panel Pro Discord Bot (+https://panel-pro.ro)', ...headers };
  if (typeof body === 'string' && !Object.keys(result).some((key) => key.toLowerCase() === 'content-type')) {
    result['Content-Type'] = 'application/json';
  }
  return result;
};

async function discordBotIdentity(db: any) {
  try {
    const botToken = await getPlatformSecret(db, 'discord_bot_token');
    if (!botToken) return '';
    const response = await fetch(`${DISCORD_API}/users/@me`, { headers: { Authorization: `Bot ${botToken}` } });
    if (!response.ok) return '';
    const user = await response.json().catch(() => ({}));
    const name = String(user?.global_name || user?.username || '').trim();
    const id = String(user?.id || '').trim();
    return name && id ? `${name} (${id})` : id || name;
  } catch (_) {
    return '';
  }
}

async function discordChannelSummary(db: any, channelId: string) {
  try {
    const botToken = await getPlatformSecret(db, 'discord_bot_token');
    if (!botToken || !validDiscordChannelId(channelId)) return '';
    const response = await fetch(`${DISCORD_API}/channels/${encodeURIComponent(channelId)}`, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    const channel = await response.json().catch(() => ({}));
    if (!response.ok || !channel || typeof channel !== 'object') return '';
    const type = Number(channel.type);
    const labels: Record<number, string> = {
      0: 'canal text',
      4: 'categorie',
      5: 'canal de anunțuri',
      10: 'thread de anunțuri',
      11: 'thread public',
      12: 'thread privat',
      13: 'canal Stage',
      15: 'forum',
    };
    const name = String(channel.name || channelId).trim();
    return `${name} · ${labels[type] || `tip Discord ${type}`}${channel.guild_id ? ` · Guild ${channel.guild_id}` : ''}`;
  } catch (_) {
    return '';
  }
}

async function discordBotAccessSummary(db: any, guildId: string, channelId: string) {
  try {
    if (!validDiscordChannelId(guildId) || !validDiscordChannelId(channelId)) return '';
    const botToken = await getPlatformSecret(db, 'discord_bot_token');
    if (!botToken) return '';
    const headers = { Authorization: `Bot ${botToken}` };
    const meResponse = await fetch(`${DISCORD_API}/users/@me`, { headers });
    const me = await meResponse.json().catch(() => ({}));
    const botId = String(me?.id || '').trim();
    if (!botId) return '';
    const [memberResponse, rolesResponse, channelResponse] = await Promise.all([
      fetch(`${DISCORD_API}/guilds/${guildId}/members/${botId}`, { headers }),
      fetch(`${DISCORD_API}/guilds/${guildId}/roles`, { headers }),
      fetch(`${DISCORD_API}/channels/${channelId}`, { headers }),
    ]);
    if (memberResponse.status === 404) return 'Botul nu este membru al guild-ului raportat';
    const member = await memberResponse.json().catch(() => ({}));
    const roles = await rolesResponse.json().catch(() => []);
    const channel = await channelResponse.json().catch(() => ({}));
    if (!memberResponse.ok) return `Discord nu a putut verifica membrul botului (HTTP ${memberResponse.status})`;
    const roleList = Array.isArray(roles) ? roles : [];
    const rolePermissions = new Map(roleList.map((role: any) => [String(role.id), BigInt(String(role.permissions || '0'))]));
    const memberRoleIds = Array.isArray(member.roles) ? member.roles.map((id: unknown) => String(id)) : [];
    let permissions = rolePermissions.get(guildId) || 0n;
    for (const roleId of memberRoleIds) permissions |= rolePermissions.get(roleId) || 0n;
    const overwrites = Array.isArray(channel?.permission_overwrites) ? channel.permission_overwrites : [];
    const applyOverwrite = (allow: bigint, deny: bigint) => { permissions = (permissions & ~deny) | allow; };
    const everyoneOverwrite = overwrites.find((item: any) => String(item.id) === guildId);
    if (everyoneOverwrite) applyOverwrite(BigInt(String(everyoneOverwrite.allow || '0')), BigInt(String(everyoneOverwrite.deny || '0')));
    const roleOverwrites = overwrites.filter((item: any) => item.type === 0 && memberRoleIds.includes(String(item.id)));
    const roleDeny = roleOverwrites.reduce((value: bigint, item: any) => value | BigInt(String(item.deny || '0')), 0n);
    const roleAllow = roleOverwrites.reduce((value: bigint, item: any) => value | BigInt(String(item.allow || '0')), 0n);
    if (roleOverwrites.length) applyOverwrite(roleAllow, roleDeny);
    const memberOverwrite = overwrites.find((item: any) => item.type === 1 && String(item.id) === botId);
    if (memberOverwrite) applyOverwrite(BigInt(String(memberOverwrite.allow || '0')), BigInt(String(memberOverwrite.deny || '0')));
    const administrator = Boolean(permissions & 0x8n);
    const viewChannel = administrator || Boolean(permissions & 0x400n);
    const sendMessages = administrator || Boolean(permissions & 0x800n);
    const embedLinks = administrator || Boolean(permissions & 0x4000n);
    return `Acces efectiv bot: View Channel ${viewChannel ? 'DA' : 'NU'}, Send Messages ${sendMessages ? 'DA' : 'NU'}, Embed Links ${embedLinks ? 'DA' : 'NU'}, Administrator ${administrator ? 'DA' : 'NU'}`;
  } catch (_) {
    return '';
  }
}

export async function requestDiscordTarget(
  db: any,
  target: DiscordDeliveryTarget,
  body: BodyInit | null,
  options: { messageId?: string; method?: 'POST' | 'PATCH' | 'DELETE'; headers?: Record<string, string> } = {}
) {
  const method = options.method || (options.messageId ? 'PATCH' : 'POST');
  let url = '';
  let headers = options.headers || {};
  if (target.transport === 'bot') {
    const botToken = await getPlatformSecret(db, 'discord_bot_token');
    if (!botToken) throw new Error('DISCORD_BOT_TOKEN lipsește din configurația Supabase.');
    url = `${DISCORD_API}/channels/${encodeURIComponent(String(target.channel_id))}/messages`;
    if (options.messageId) url += `/${encodeURIComponent(String(options.messageId))}`;
    headers = { Authorization: `Bot ${botToken}`, ...headers };
  }
  return fetch(url, { method, headers: jsonHeaders(body, headers), body: method === 'DELETE' ? undefined : body });
}

export async function deliverDiscordRoute(
  db: any,
  settings: any,
  routeKey: string,
  body: BodyInit,
  options: { messageIds?: Record<string, string>; legacyWebhookUrls?: string[]; headers?: Record<string, string>; fallbackRouteKey?: string; postOnly?: boolean } = {}
) {
  const results: any[] = [];
  const failures: string[] = [];
  for (const { target, candidates } of routeCandidates(settings, routeKey, options.legacyWebhookUrls || [], options.fallbackRouteKey || '')) {
    if (!candidates.length) continue;
    const requestedMessageId = options.postOnly ? '' : String(options.messageIds?.[target] || '').trim();
    let delivered = false;
    let lastError = '';
    for (const candidate of candidates) {
      try {
        let response = await requestDiscordTarget(db, candidate, body, { messageId: requestedMessageId || (options.postOnly ? '' : candidate.message_id), headers: options.headers });
        let responseDetails: any = null;
        if (!response.ok && (requestedMessageId || candidate.message_id)) {
          responseDetails = await response.clone().json().catch(() => ({}));
        }
        // Discord code 50005 = mesajul existent a fost creat de alt bot/utilizator.
        // Nu blocăm publicarea: creăm un mesaj nou și îl folosim pe acesta la
        // următoarele actualizări.
        const cannotEditForeignMessage = Number(responseDetails?.code) === 50005;
        if (!response.ok && (requestedMessageId || candidate.message_id) && ([400, 404].includes(response.status) || cannotEditForeignMessage)) {
          response = await requestDiscordTarget(db, { ...candidate, message_id: '' }, body, { headers: options.headers });
        }
        if (!response.ok) {
          const details = await response.clone().json().catch(() => ({}));
          const discordMessage = String(details?.message || '').trim();
          const discordErrors = details?.errors ? ` ${JSON.stringify(details.errors).slice(0, 1500)}` : '';
          const channelSummary = response.status === 403 ? await discordChannelSummary(db, candidate.channel_id) : '';
          const accessSummary = response.status === 403 && candidate.guild_id
            ? await discordBotAccessSummary(db, candidate.guild_id, candidate.channel_id)
            : '';
          lastError = response.status === 403
            ? `Botul Discord nu are acces la canalul ${candidate.channel_id}. ${channelSummary ? `Canal detectat: ${channelSummary}. ` : ''}${accessSummary ? `${accessSummary}. ` : ''}Verifică View Channel, Send Messages și Embed Links.${candidate.guild_id ? ` Guild salvată în configurație: ${candidate.guild_id}.` : ''} Bot identificat de Supabase: ${await discordBotIdentity(db) || 'necunoscut'}. Discord code: ${String(details?.code || '50013')}.`
            : `Discord ${candidate.transport} HTTP ${response.status}${discordMessage ? `: ${discordMessage}` : ''}${discordErrors}`;
          continue;
        }
        const data = await response.clone().json().catch(() => ({}));
        results.push({ target, transport: candidate.transport, channel_id: candidate.channel_id || null, id: data?.id ? String(data.id) : requestedMessageId || candidate.message_id || null });
        delivered = true;
        break;
      } catch (error) {
        lastError = errorMessage(error);
      }
    }
    if (!delivered) failures.push(`${target}: ${lastError || 'destinație indisponibilă'}`);
  }
  if (!results.length && failures.length) throw new Error(failures.join(' | '));
  return { results, failures };
}

export async function deleteDiscordRouteMessage(db: any, target: DiscordDeliveryTarget, messageId: string) {
  if (!validDiscordChannelId(messageId)) return false;
  const response = await requestDiscordTarget(db, target, null, { method: 'DELETE', messageId });
  return response.ok || response.status === 404;
}
