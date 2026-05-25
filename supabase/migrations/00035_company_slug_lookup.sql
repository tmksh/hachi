-- サブドメイン解決用: slug から company_id のみを返す（RLS バイパス、最小限の公開）
CREATE OR REPLACE FUNCTION public.resolve_company_id_by_slug(p_slug text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM companies WHERE slug = p_slug LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_company_id_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_company_id_by_slug(text) TO anon, authenticated;
