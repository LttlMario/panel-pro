const configuredIds = (Deno.env.get('PLATFORM_OWNER_DISCORD_IDS') || '')
  .split(',')
  .map((value) => value.trim())
  .filter((value) => /^\d{15,22}$/.test(value));

export const PLATFORM_ADMIN_DISCORD_IDS = [...new Set(configuredIds)];

export const isPlatformOwnerDiscordId = (discordId: unknown) =>
  PLATFORM_ADMIN_DISCORD_IDS.includes(String(discordId || '').trim());

// The environment variable remains the immutable platform-owner allowlist.
// Delegated administrators are stored server-side so the owner can revoke
// them immediately without exposing a secret or changing frontend code.
export const isPlatformAdminDiscordId = (discordId: unknown) =>
  isPlatformOwnerDiscordId(discordId);

export const isPlatformAdminDiscordIdAsync = async (db: any, discordId: unknown) => {
  const normalizedId = String(discordId || '').trim();
  if (isPlatformOwnerDiscordId(normalizedId)) return true;
  if (!/^\d{15,22}$/.test(normalizedId)) return false;

  const { data, error } = await db
    .from('platform_administrators')
    .select('discord_id')
    .eq('discord_id', normalizedId)
    .eq('active', true)
    .is('revoked_at', null)
    .maybeSingle();

  if (error) {
    // Fail closed if the delegation table is unavailable.
    console.error('Platform administrator lookup failed:', error.message);
    return false;
  }
  return Boolean(data);
};
