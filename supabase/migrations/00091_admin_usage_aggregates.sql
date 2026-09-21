-- Aggregate all usage rows in PostgreSQL instead of the REST API's row-limited result.
-- Only the server-side super-admin action may call this service-role-only function.
CREATE OR REPLACE FUNCTION public.admin_usage_summary()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
WITH users_by_company AS (
  SELECT p.company_id, count(*) AS users, max(u.last_sign_in_at) AS last_login
  FROM public.profiles p LEFT JOIN auth.users u ON u.id = p.id GROUP BY p.company_id
), constructions_by_company AS (
  SELECT company_id, count(*) AS constructions, max(updated_at) AS last_update
  FROM public.constructions GROUP BY company_id
), ai AS (
  SELECT company_id, count(*) AS calls,
    sum(coalesce(tokens_in,0)::bigint + coalesce(tokens_out,0)::bigint) AS tokens,
    count(*) FILTER (WHERE created_at >= now() - interval '30 days') AS recent_calls,
    max(created_at) AS last_use
  FROM public.ai_usage_events GROUP BY company_id
), usage AS (
  SELECT c.id, c.name, c.settings->>'plan' AS plan,
    coalesce(u.users,0) AS users, coalesce(b.constructions,0) AS constructions,
    greatest(u.last_login, b.last_update, a.last_use) AS last_activity,
    coalesce(a.calls,0) AS calls, coalesce(a.tokens,0) AS tokens
  FROM public.companies c
  LEFT JOIN users_by_company u ON u.company_id=c.id
  LEFT JOIN constructions_by_company b ON b.company_id=c.id
  LEFT JOIN ai a ON a.company_id=c.id
)
SELECT jsonb_build_object(
  'companyUsage', coalesce((SELECT jsonb_agg(jsonb_build_object(
    'companyId', id, 'companyName', name, 'plan', plan,
    'userCount', users, 'constructionCount', constructions,
    'lastActivityAt', last_activity,
    'active30d', coalesce(last_activity >= now() - interval '30 days', false),
    'aiCalls', calls, 'aiTokens', tokens) ORDER BY name) FROM usage), '[]'::jsonb),
  'aiUsage', jsonb_build_object(
    'totalCalls', coalesce((SELECT sum(calls) FROM ai),0),
    'totalTokens', coalesce((SELECT sum(tokens) FROM ai),0),
    'last30dCalls', coalesce((SELECT sum(recent_calls) FROM ai),0),
    'byCompany', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'companyId', u.id, 'companyName', u.name, 'calls', u.calls, 'tokens', u.tokens)
      ORDER BY u.calls DESC, u.name) FROM usage u WHERE u.calls>0), '[]'::jsonb)
  )
);
$$;
REVOKE ALL ON FUNCTION public.admin_usage_summary() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_usage_summary() TO service_role;
