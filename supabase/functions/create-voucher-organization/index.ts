import { createClient } from 'jsr:@supabase/supabase-js@2';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type', 'Content-Type': 'application/json' };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const validGuild = (value: string) => /^\d{15,22}$/.test(value);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);
  try {
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    if (!key) throw new Error('Cheia Supabase lipsește.');
    const body = await req.json();
    const code = String(body.voucher_code || '').trim().toUpperCase();
    let guildId = String(body.guild_id || '').trim();
    const name = String(body.name || '').trim();
    const accessToken = String(body.access_token || '').trim();
    if (!code || name.length < 2 || !accessToken) return reply({ error: 'Completează voucherul, numele organizației și autentifică-te cu Discord.' }, 400);
    if (guildId && !validGuild(guildId)) return reply({ error: 'Guild ID invalid.' }, 400);

    const userResponse = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!userResponse.ok) return reply({ error: 'Sesiunea Discord a expirat. Revino la login.' }, 401);
    const discordUser = await userResponse.json();
    const discordId = String(discordUser.id || '');
    if (!discordId) return reply({ error: 'Profil Discord invalid.' }, 401);

    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    const { data: voucher, error: voucherError } = await db.from('organization_vouchers').select('*').eq('code', code).maybeSingle();
    if (voucherError) throw voucherError;
    if (!voucher || voucher.redeemed_at) return reply({ error: 'Voucher invalid sau deja folosit.' }, 409);
    if (voucher.expires_at && Date.parse(String(voucher.expires_at)) <= Date.now()) return reply({ error: 'Voucherul a expirat.' }, 400);
    if (voucher.guild_id && guildId && String(voucher.guild_id) !== guildId) return reply({ error: 'Guild ID-ul nu corespunde voucherului.' }, 400);
    if (!guildId && voucher.guild_id) guildId = String(voucher.guild_id).trim();

    if (guildId) {
      const botToken = String(Deno.env.get('DISCORD_BOT_TOKEN') || '').trim();
      if (!botToken) throw new Error('Botul aplicației nu este configurat în Supabase.');
      const botHeaders = { Authorization: `Bot ${botToken}` };
      const [guild, member] = await Promise.all([
        fetch(`https://discord.com/api/v10/guilds/${guildId}`, { headers: botHeaders }),
        fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`, { headers: botHeaders }),
      ]);
      if (!guild.ok) return reply({ error: 'Botul nu este pe serverul indicat sau Guild ID-ul este invalid.' }, 400);
      if (!member.ok) return reply({ error: 'Utilizatorul nu este membru pe serverul indicat.' }, 403);
    }

    const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
    if (!slug) return reply({ error: 'Numele organizației nu poate produce un identificator valid.' }, 400);
    const { data: organization, error: organizationError } = await db.from('organizations').insert({
      name, slug, address: String(body.address || '').trim() || null,
      logo_url: String(body.logo_url || '').trim() || null,
      banner_url: String(body.banner_url || '').trim() || null,
      active: false, lifecycle_status: 'draft'
    }).select('id,name,slug,address,logo_url,banner_url').single();
    if (organizationError) throw organizationError;

    if (guildId) {
      const { error } = await db.from('organization_guilds').insert({ organization_id: organization.id, guild_id: guildId, kind: 'primary', enabled: true });
      if (error) throw error;
    }
    const expires = new Date(Date.now() + Number(voucher.duration_days || 30) * 86400000).toISOString();
    const { error: settingsError } = await db.from('app_settings').upsert([
      { organization_id: organization.id, key: 'organization_package', value: { code: voucher.package_code, unlimited: false, expires_at: expires } },
      { organization_id: organization.id, key: 'organization_access', value: { expires_at: expires } }
    ], { onConflict: 'organization_id,key' });
    if (settingsError) throw settingsError;

    const { data: redeemed, error: redeemError } = await db.from('organization_vouchers').update({
      redeemed_at: new Date().toISOString(), redeemed_by_discord_id: discordId,
      redeemed_organization_id: organization.id, organization_id: organization.id
    }).eq('id', voucher.id).is('redeemed_at', null).select('id').maybeSingle();
    if (redeemError) throw redeemError;
    if (!redeemed) return reply({ error: 'Voucherul a fost folosit între timp.' }, 409);
    await db.from('organization_lifecycle_events').insert({ organization_id: organization.id, event_type: 'voucher_organization_created', actor_discord_id: discordId, details: { package_code: voucher.package_code, guild_id: guildId || null } });
    return reply({ ok: true, requires_guild_setup: !guildId, guild_id: guildId || null, organization, package_code: voucher.package_code, expires_at: expires });
  } catch (error) {
    console.error(error);
    return reply({ error: error instanceof Error ? error.message : 'Eroare internă.' }, 500);
  }
});
