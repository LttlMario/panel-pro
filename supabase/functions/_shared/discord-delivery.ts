import { getPlatformSecret } from './platform-secrets.ts';

const DISCORD_API = 'https://discord.com/api/v10';
const TARGETS = ['primary', 'secondary'] as const;

export type DiscordDeliveryTarget = {
  target: string;
  transport: 'bot' | 'webhook';
  channel_id?: string;
  url?: string;
  message_id?: string;
};

export const validDiscordChannelId = (value: unknown) => /^\d{15,22}$/.test(String(value || '').trim());

export const validDiscordWebhookUrl = (value: unknown) => {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'https:'
      && ['discord.com', 'discordapp.com'].includes(url.hostname)
      && url.pathname.startsWith('/api/webhooks/');
  } catch (_) {
    return false;
  }
};

const clean = (value: unknown, max = 500) => String(value || '').trim().slice(0, max);

export const routeCandidates = (settings: any, routeKey: string, legacyWebhookUrls: string[] = [], fallbackRouteKey = '') => {
  const channelRoute = settings?.discord_channel_routes?.[routeKey] || settings?.discord_channel_routes?.[fallbackRouteKey] || {};
  const webhookRoute = settings?.webhook_routes?.[routeKey] || settings?.webhook_routes?.[fallbackRouteKey] || {};
  return TARGETS.map((target, index) => {
    const candidates: DiscordDeliveryTarget[] = [];
    const channel = channelRoute?.[target];
    if (channel?.enabled !== false && validDiscordChannelId(channel?.channel_id)) {
      candidates.push({
        target,
        transport: 'bot',
        channel_id: clean(channel.channel_id, 30),
        message_id: validDiscordChannelId(channel.message_id) ? clean(channel.message_id, 30) : '',
      });
    }
    const webhook = webhookRoute?.[target];
    if (webhook?.enabled !== false && validDiscordWebhookUrl(webhook?.url)) {
      candidates.push({
        target,
        transport: 'webhook',
        url: clean(webhook.url),
        message_id: validDiscordChannelId(webhook.message_id) ? clean(webhook.message_id, 30) : '',
      });
    }
    const legacy = clean(legacyWebhookUrls[index] || '');
    if (legacy && validDiscordWebhookUrl(legacy) && !candidates.some((item) => item.url === legacy)) {
      candidates.push({ target, transport: 'webhook', url: legacy });
    }
    return { target, candidates };
  });
};

const jsonHeaders = (body: BodyInit | null, headers: Record<string, string> = {}) => {
  const result = { ...headers };
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
  } else {
    url = String(target.url || '');
    if (options.messageId) {
      url = `${url.replace(/\/$/, '')}/messages/${encodeURIComponent(String(options.messageId))}`;
    } else if (method === 'POST') {
      const parsed = new URL(url);
      parsed.searchParams.set('wait', 'true');
      url = parsed.toString();
    }
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
          lastError = `Discord ${candidate.transport} HTTP ${response.status}`;
          continue;
        }
        const data = await response.clone().json().catch(() => ({}));
        results.push({ target, transport: candidate.transport, channel_id: candidate.channel_id || null, url: candidate.url || null, id: data?.id ? String(data.id) : requestedMessageId || candidate.message_id || null });
        delivered = true;
        break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Eroare Discord.';
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
