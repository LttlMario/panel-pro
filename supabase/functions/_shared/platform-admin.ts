const configuredIds = (Deno.env.get('PLATFORM_OWNER_DISCORD_IDS') || '')
  .split(',')
  .map((value) => value.trim())
  .filter((value) => /^\d{15,22}$/.test(value));

export const PLATFORM_ADMIN_DISCORD_IDS = [...new Set(configuredIds)];

export const isPlatformAdminDiscordId = (discordId: unknown) =>
  PLATFORM_ADMIN_DISCORD_IDS.includes(String(discordId || '').trim());
