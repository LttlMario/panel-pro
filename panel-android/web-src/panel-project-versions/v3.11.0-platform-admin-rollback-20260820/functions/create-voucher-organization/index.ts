import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';

const headers = { 'Access-Control-Allow-Origin': 'https://lttlmario.github.io', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session', 'Access-Control-Max-Age': '86400', 'Content-Type': 'application/json' };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const validGuild = (value: string) => /^\d{15,22}$/.test(value);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);
  let db: any = null;
  try {
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    if (!key) throw new Error('Cheia Supabase lipsește.');
    const body = await req.json();
    const code = String(body.voucher_code || '').trim().toUpperCase();
    let guildId = String(body.guild_id || '').trim();
    const name = String(body.name || '').trim();
    const address = String(body.address || '').trim();
    const logoUrl = String(body.logo_url || '').trim();
    const bannerUrl = String(body.banner_url || '').trim();
    const accessToken = String(body.access_token || '').trim();
    if (!code || name.length < 2 || name.length > 100 || address.length > 500 || !accessToken) return reply({ error: 'Completează corect voucherul și numele organizației.' }, 400);
    if (logoUrl && !/^https:\/\//i.test(logoUrl)) return reply({ error: 'Logo-ul trebuie să fie un link HTTPS.' }, 400);
    if (bannerUrl && !/^https:\/\//i.test(bannerUrl)) return reply({ error: 'Bannerul trebuie să fie un link HTTPS.' }, 400);
    if (guildId && !validGuild(guildId)) return reply({ error: 'Guild ID invalid.' }, 400);

    db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    const requestIp = String(req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim().slice(0, 120);
    const { data: ipAllowed, error: ipRateError } = await db.rpc('consume_panel_rate_limit', { p_key: `voucher-create:ip:${requestIp}`, p_limit: 12, p_window_seconds: 900 });
    if (ipRateError) {
      console.error('Voucher IP rate-limit unavailable:', ipRateError.message);
      return reply({ error: 'Protecția anti-abuz este temporar indisponibilă. Încearcă din nou în câteva minute.' }, 503);
    }
    if (ipAllowed === false) return reply({ error: 'Prea multe încercări. Încearcă din nou mai târziu.' }, 429);
    const userResponse = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!userResponse.ok) return reply({ error: 'Sesiunea Discord a expirat. Revino la login.' }, 401);
    const discordUser = await userResponse.json();
    const discordId = String(discordUser.id || '');
    if (!discordId) return reply({ error: 'Profil Discord invalid.' }, 401);
    const { data: discordAllowed, error: discordRateError } = await db.rpc('consume_panel_rate_limit', { p_key: `voucher-create:discord:${discordId}`, p_limit: 5, p_window_seconds: 3600 });
    if (discordRateError) {
      console.error('Voucher Discord rate-limit unavailable:', discordRateError.message);
      return reply({ error: 'Protecția anti-abuz este temporar indisponibilă. Încearcă din nou în câteva minute.' }, 503);
    }
    if (discordAllowed === false) return reply({ error: 'Ai atins limita de creare a organizațiilor. Încearcă mai târziu.' }, 429);
    const { data: voucher, error: voucherError } = await db.from('organization_vouchers').select('*').eq('code', code).maybeSingle();
    if (voucherError) throw voucherError;
    if (!voucher || voucher.redeemed_at || voucher.revoked_at) return reply({ error: 'Voucher invalid sau deja folosit.' }, 409);
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
    const { data: createdRows, error: createError } = await db.rpc('redeem_voucher_create_organization', {
      p_code: code,
      p_discord_id: discordId,
      p_name: name,
      p_slug: slug,
      p_address: address || null,
      p_logo_url: logoUrl || null,
      p_banner_url: bannerUrl || null,
      p_guild_id: guildId || null
    });
    if (createError) {
      const message = String(createError.message || 'Eroare la activarea voucherului.');
      return reply({ error: message }, createError.code === 'P0001' ? 409 : 500);
    }
    const created = Array.isArray(createdRows) ? createdRows[0] : createdRows;
    if (!created?.organization_id) return reply({ error: 'Organizația nu a putut fi creată.' }, 500);
    const organization = {
      id: created.organization_id,
      name: created.organization_name,
      slug: created.organization_slug,
      address: created.organization_address,
      logo_url: created.organization_logo_url,
      banner_url: created.organization_banner_url
    };
    return reply({ ok: true, requires_guild_setup: Boolean(created.requires_guild_setup), guild_id: guildId || null, organization, package_code: created.package_code, package_features: created.package_features || [], expires_at: created.access_expires_at });
  } catch (error) {
    console.error(error);
    return reply({ error: error instanceof Error ? error.message : 'Eroare internă.' }, 500);
  }
});
