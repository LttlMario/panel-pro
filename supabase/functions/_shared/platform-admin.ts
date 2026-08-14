export const PLATFORM_ADMIN_DISCORD_IDS = (Deno.env.get('PLATFORM_OWNER_DISCORD_IDS') || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

// Păstrăm aliasul pentru codul existent care caută setările proprietarului.
export const PLATFORM_ADMIN_DISCORD_ID = PLATFORM_ADMIN_DISCORD_IDS[0] || '';

export const isPlatformAdminDiscordId = (discordId: unknown) =>
  PLATFORM_ADMIN_DISCORD_IDS.includes(String(discordId || '').trim());
