-- Keep voucher-created package metadata aligned with the canonical Standard/Full
-- feature lists. This supersedes the creation function from 20260818000400.

BEGIN;

UPDATE public.organization_vouchers
   SET features = CASE
     WHEN lower(COALESCE(package_code, 'standard')) = 'full' THEN
       '["core","announcements","announcements_departments","announcements_organization","requests","requests_departments","requests_organization","contracts","reports","legal_marketplace","legal_tools","assistant","status_live","discipline_departments","discipline_organization","illegal_calculator","illegal_locations","illegal_marketplace"]'::jsonb
     ELSE
       '["core","announcements","requests","contracts","reports","legal_marketplace","legal_tools","assistant","status_live","announcements_departments","requests_departments","discipline_departments"]'::jsonb
   END
 WHERE redeemed_at IS NULL
   AND revoked_at IS NULL;

CREATE OR REPLACE FUNCTION public.redeem_voucher_create_organization(
  p_code text,
  p_discord_id text,
  p_name text,
  p_slug text,
  p_address text DEFAULT NULL,
  p_logo_url text DEFAULT NULL,
  p_banner_url text DEFAULT NULL,
  p_guild_id text DEFAULT NULL
)
RETURNS TABLE (
  organization_id uuid,
  organization_name text,
  organization_slug text,
  organization_address text,
  organization_logo_url text,
  organization_banner_url text,
  package_code text,
  package_features jsonb,
  access_expires_at timestamptz,
  requires_guild_setup boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  voucher_row public.organization_vouchers%ROWTYPE;
  organization_row public.organizations%ROWTYPE;
  effective_guild_id text := NULLIF(trim(COALESCE(p_guild_id, '')), '');
  access_expires timestamptz;
  resolved_features jsonb;
BEGIN
  SELECT *
    INTO voucher_row
    FROM public.organization_vouchers
   WHERE upper(code) = upper(trim(COALESCE(p_code, '')))
   FOR UPDATE;

  IF NOT FOUND OR voucher_row.redeemed_at IS NOT NULL OR voucher_row.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Voucher invalid sau deja folosit.' USING ERRCODE = 'P0001';
  END IF;

  IF voucher_row.expires_at IS NOT NULL AND voucher_row.expires_at <= now() THEN
    RAISE EXCEPTION 'Voucherul a expirat.' USING ERRCODE = 'P0001';
  END IF;

  IF NULLIF(trim(COALESCE(p_discord_id, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Identitatea Discord lipsește.' USING ERRCODE = 'P0001';
  END IF;

  IF length(trim(COALESCE(p_name, ''))) < 2 OR length(trim(COALESCE(p_name, ''))) > 100 THEN
    RAISE EXCEPTION 'Numele organizației este invalid.' USING ERRCODE = 'P0001';
  END IF;

  IF NULLIF(trim(COALESCE(p_slug, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Slug-ul organizației este invalid.' USING ERRCODE = 'P0001';
  END IF;

  IF effective_guild_id IS NULL AND voucher_row.guild_id IS NOT NULL THEN
    effective_guild_id := trim(voucher_row.guild_id);
  END IF;

  IF voucher_row.guild_id IS NOT NULL
     AND effective_guild_id IS NOT NULL
     AND trim(voucher_row.guild_id) <> effective_guild_id THEN
    RAISE EXCEPTION 'Guild ID-ul nu corespunde voucherului.' USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(voucher_row.duration_days, 0) <= 0 THEN
    RAISE EXCEPTION 'Durata voucherului este invalidă.' USING ERRCODE = 'P0001';
  END IF;

  access_expires := now() + make_interval(days => voucher_row.duration_days);

  -- The package code is the authority. Voucher rows are normalized above so
  -- legacy vouchers cannot carry a stale or partial feature list forward.
  IF lower(COALESCE(voucher_row.package_code, 'standard')) = 'full' THEN
    resolved_features := jsonb_build_array(
      'core', 'announcements', 'announcements_departments', 'announcements_organization',
      'requests', 'requests_departments', 'requests_organization', 'contracts', 'reports',
      'legal_marketplace', 'legal_tools', 'assistant', 'status_live',
      'discipline_departments', 'discipline_organization',
      'illegal_calculator', 'illegal_locations', 'illegal_marketplace'
    );
  ELSE
    resolved_features := jsonb_build_array(
      'core', 'announcements', 'requests', 'contracts', 'reports',
      'legal_marketplace', 'legal_tools', 'assistant', 'status_live',
      'announcements_departments', 'requests_departments', 'discipline_departments'
    );
  END IF;

  INSERT INTO public.organizations (
    name, slug, address, logo_url, banner_url, active, lifecycle_status
  ) VALUES (
    trim(p_name), trim(p_slug), NULLIF(trim(COALESCE(p_address, '')), ''),
    NULLIF(trim(COALESCE(p_logo_url, '')), ''),
    NULLIF(trim(COALESCE(p_banner_url, '')), ''), false, 'draft'
  )
  RETURNING * INTO organization_row;

  IF effective_guild_id IS NOT NULL THEN
    INSERT INTO public.organization_guilds (organization_id, guild_id, kind, enabled)
    VALUES (organization_row.id, effective_guild_id, 'primary', true);
  END IF;

  INSERT INTO public.app_settings (organization_id, key, value, updated_at)
  VALUES
    (organization_row.id, 'organization_package', jsonb_build_object(
      'code', lower(COALESCE(voucher_row.package_code, 'standard')),
      'unlimited', false,
      'expires_at', access_expires,
      'features', resolved_features
    ), now()),
    (organization_row.id, 'organization_access', jsonb_build_object(
      'expires_at', access_expires
    ), now())
  ON CONFLICT (organization_id, key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;

  UPDATE public.organization_vouchers
     SET redeemed_at = now(),
         redeemed_by_discord_id = trim(p_discord_id),
         redeemed_organization_id = organization_row.id,
         organization_id = organization_row.id
   WHERE id = voucher_row.id
     AND redeemed_at IS NULL
     AND revoked_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Voucherul a fost folosit între timp.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.organization_lifecycle_events (
    organization_id, event_type, actor_discord_id, details
  ) VALUES (
    organization_row.id,
    'voucher_organization_created',
    trim(p_discord_id),
    jsonb_build_object(
      'package_code', lower(COALESCE(voucher_row.package_code, 'standard')),
      'features', resolved_features,
      'guild_id', effective_guild_id
    )
  );

  RETURN QUERY SELECT
    organization_row.id,
    organization_row.name::text,
    organization_row.slug::text,
    organization_row.address::text,
    organization_row.logo_url::text,
    organization_row.banner_url::text,
    lower(COALESCE(voucher_row.package_code, 'standard'))::text,
    resolved_features,
    access_expires,
    effective_guild_id IS NULL;
END;
$$;

ALTER FUNCTION public.redeem_voucher_create_organization(text, text, text, text, text, text, text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.redeem_voucher_create_organization(text, text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_voucher_create_organization(text, text, text, text, text, text, text, text) TO service_role;

COMMIT;
