import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { requirePanelSession } from '../_shared/panel-session.ts';
import { isPlatformAdminAccount } from '../_shared/platform-admin.ts';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';

const reply = (request: Request, data: unknown, status = 200) => {
  const origin = String(request.headers.get('origin') || '');
  const allowedOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || origin === 'https://panel-pro.ro'
    ? origin
    : 'https://panel-pro.ro';
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
      'Content-Type': 'application/json'
    }
  });
};

const validId = (value: unknown) => /^\d{15,22}$/.test(String(value || '').trim());
const botHeaders = (token: string) => ({ Authorization: `Bot ${token}`, 'User-Agent': 'PanelManagement/1.0 (+https://panel-pro.ro)' });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    const origin = String(request.headers.get('origin') || '');
    const allowedOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || origin === 'https://panel-pro.ro'
      ? origin
      : 'https://panel-pro.ro';
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin',
      },
    });
  }
  if (request.method !== 'POST') return reply(request, { error: 'Metodă invalidă.' }, 405);
  try {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    if (!serviceKey) throw new Error('Cheia secretă Supabase lipsește.');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);
    const body = await request.json().catch(() => ({}));
    const organizationId = String(body.organization_id || '').trim();
    const guildId = String(body.guild_id || '').trim();
    if (!validId(guildId)) return reply(request, { error: 'Guild ID invalid.' }, 400);

    let discordId = '';
    let panelSession: any = null;
    try { panelSession = await requirePanelSession(db, request, 0, true); discordId = String(panelSession.discord_id || ''); } catch (_) {}
    if (!discordId && body.access_token) {
      const userResponse = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bearer ${String(body.access_token).trim()}` } });
      if (userResponse.ok) discordId = String((await userResponse.json()).id || '');
    }
    if (!discordId) return reply(request, { error: 'Sesiunea panelului sau Discord a expirat.' }, 401);

    const platformAdmin = await isPlatformAdminAccount(db, discordId);
    const botToken = await getPlatformSecret(db, 'discord_bot_token');
    if (!botToken) throw new Error('DISCORD_BOT_TOKEN lipsește din configurația Supabase.');
    if (!platformAdmin) {
      if (!organizationId) return reply(request, { error: 'Organizația selectată lipsește.' }, 400);
      const { data: organization, error: organizationError } = await db.from('organizations').select('id,lifecycle_status').eq('id', organizationId).maybeSingle();
      if (organizationError) throw organizationError;
      if (!organization) return reply(request, { error: 'Organizația nu există.' }, 404);
      const { data: guild } = await db.from('organization_guilds').select('guild_id').eq('organization_id', organizationId).eq('guild_id', guildId).eq('enabled', true).maybeSingle();
      let allowed = Boolean(guild);
      if (organization.lifecycle_status === 'draft' && body.access_token) {
        const { data: voucher } = await db.from('organization_vouchers').select('redeemed_by_discord_id').eq('redeemed_organization_id', organizationId).maybeSingle();
        allowed = allowed && String(voucher?.redeemed_by_discord_id || '') === discordId;
      } else {
        const guildResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, { headers: botHeaders(botToken) });
        const guildData = guildResponse.ok ? await guildResponse.json() : null;
        allowed = allowed && String(guildData?.owner_id || '') === discordId;
      }
      if (!allowed) return reply(request, { error: 'Nu ai dreptul să citești canalele acestei organizații.' }, 403);
    }

    const channelsResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, { headers: botHeaders(botToken) });
    if (!channelsResponse.ok) return reply(request, { error: `Canalele nu pot fi citite. Discord a răspuns cu HTTP ${channelsResponse.status}.` }, 400);
    const channels = await channelsResponse.json();
    const channelTypes: Record<number, string> = { 0: 'Text', 5: 'Anunțuri' };
    const rawChannels = Array.isArray(channels) ? channels : [];
    const categories = new Map(rawChannels
      .filter((channel: any) => Number(channel.type) === 4 && validId(channel.id))
      .map((category: any) => [String(category.id), category]));
    const result = rawChannels
      .filter((channel: any) => [0, 5].includes(Number(channel.type)) && validId(channel.id))
      .map((channel: any) => ({
        id: String(channel.id),
        name: String(channel.name || channel.id),
        type: Number(channel.type),
        type_label: channelTypes[Number(channel.type)] || 'Text',
        parent_id: validId(channel.parent_id) ? String(channel.parent_id) : null,
        category_name: categories.get(String(channel.parent_id || ''))?.name ? String(categories.get(String(channel.parent_id || ''))?.name) : null,
        category_position: Number(categories.get(String(channel.parent_id || ''))?.position ?? -1),
        position: Number(channel.position ?? 0)
      }))
      .sort((left: any, right: any) => {
        const leftGroup = left.category_name ? 1 : 0;
        const rightGroup = right.category_name ? 1 : 0;
        return leftGroup - rightGroup || left.category_position - right.category_position || left.position - right.position || left.name.localeCompare(right.name, 'ro');
      });
    return reply(request, { ok: true, guild: { id: guildId }, channels: result });
  } catch (error) {
    return reply(request, { error: error instanceof Error ? error.message : 'Canalele Discord nu au putut fi încărcate.' }, 500);
  }
});
