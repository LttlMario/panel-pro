const SECRET_ENV_FALLBACKS: Record<string, string[]> = {
  project_url: ['SUPABASE_URL'],
  publishable_key: ['SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY'],
  cron_secret: ['CRON_SECRET'],
  discord_bot_token: ['DISCORD_BOT_TOKEN'],
  platform_owner_discord_ids: ['PLATFORM_OWNER_DISCORD_IDS'],
  status_live_cron_secret: ['STATUS_LIVE_CRON_SECRET', 'CRON_SECRET'],
  discord_pontaj_webhook_url: ['DISCORD_PONTAJ_WEBHOOK_URL'],
  public_community_webhook_primary: ['PUBLIC_COMMUNITY_WEBHOOK_PRIMARY'],
  public_community_webhook_secondary: ['PUBLIC_COMMUNITY_WEBHOOK_SECONDARY'],
  public_rating_webhook_primary: ['PUBLIC_RATING_WEBHOOK_PRIMARY'],
  public_rating_webhook_secondary: ['PUBLIC_RATING_WEBHOOK_SECONDARY'],
};

export async function getPlatformSecret(db: any, name: string): Promise<string> {
  try {
    const { data, error } = await db.rpc('get_panel_platform_secret', { secret_name: name });
    if (!error && typeof data === 'string' && data.trim()) return data.trim();
  } catch (_) {}
  for (const envName of SECRET_ENV_FALLBACKS[name] || []) {
    const value = String(Deno.env.get(envName) || '').trim();
    if (value) return value;
  }
  return '';
}

export const platformSecretFallbacks = SECRET_ENV_FALLBACKS;
