import { getPlatformSecret } from './platform-secrets.ts';

const configuredIds = (Deno.env.get('PLATFORM_OWNER_DISCORD_IDS') || '')
  .split(',')
  .map((value) => value.trim())
  .filter((value) => /^\d{15,22}$/.test(value));

export const PLATFORM_ADMIN_DISCORD_IDS = [...new Set(configuredIds)];

export const isPlatformAdminDiscordId = (discordId: unknown) =>
  PLATFORM_ADMIN_DISCORD_IDS.includes(String(discordId || '').trim());

export async function getPlatformAdminDiscordIds(db: any) {
  const configured = (await getPlatformSecret(db, 'platform_owner_discord_ids'))
    .split(',')
    .map((value) => value.trim())
    .filter((value) => /^\d{15,22}$/.test(value));
  return [...new Set(configured)];
}

export async function isPlatformAdminAccount(db: any, discordId: unknown) {
  const normalizedId = String(discordId || '').trim();
  if ((await getPlatformAdminDiscordIds(db)).includes(normalizedId)) return true;
  const { data, error } = await db.from('platform_administrators')
    .select('discord_id')
    .eq('discord_id', normalizedId)
    .eq('active', true)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function isPlatformUserBanned(db: any, discordId: unknown) {
  const normalizedId = String(discordId || '').trim();
  const { data, error } = await db.from('platform_user_bans')
    .select('discord_id,reason')
    .eq('discord_id', normalizedId)
    .eq('active', true)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}
