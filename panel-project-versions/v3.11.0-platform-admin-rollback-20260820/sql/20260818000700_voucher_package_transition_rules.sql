-- Keep package transitions predictable when an organization redeems a voucher.
-- A Standard voucher cannot replace an active Full package. A Full voucher can
-- upgrade Standard immediately. Downgrades remove only Full-only configuration;
-- organization data such as members, shifts, contracts and reports is preserved.

BEGIN;

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
  current_package jsonb;
  existing_expires timestamptz;
  current_package_expires timestamptz;
  base_time timestamptz;
  next_expires timestamptz;
  resolved_features jsonb;
  current_package_code text;
  current_package_unlimited boolean;
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

  SELECT value
    INTO current_package
    FROM public.app_settings
   WHERE organization_id = p_organization_id
     AND key = 'organization_package';

  current_package_code := lower(COALESCE(current_package ->> 'code', 'standard'));
  current_package_unlimited := COALESCE((current_package ->> 'unlimited')::boolean, false);
  current_package_expires := NULLIF(current_package ->> 'expires_at', '')::timestamptz;

  IF lower(COALESCE(voucher_row.package_code, 'standard')) = 'standard'
     AND current_package_code = 'full'
     AND (current_package_unlimited OR current_package_expires IS NULL OR current_package_expires > now()) THEN
    RAISE EXCEPTION 'Pachetul Full este încă activ. Voucherul Standard poate fi folosit după expirarea Full-ului.' USING ERRCODE = 'P0001';
  END IF;

  existing_expires := NULLIF(current_access ->> 'expires_at', '')::timestamptz;
  base_time := CASE
    WHEN existing_expires IS NOT NULL AND existing_expires > now() THEN existing_expires
    ELSE now()
  END;
  next_expires := base_time + make_interval(days => voucher_row.duration_days);

  IF lower(voucher_row.package_code) = 'full' THEN
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
      'code', lower(voucher_row.package_code),
      'unlimited', false,
      'expires_at', next_expires,
      'features', resolved_features
    ), now())
  ON CONFLICT (organization_id, key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;

  IF lower(voucher_row.package_code) <> 'full' THEN
    UPDATE public.organization_settings
       SET webhook_routes = COALESCE(webhook_routes, '{}'::jsonb)
         - 'organization'
         - 'requests_organization'
         - 'illegal_marketplace'
         - 'fines_organization'
         - 'warnings_organization'
         - 'sanctions_organization',
           updated_at = now()
     WHERE organization_id = p_organization_id;

    UPDATE public.app_settings
       SET value = COALESCE(value, '{}'::jsonb)
         - 'calculatorilegal.html'
         - 'locatiiilegale.html'
         - 'marketplace-ilegal.html',
           updated_at = now()
     WHERE organization_id = p_organization_id
       AND key IN ('page_permissions', 'assistant_page_permissions');

    UPDATE public.app_settings
       SET value = CASE key
         WHEN 'action_permissions' THEN jsonb_set(COALESCE(value, '{}'::jsonb), '{cereri.organization}', '[]'::jsonb, true)
         WHEN 'communication_permissions' THEN jsonb_set(COALESCE(value, '{}'::jsonb), '{organization}', '{"read":[],"write":[]}'::jsonb, true)
         WHEN 'discipline_permissions' THEN jsonb_set(COALESCE(value, '{}'::jsonb), '{organization}', '{"read":[],"write":[],"sanction":[]}'::jsonb, true)
         ELSE value
       END,
           updated_at = now()
     WHERE organization_id = p_organization_id
       AND key IN ('action_permissions', 'communication_permissions', 'discipline_permissions');
  END IF;

  INSERT INTO public.organization_lifecycle_events (
    organization_id, event_type, actor_discord_id, details
  ) VALUES (
    p_organization_id,
    'voucher_access_reactivated',
    NULLIF(trim(COALESCE(p_discord_id, '')), ''),
    jsonb_build_object(
      'voucher_id', voucher_row.id,
      'duration_days', voucher_row.duration_days,
      'expires_at', next_expires,
      'package_code', lower(voucher_row.package_code),
      'previous_package_code', current_package_code,
      'full_configuration_cleared', lower(voucher_row.package_code) <> 'full'
    )
  );

  RETURN QUERY SELECT
    next_expires,
    voucher_row.duration_days,
    lower(voucher_row.package_code),
    resolved_features;
END;
$$;

ALTER FUNCTION public.redeem_voucher_reactivate_organization(text, text, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.redeem_voucher_reactivate_organization(text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_voucher_reactivate_organization(text, text, uuid) TO service_role;

COMMIT;
