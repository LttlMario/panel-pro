-- Marketplace-ul legal este global în panel, la fel ca Black Market-ul.
-- Notificările panel trebuie create pentru fiecare organizație activă care are
-- acces la pagina Marketplace, nu doar pentru organizația autorului.

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
      v_org_id, 'Pontaj pornit',
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

    FOR v_target_org_id IN SELECT id FROM public.organizations WHERE active = true LOOP
      PERFORM public.create_panel_notification(
        v_target_org_id, v_title, v_message, 'info',
        CASE WHEN TG_TABLE_NAME = 'marketplace_ilegal' THEN 'illegal_marketplace_created' ELSE 'marketplace_created' END,
        v_page, v_access, NULL, v_link,
        jsonb_build_object('marketplace_id', v_id, 'global', true, 'source_organization_id', v_org_id)
      );
    END LOOP;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.panel_event_notification_trigger() FROM PUBLIC, anon, authenticated;
