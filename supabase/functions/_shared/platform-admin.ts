export const PLATFORM_ADMIN_DISCORD_ID = '247012210021236738';

export const isPlatformAdminDiscordId = (discordId: unknown) =>
  String(discordId || '').trim() === PLATFORM_ADMIN_DISCORD_ID;
