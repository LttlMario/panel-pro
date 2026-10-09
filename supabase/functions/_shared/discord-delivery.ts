import { getPlatformSecret } from './platform-secrets.ts';

const DISCORD_API = 'https://discord.com/api/v10';
const PANEL_FOOTER = 'Panel Pro - By Little Mario';
const TARGETS = ['primary', 'secondary'] as const;

export type DiscordDeliveryTarget = {
  target: string;
  transport: 'bot';
  channel_id?: string;
  guild_id?: string;
  message_id?: string;
};

type DeliveryContext = {
  organizationId?: string;
  messageKey?: string;
  retryPayload?: unknown;
  retryHeaders?: Record<string, string>;
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

export async function recordDiscordDeliveryEvent(
  db: any,
  context: DeliveryContext,
  routeKey: string,
  candidate: DiscordDeliveryTarget,
  details: {
    messageId?: string;
    operation: 'create' | 'edit' | 'recreate' | 'verify' | 'sync';
    status: 'success' | 'failure';
    httpStatus?: number;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  },
) {
  const organizationId = String(context.organizationId || '').trim();
  const channelId = String(candidate.channel_id || '').trim();
  if (!organizationId || !validDiscordChannelId(channelId)) return;
  const messageKey = String(context.messageKey || 'control').trim().slice(0, 160) || 'control';
  const messageId = String(details.messageId || '').trim();
  let registryId = '';
  try {
    const routeName = String(routeKey || 'unknown').trim().slice(0, 120) || 'unknown';
    const targetName = String(candidate.target || 'primary');
    const { data: previous } = await db.from('discord_message_registry')
      .select('id,message_id,last_delivered_at')
      .eq('organization_id', organizationId)
      .eq('route_key', routeName)
      .eq('message_key', messageKey)
      .eq('target', targetName)
      .eq('channel_id', channelId)
      .maybeSingle();
    const retainedMessageId = validDiscordChannelId(messageId)
      ? messageId
      : validDiscordChannelId(previous?.message_id) ? String(previous.message_id) : null;
    const { data: registry, error: registryError } = await db.from('discord_message_registry').upsert({
      organization_id: organizationId,
      route_key: routeName,
      message_key: messageKey,
      target: targetName,
      channel_id: channelId,
      guild_id: validDiscordChannelId(candidate.guild_id) ? String(candidate.guild_id) : null,
      message_id: retainedMessageId,
      status: details.status === 'success' ? 'active' : details.httpStatus === 404 ? 'missing' : 'failed',
      operation: details.operation,
      last_http_status: Number.isFinite(details.httpStatus) ? details.httpStatus : null,
      last_error: details.status === 'success' ? null : String(details.errorMessage || '').slice(0, 2000) || 'Eroare Discord.',
      last_delivered_at: details.status === 'success' ? new Date().toISOString() : previous?.last_delivered_at || null,
      last_checked_at: new Date().toISOString(),
      metadata: details.metadata || {},
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id,route_key,message_key,target,channel_id' }).select('id').maybeSingle();
    if (registryError) throw registryError;
    registryId = String(registry?.id || '');
    if (details.status === 'success') {
      if (registryId) await db.rpc('increment_discord_registry_delivery_count', { p_registry_id: registryId });
      const persistentEmbed = !String(routeKey || '').startsWith('log_') && /control$/i.test(messageKey);
      if (persistentEmbed && candidate.target === 'primary' && context.retryPayload && typeof context.retryPayload === 'object' && !Array.isArray(context.retryPayload)) {
        await db.from('discord_embed_versions').insert({
          organization_id: organizationId,
          route_key: String(routeKey || 'unknown').trim().slice(0, 120) || 'unknown',
          message_key: messageKey,
          payload: context.retryPayload,
          change_type: details.operation === 'recreate' ? 'restored' : 'delivered',
        });
      }
    }
    await db.from('discord_delivery_attempts').insert({
      organization_id: organizationId,
      registry_id: registryId || null,
      route_key: routeName,
      message_key: messageKey,
      target: String(candidate.target || 'primary'),
      channel_id: channelId,
      message_id: validDiscordChannelId(messageId) ? messageId : null,
      operation: details.operation,
      status: details.status,
      http_status: Number.isFinite(details.httpStatus) ? details.httpStatus : null,
      error_message: details.status === 'success' ? null : String(details.errorMessage || '').slice(0, 2000),
      metadata: details.metadata || {},
    });
    const retryable = details.status === 'failure' && (
      !details.httpStatus || details.httpStatus === 408 || details.httpStatus === 409 || details.httpStatus === 429 || details.httpStatus >= 500
    );
    if (retryable && context.retryPayload && typeof context.retryPayload === 'object' && !Array.isArray(context.retryPayload)) {
      await db.from('discord_delivery_queue').insert({
        organization_id: organizationId,
        route_key: String(routeKey || 'unknown').trim().slice(0, 120) || 'unknown',
        message_key: messageKey,
        target: String(candidate.target || 'primary'),
        channel_id: channelId,
        message_id: validDiscordChannelId(messageId) ? messageId : null,
        payload: context.retryPayload,
        headers: context.retryHeaders || {},
        last_error: String(details.errorMessage || '').slice(0, 2000) || 'Eroare Discord.',
      });
    }
  } catch (error) {
    // Observability must never turn a successful Discord delivery into a failure.
    console.error('[discord-delivery-registry]', error);
  }
}

export const routeCandidates = (settings: any, routeKey: string, fallbackRouteKey = '') => {
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

function normalizePanelEmbedFooter(body: BodyInit | null): BodyInit | null {
  if (typeof body !== 'string') return body;
  try {
    const payload = JSON.parse(body);
    if (!Array.isArray(payload?.embeds)) return body;
    return JSON.stringify({
      ...payload,
      embeds: payload.embeds.map((embed: any) => ({ ...embed, footer: { ...(embed?.footer || {}), text: PANEL_FOOTER } })),
    });
  } catch (_) {
    return body;
  }
}

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
  const normalizedBody = normalizePanelEmbedFooter(body);
  return fetch(url, { method, headers: jsonHeaders(normalizedBody, headers), body: method === 'DELETE' ? undefined : normalizedBody });
}

export async function deliverDiscordRoute(
  db: any,
  settings: any,
  routeKey: string,
  body: BodyInit,
  options: { messageIds?: Record<string, string>; headers?: Record<string, string>; fallbackRouteKey?: string; postOnly?: boolean; messageIdsOnly?: boolean; organizationId?: string; messageKey?: string; retryPayload?: unknown; retryHeaders?: Record<string, string>; targets?: string[] } = {}
) {
  const results: any[] = [];
  const failures: string[] = [];
  for (const { target, candidates } of routeCandidates(settings, routeKey, options.fallbackRouteKey || '').filter((entry) => !options.targets?.length || options.targets.includes(String(entry.target)))) {
    if (!candidates.length) continue;
    // Log routes contain one message per record. Their configured route message
    // is not the record message and must never be edited as a fallback.
    const messageIdsOnly = options.messageIdsOnly ?? routeKey.startsWith('log_');
    const requestedMessageId = options.postOnly ? '' : String(options.messageIds?.[target] || '').trim();
    let delivered = false;
    let lastError = '';
    for (const candidate of candidates) {
      try {
        const attemptedMessageId = requestedMessageId || (options.postOnly || messageIdsOnly ? '' : candidate.message_id);
        let response = await requestDiscordTarget(db, candidate, body, { messageId: attemptedMessageId, headers: options.headers });
        let recreated = false;
        // Dacă mesajul salvat a fost șters din Discord, îl recreăm o singură
        // dată și lăsăm apelantul să salveze noul ID pentru actualizările viitoare.
        if (!response.ok && response.status === 404 && attemptedMessageId) {
          const replacement = await requestDiscordTarget(db, candidate, body, { method: 'POST', headers: options.headers });
          if (replacement.ok) {
            response = replacement;
            recreated = true;
          }
        }
        // Dacă mesajul existent nu poate fi editat, nu creăm un mesaj nou:
        // rutele configurate sunt embeduri editabile, iar un POST aici ar
        // produce duplicate.
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
          await recordDiscordDeliveryEvent(db, options, routeKey, candidate, {
            messageId: attemptedMessageId,
            operation: attemptedMessageId ? 'edit' : 'create',
            status: 'failure',
            httpStatus: response.status,
            errorMessage: lastError,
            metadata: { recreated: false },
          });
          continue;
        }
        const data = await response.clone().json().catch(() => ({}));
        const deliveredMessageId = data?.id ? String(data.id) : attemptedMessageId || (messageIdsOnly ? null : candidate.message_id);
        results.push({ target, transport: candidate.transport, channel_id: candidate.channel_id || null, id: deliveredMessageId, recreated });
        await recordDiscordDeliveryEvent(db, options, routeKey, candidate, {
          messageId: deliveredMessageId,
          operation: recreated ? 'recreate' : attemptedMessageId ? 'edit' : 'create',
          status: 'success',
          httpStatus: response.status,
          metadata: { recreated },
        });
        delivered = true;
        break;
      } catch (error) {
        lastError = errorMessage(error);
        await recordDiscordDeliveryEvent(db, options, routeKey, candidate, {
          messageId: attemptedMessageId,
          operation: attemptedMessageId ? 'edit' : 'create',
          status: 'failure',
          errorMessage: lastError,
        });
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
