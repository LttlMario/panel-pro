-- Notificări interne generate server-side pentru evenimentele importante din panel.
-- Citirea se face exclusiv prin Edge Function, unde se verifică sesiunea și rolurile.

CREATE TABLE IF NOT EXISTS public.panel_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  level text NOT NULL DEFAULT 'info',
  notification_type text NOT NULL DEFAULT 'system',
  required_page text,
  access_key text,
  recipient_discord_id text,
  link text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.panel_notifications
  ADD COLUMN IF NOT EXISTS notification_type text NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS required_page text,
  ADD COLUMN IF NOT EXISTS access_key text,
  ADD COLUMN IF NOT EXISTS recipient_discord_id text,
  ADD COLUMN IF NOT EXISTS link text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS panel_notifications_org_created_idx
  ON public.panel_notifications (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS panel_notifications_recipient_idx
  ON public.panel_notifications (organization_id, recipient_discord_id, created_at DESC);

CREATE INDEX IF NOT EXISTS panel_notifications_access_idx
  ON public.panel_notifications (organization_id, required_page, access_key, created_at DESC);

CREATE TABLE IF NOT EXISTS public.panel_notification_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  notification_id uuid NOT NULL REFERENCES public.panel_notifications(id) ON DELETE CASCADE,
  discord_id text NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notification_id, discord_id)
);

CREATE INDEX IF NOT EXISTS panel_notification_reads_user_idx
  ON public.panel_notification_reads (organization_id, discord_id, read_at DESC);

ALTER TABLE public.panel_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.panel_notification_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.panel_notifications, public.panel_notification_reads FROM anon, authenticated;
GRANT ALL ON TABLE public.panel_notifications, public.panel_notification_reads TO service_role;

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
END;
$$;

