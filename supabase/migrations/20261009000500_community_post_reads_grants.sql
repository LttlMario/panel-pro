-- Repară accesul de citire pentru pagina Anunțuri.
GRANT SELECT ON TABLE public.community_post_reads TO anon, authenticated;
GRANT ALL ON TABLE public.community_post_reads TO service_role;

DROP POLICY IF EXISTS community_post_reads_select ON public.community_post_reads;
CREATE POLICY community_post_reads_select ON public.community_post_reads
  FOR SELECT TO anon, authenticated
  USING (organization_id = public.current_panel_organization_id());
