-- Nu lăsa notificările interne să blocheze operațiunile principale ale panelului.
-- Unele baze restaurate au păstrat default-uri numerice pe ID-uri declarate UUID.

DO $$
DECLARE
  id_udt text;
  notification_count bigint;
  read_count bigint;
BEGIN
  SELECT c.udt_name
    INTO id_udt
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'panel_notifications'
    AND c.column_name = 'id';

  IF id_udt = 'uuid' THEN
    ALTER TABLE public.panel_notifications
      ALTER COLUMN id SET DEFAULT gen_random_uuid();
  ELSIF id_udt IN ('int2', 'int4', 'int8') THEN
    SELECT count(*) INTO notification_count FROM public.panel_notifications;
    SELECT count(*) INTO read_count FROM public.panel_notification_reads;

    -- Backup-ul vechi are ambele tabele goale, deci putem repara tipurile
    -- fără să pierdem mapări existente și fără să schimbăm anunțurile reale.
    IF notification_count = 0 AND read_count = 0 THEN
      ALTER TABLE public.panel_notification_reads
        DROP CONSTRAINT IF EXISTS panel_notification_reads_notification_id_fkey,
        DROP CONSTRAINT IF EXISTS panel_notification_reads_pkey;
      ALTER TABLE public.panel_notifications
        DROP CONSTRAINT IF EXISTS panel_notifications_pkey,
        ALTER COLUMN id DROP IDENTITY IF EXISTS,
        ALTER COLUMN id DROP DEFAULT;

      ALTER TABLE public.panel_notifications
        ALTER COLUMN id TYPE uuid USING gen_random_uuid();
      ALTER TABLE public.panel_notifications
        ALTER COLUMN id SET DEFAULT gen_random_uuid();
      ALTER TABLE public.panel_notifications
        ADD CONSTRAINT panel_notifications_pkey PRIMARY KEY (id);

      ALTER TABLE public.panel_notification_reads
        ALTER COLUMN notification_id TYPE uuid USING gen_random_uuid();
      ALTER TABLE public.panel_notification_reads
        ADD CONSTRAINT panel_notification_reads_pkey PRIMARY KEY (notification_id, discord_id),
        ADD CONSTRAINT panel_notification_reads_notification_id_fkey
          FOREIGN KEY (notification_id) REFERENCES public.panel_notifications(id) ON DELETE CASCADE;

      DROP SEQUENCE IF EXISTS public.panel_notifications_id_seq;
    END IF;
  END IF;

  SELECT c.udt_name
    INTO id_udt
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'panel_notification_reads'
    AND c.column_name = 'id';

  IF id_udt = 'uuid' THEN
    ALTER TABLE public.panel_notification_reads
      ALTER COLUMN id SET DEFAULT gen_random_uuid();
  END IF;
END $$;

-- Dacă o bază restaurată are încă o structură incompatibilă pentru notificări,
-- notificarea este ignorată, iar operațiunea principală rămâne funcțională.
DROP FUNCTION IF EXISTS public.create_panel_notification(uuid, text, text, text, text, text, text, text, text, jsonb, timestamptz);

CREATE FUNCTION public.create_panel_notification(
  p_organization_id uuid,
  p_title text,
  p_message text,
  p_level text DEFAULT 'info',
  p_notification_type text DEFAULT 'system',
  p_required_page text DEFAULT NULL,
  p_access_key text DEFAULT NULL,
  p_recipient_discord_id text DEFAULT NULL,
  p_link text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_organization_id IS NULL OR p_title IS NULL OR p_message IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.panel_notifications (
    organization_id, title, message, level, notification_type,
    required_page, access_key, recipient_discord_id, link, metadata, expires_at
  ) VALUES (
    p_organization_id,
    left(trim(p_title), 120),
    left(trim(p_message), 1000),
    CASE WHEN p_level IN ('info', 'success', 'warning', 'error') THEN p_level ELSE 'info' END,
    left(coalesce(trim(p_notification_type), 'system'), 60),
    nullif(left(trim(coalesce(p_required_page, '')), 120), ''),
    nullif(left(trim(coalesce(p_access_key, '')), 120), ''),
    nullif(left(trim(coalesce(p_recipient_discord_id, '')), 40), ''),
    nullif(left(trim(coalesce(p_link, '')), 500), ''),
    coalesce(p_metadata, '{}'::jsonb),
    p_expires_at
  )
  RETURNING id INTO v_id;

  RETURN v_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Panel notification skipped: %', SQLERRM;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.create_panel_notification(uuid, text, text, text, text, text, text, text, text, jsonb, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_panel_notification(uuid, text, text, text, text, text, text, text, text, jsonb, timestamptz) TO service_role;
