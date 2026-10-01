-- Repara configuratiile Discord pentru embedurile cu butoane.
-- Daca un mesaj exista in registrul central, dar ruta din organization_settings
-- a ramas fara channel_id/message_id, interaction handlerul poate refuza clickul.

BEGIN;

DO $$
DECLARE
  item record;
  routes jsonb;
  current_target jsonb;
BEGIN
  FOR item IN
    SELECT DISTINCT ON (organization_id, route_key, target, channel_id)
           organization_id,
           route_key,
           target,
           channel_id,
           guild_id,
           message_id
      FROM public.discord_message_registry
     WHERE status IN ('pending', 'active', 'stale')
       AND route_key IS NOT NULL
       AND target IN ('primary', 'secondary')
       AND channel_id ~ '^[0-9]{15,22}$'
       AND COALESCE(message_key, '') <> ''
     ORDER BY organization_id, route_key, target, channel_id, updated_at DESC
  LOOP
    SELECT COALESCE(discord_channel_routes, '{}'::jsonb)
      INTO routes
      FROM public.organization_settings
     WHERE organization_id = item.organization_id
     FOR UPDATE;

    IF routes IS NULL THEN
      CONTINUE;
    END IF;

    current_target := COALESCE(routes -> item.route_key -> item.target, '{}'::jsonb);

    IF current_target ->> 'enabled' = 'false' THEN
      CONTINUE;
    END IF;

    IF COALESCE(current_target ->> 'channel_id', '') = ''
       OR COALESCE(current_target ->> 'message_id', '') = '' THEN
      routes := jsonb_set(routes, ARRAY[item.route_key], COALESCE(routes -> item.route_key, '{}'::jsonb), true);
      routes := jsonb_set(
        routes,
        ARRAY[item.route_key, item.target],
        current_target
          || jsonb_build_object('enabled', true, 'channel_id', item.channel_id)
          || CASE WHEN item.guild_id ~ '^[0-9]{15,22}$' THEN jsonb_build_object('guild_id', item.guild_id) ELSE '{}'::jsonb END
          || CASE WHEN item.message_id ~ '^[0-9]{15,22}$' THEN jsonb_build_object('message_id', item.message_id) ELSE '{}'::jsonb END,
        true
      );

      UPDATE public.organization_settings
         SET discord_channel_routes = routes,
             updated_at = now()
       WHERE organization_id = item.organization_id;
    END IF;
  END LOOP;
END $$;

COMMIT;
