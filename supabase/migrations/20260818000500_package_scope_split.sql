-- Separate the legal employee scope from the Full organization/mafia scope.
-- This migration also normalizes old package JSON so a previously saved
-- feature list cannot keep Full-only modules on a Standard organization.

UPDATE public.app_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{features}',
  CASE WHEN value->>'code' = 'full' THEN
    '["core","announcements","announcements_departments","announcements_organization","requests","requests_departments","requests_organization","contracts","reports","legal_marketplace","legal_tools","assistant","status_live","discipline_departments","discipline_organization","illegal_calculator","illegal_locations","illegal_marketplace"]'::jsonb
  ELSE
    '["core","announcements","announcements_departments","requests","requests_departments","contracts","reports","legal_marketplace","legal_tools","assistant","status_live","discipline_departments"]'::jsonb
  END,
  true
)
WHERE key = 'organization_package';

-- Standard must not retain routes or role permissions for the Full-only
-- organization/mafia audiences after an older configuration is migrated.
UPDATE public.organization_settings
SET webhook_routes = COALESCE(webhook_routes, '{}'::jsonb)
  - 'organization'
  - 'requests_organization'
  - 'fines_organization'
  - 'warnings_organization'
  - 'sanctions_organization'
  - 'illegal_marketplace'
WHERE organization_id IN (
  SELECT organization_id
  FROM public.app_settings
  WHERE key = 'organization_package'
    AND COALESCE(value->>'code', 'standard') <> 'full'
);

UPDATE public.app_settings
SET value = CASE key
  WHEN 'action_permissions' THEN value - 'cereri.organization'
  WHEN 'communication_permissions' THEN jsonb_set(COALESCE(value, '{}'::jsonb), '{organization}', '{"read":[],"write":[]}'::jsonb, true)
  WHEN 'discipline_permissions' THEN jsonb_set(COALESCE(value, '{}'::jsonb), '{organization}', '{"read":[],"write":[],"sanction":[]}'::jsonb, true)
  ELSE value
END
WHERE key IN ('action_permissions', 'communication_permissions', 'discipline_permissions')
  AND organization_id IN (
    SELECT organization_id
    FROM public.app_settings
    WHERE key = 'organization_package'
      AND COALESCE(value->>'code', 'standard') <> 'full'
  );
