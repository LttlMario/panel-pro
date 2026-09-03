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
        if (!response.ok && (requestedMessageId || candidate.message_id) && [400, 404].includes(response.status)) {
          response = await requestDiscordTarget(db, { ...candidate, message_id: '' }, body, { headers: options.headers });
        }
        if (!response.ok) {
          const details = await response.clone().json().catch(() => ({}));
          const discordMessage = String(details?.message || '').trim();
          const discordErrors = details?.errors ? ` ${JSON.stringify(details.errors).slice(0, 1500)}` : '';
          lastError = response.status === 403
            ? `Botul Discord nu are permisiuni în canalul ${candidate.channel_id}. Verifică View Channel, Send Messages și Embed Links pentru bot.`
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
