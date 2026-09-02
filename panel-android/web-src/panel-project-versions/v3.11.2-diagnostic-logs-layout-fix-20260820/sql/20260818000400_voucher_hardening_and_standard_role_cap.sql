-- Harden voucher lifecycle and keep voucher redemption transactional.
-- The Edge Functions call these helpers with the service role only.

BEGIN;

ALTER TABLE public.organization_vouchers
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_by_discord_id text,
  ADD COLUMN IF NOT EXISTS revoked_reason text;

CREATE INDEX IF NOT EXISTS organization_vouchers_active_code_idx
  ON public.organization_vouchers (code)
  WHERE redeemed_at IS NULL AND revoked_at IS NULL;

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

  IF voucher_row.package_code = 'full' THEN
    resolved_features := jsonb_build_array(
      'core', 'announcements', 'requests', 'contracts', 'reports',
      'legal_marketplace', 'legal_tools', 'assistant', 'status_live',
      'illegal_calculator', 'illegal_locations', 'illegal_marketplace'
    );
  ELSIF jsonb_typeof(voucher_row.features) = 'array'
        AND jsonb_array_length(voucher_row.features) > 0 THEN
    resolved_features := voucher_row.features;
  ELSE
    resolved_features := jsonb_build_array(
      'core', 'announcements', 'requests', 'contracts', 'reports',
      'legal_marketplace', 'legal_tools', 'assistant', 'status_live'
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
      'code', voucher_row.package_code,
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
      'package_code', voucher_row.package_code,
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
    voucher_row.package_code::text,
    resolved_features,
    access_expires,
    effective_guild_id IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_voucher_reactivate_organization(
  p_code text,
  p_discord_id text,
  p_organization_id uuid
)
RETURNS TABLE (
  access_expires_at timestamptz,
  added_days integer,
  package_code text,
  package_features jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  voucher_row public.organization_vouchers%ROWTYPE;
  current_access jsonb;
  existing_expires timestamptz;
  base_time timestamptz;
  next_expires timestamptz;
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

  IF p_organization_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.organizations WHERE id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'Organizația nu există.' USING ERRCODE = 'P0001';
  END IF;

  SELECT value
    INTO current_access
    FROM public.app_settings
   WHERE organization_id = p_organization_id
     AND key = 'organization_access';

  existing_expires := NULLIF(current_access ->> 'expires_at', '')::timestamptz;
  base_time := CASE
    WHEN existing_expires IS NOT NULL AND existing_expires > now() THEN existing_expires
    ELSE now()
  END;
  next_expires := base_time + make_interval(days => voucher_row.duration_days);

  IF voucher_row.package_code = 'full' THEN
    resolved_features := jsonb_build_array(
      'core', 'announcements', 'requests', 'contracts', 'reports',
      'legal_marketplace', 'legal_tools', 'assistant', 'status_live',
      'illegal_calculator', 'illegal_locations', 'illegal_marketplace'
    );
  ELSIF jsonb_typeof(voucher_row.features) = 'array'
        AND jsonb_array_length(voucher_row.features) > 0 THEN
    resolved_features := voucher_row.features;
  ELSE
    resolved_features := jsonb_build_array(
      'core', 'announcements', 'requests', 'contracts', 'reports',
      'legal_marketplace', 'legal_tools', 'assistant', 'status_live'
    );
  END IF;

  UPDATE public.organization_vouchers
     SET redeemed_at = now(),
         redeemed_by_discord_id = trim(COALESCE(p_discord_id, '')),
         redeemed_organization_id = p_organization_id,
         organization_id = p_organization_id
   WHERE id = voucher_row.id
     AND redeemed_at IS NULL
     AND revoked_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Voucherul a fost folosit între timp.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.organizations
     SET active = true,
         lifecycle_status = 'active',
         grace_until = NULL,
         updated_at = now()
   WHERE id = p_organization_id;

  INSERT INTO public.app_settings (organization_id, key, value, updated_at)
  VALUES
    (p_organization_id, 'organization_access', jsonb_build_object('expires_at', next_expires), now()),
    (p_organization_id, 'organization_package', jsonb_build_object(
      'code', voucher_row.package_code,
      'unlimited', false,
      'expires_at', next_expires,
      'features', resolved_features
    ), now())
  ON CONFLICT (organization_id, key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;

  INSERT INTO public.organization_lifecycle_events (
    organization_id, event_type, actor_discord_id, details
  ) VALUES (
    p_organization_id,
    'voucher_access_reactivated',
    NULLIF(trim(COALESCE(p_discord_id, '')), ''),
    jsonb_build_object(
      'voucher_id', voucher_row.id,
      'duration_days', voucher_row.duration_days,
      'expires_at', next_expires
    )
  );

  RETURN QUERY SELECT
    next_expires,
    voucher_row.duration_days,
    voucher_row.package_code::text,
    resolved_features;
END;
$$;

ALTER FUNCTION public.redeem_voucher_create_organization(text, text, text, text, text, text, text, text) OWNER TO postgres;
ALTER FUNCTION public.redeem_voucher_reactivate_organization(text, text, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.redeem_voucher_create_organization(text, text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.redeem_voucher_reactivate_organization(text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_voucher_create_organization(text, text, text, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_voucher_reactivate_organization(text, text, uuid) TO service_role;

COMMIT;