REVOKE ALL ON FUNCTION public.create_panel_notification(uuid, text, text, text, text, text, text, text, text, jsonb, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_panel_notification(uuid, text, text, text, text, text, text, text, text, jsonb, timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.panel_event_notification_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row jsonb;
  v_old jsonb;
  v_org_id uuid;
  v_org_text text;
  v_target_org_id uuid;
  v_id text;
  v_recipient text;
  v_status text;
  v_old_status text;
  v_audience text;
  v_page text;
  v_access text;
  v_title text;
  v_message text;
  v_link text;
BEGIN
  v_row := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  v_old := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  v_org_text := nullif(v_row ->> 'organization_id', '');

  IF v_org_text IS NOT NULL AND v_org_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    v_org_id := v_org_text::uuid;
  END IF;

  v_id := nullif(v_row ->> 'id', '');
  v_recipient := nullif(v_row ->> 'discord_id', '');

  IF TG_TABLE_NAME = 'shifts' AND TG_OP = 'INSERT' THEN
    PERFORM public.create_panel_notification(
      v_org_id,
      'Pontaj pornit',
      format('Ai început tura%s.', CASE WHEN nullif(v_row ->> 'shift_type', '') IS NULL THEN '' ELSE ' de ' || (v_row ->> 'shift_type') END),
      'success', 'shift_started', 'pontaj.html', 'page:pontaj.html', v_recipient,
      'pontaj.html', jsonb_build_object('shift_id', v_id)
    );
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'shifts' AND TG_OP = 'UPDATE' THEN
    v_status := v_row ->> 'status';
    v_old_status := v_old ->> 'status';
    IF v_status IS DISTINCT FROM v_old_status AND v_status IN ('paused', 'active', 'completed', 'auto_completed') THEN
      v_title := CASE
        WHEN v_status = 'paused' THEN 'Pontaj pus pe pauză'
        WHEN v_status = 'active' AND v_old_status = 'paused' THEN 'Pontaj reluat'
        ELSE 'Tura încheiată'
      END;
      v_message := CASE
        WHEN v_status = 'paused' THEN 'Tura ta a fost pusă pe pauză.'
        WHEN v_status = 'active' AND v_old_status = 'paused' THEN 'Tura ta a fost reluată.'
        ELSE 'Tura ta a fost încheiată și salvată în istoric.'
      END;
      PERFORM public.create_panel_notification(
        v_org_id, v_title, v_message,
        CASE WHEN v_status = 'paused' THEN 'warning' ELSE 'success' END,
        CASE WHEN v_status = 'paused' THEN 'shift_paused' WHEN v_status = 'active' THEN 'shift_resumed' ELSE 'shift_completed' END,
        'pontaj.html', 'page:pontaj.html', v_recipient, 'pontaj.html', jsonb_build_object('shift_id', v_id, 'status', v_status)
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'absences' AND TG_OP = 'INSERT' THEN
    PERFORM public.create_panel_notification(
      v_org_id, 'Cerere înregistrată',
      format('Cererea ta de tip „%s” a fost înregistrată.', coalesce(nullif(v_row ->> 'notice_type', ''), 'învoire')),
      'info', 'absence_created', 'cereri.html', 'page:cereri.html', v_recipient,
      'cereri.html', jsonb_build_object('absence_id', v_id)
    );
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'community_posts' AND TG_OP = 'INSERT' THEN
    v_audience := CASE WHEN v_row ->> 'audience' = 'departments' THEN 'departments' ELSE 'organization' END;
    PERFORM public.create_panel_notification(
      v_org_id,
      CASE
        WHEN v_row ->> 'post_type' = 'poll' THEN 'Sondaj nou'
        WHEN v_row ->> 'post_type' = 'fine' THEN 'Amendă nouă'
        ELSE 'Anunț nou'
      END,
      coalesce(nullif(v_row ->> 'title', ''), 'A fost publicată o comunicare nouă.'),
      CASE WHEN v_row ->> 'post_type' = 'fine' THEN 'warning' ELSE 'info' END,
      CASE
        WHEN v_row ->> 'post_type' = 'poll' THEN 'poll_created'
        WHEN v_row ->> 'post_type' = 'fine' THEN 'fine_created'
        ELSE 'announcement_created'
      END,
      'anunturi.html',
      CASE WHEN v_row ->> 'post_type' = 'fine' THEN 'discipline:' ELSE 'communication:' END || v_audience,
      NULL,
      'anunturi.html', jsonb_build_object('post_id', v_id, 'audience', v_audience)
    );
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME IN ('disciplinary_warnings', 'disciplinary_sanctions') AND TG_OP = 'INSERT' THEN
    v_audience := CASE WHEN v_row ->> 'target_scope' = 'departments' THEN 'departments' ELSE 'organization' END;
    v_recipient := CASE WHEN v_audience = 'departments' THEN nullif(v_row ->> 'target_discord_id', '') ELSE NULL END;
    v_title := CASE WHEN TG_TABLE_NAME = 'disciplinary_warnings' THEN 'Avertisment nou' ELSE 'Sancțiune nouă' END;
    v_message := CASE
      WHEN TG_TABLE_NAME = 'disciplinary_warnings' THEN 'A fost înregistrat un avertisment disciplinar.'
      ELSE 'A fost înregistrată o sancțiune disciplinară.'
    END;
    PERFORM public.create_panel_notification(
      v_org_id, v_title, v_message, 'warning',
      CASE WHEN TG_TABLE_NAME = 'disciplinary_warnings' THEN 'warning_created' ELSE 'sanction_created' END,
      'anunturi.html', 'discipline:' || v_audience, v_recipient,
      'anunturi.html?discipline=' || CASE WHEN TG_TABLE_NAME = 'disciplinary_warnings' THEN 'warning' ELSE 'sanction' END || '&id=' || coalesce(v_id, ''),
      jsonb_build_object('discipline_id', v_id, 'scope', v_audience)
    );
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME IN ('marketplace', 'marketplace_ilegal') AND TG_OP = 'INSERT' THEN
    v_page := CASE WHEN TG_TABLE_NAME = 'marketplace_ilegal' THEN 'marketplace-ilegal.html' ELSE 'marketplace.html' END;
    v_access := 'page:' || v_page;
    v_title := CASE WHEN TG_TABLE_NAME = 'marketplace_ilegal' THEN 'Anunț nou în Black Market' ELSE 'Anunț nou în Marketplace' END;
    v_message := format('%s a fost publicat.', coalesce(nullif(v_row ->> 'nume', ''), 'Un produs sau serviciu'));
    v_link := v_page;

    IF v_org_id IS NULL AND TG_TABLE_NAME = 'marketplace_ilegal' THEN
      FOR v_target_org_id IN SELECT id FROM public.organizations WHERE active = true LOOP
        PERFORM public.create_panel_notification(
          v_target_org_id, v_title, v_message, 'info',
          CASE WHEN TG_TABLE_NAME = 'marketplace_ilegal' THEN 'illegal_marketplace_created' ELSE 'marketplace_created' END,
          v_page, v_access, NULL, v_link, jsonb_build_object('marketplace_id', v_id, 'global', true)
        );
      END LOOP;
    ELSE
      PERFORM public.create_panel_notification(
        v_org_id, v_title, v_message, 'info',
        CASE WHEN TG_TABLE_NAME = 'marketplace_ilegal' THEN 'illegal_marketplace_created' ELSE 'marketplace_created' END,
        v_page, v_access, NULL, v_link, jsonb_build_object('marketplace_id', v_id)
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.panel_event_notification_trigger() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['shifts', 'absences', 'community_posts', 'disciplinary_warnings', 'disciplinary_sanctions', 'marketplace', 'marketplace_ilegal'] LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS panel_event_notification_%I ON public.%I', table_name, table_name);
      EXECUTE format('CREATE TRIGGER panel_event_notification_%I AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.panel_event_notification_trigger()', table_name, table_name);
    END IF;
  END LOOP;
END;
$$;
