-- Dashboard aggregates: 相関サブクエリ14回を GROUP BY 2回 + 1パス集計に置き換える

CREATE INDEX IF NOT EXISTS idx_deals_company_stage_updated
  ON deals(company_id, stage, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_deals_company_stage_created
  ON deals(company_id, stage, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_constructions_company_dates
  ON constructions(company_id, start_date, end_date);

CREATE OR REPLACE FUNCTION get_dashboard_aggregates()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH cid AS (
    SELECT auth_company_id() AS company_id
  ),
  months AS (
    SELECT generate_series(
      date_trunc('month', NOW() - INTERVAL '6 months'),
      date_trunc('month', NOW()),
      INTERVAL '1 month'
    ) AS month_start
  ),
  deal_stats AS (
    SELECT
      COUNT(*)::int AS deal_count,
      COALESCE(SUM(value) FILTER (WHERE stage NOT IN ('won', 'lost')), 0) AS pipeline_value,
      COALESCE(SUM(value) FILTER (WHERE stage = 'won'), 0) AS won_value
    FROM deals d, cid
    WHERE d.company_id = cid.company_id
  ),
  won_by_month AS (
    SELECT date_trunc('month', d.updated_at) AS month_start, SUM(d.value) AS won_value
    FROM deals d, cid
    WHERE d.company_id = cid.company_id
      AND d.stage = 'won'
      AND d.updated_at >= date_trunc('month', NOW() - INTERVAL '6 months')
    GROUP BY 1
  ),
  pipeline_by_month AS (
    SELECT date_trunc('month', d.created_at) AS month_start, SUM(d.value) AS pipeline_value
    FROM deals d, cid
    WHERE d.company_id = cid.company_id
      AND d.stage NOT IN ('won', 'lost')
      AND d.created_at >= date_trunc('month', NOW() - INTERVAL '6 months')
    GROUP BY 1
  ),
  monthly_trend AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'month_key', to_char(m.month_start, 'YYYY-MM'),
        'won_value', COALESCE(w.won_value, 0),
        'pipeline_value', COALESCE(p.pipeline_value, 0)
      ) ORDER BY m.month_start
    ), '[]'::jsonb) AS data
    FROM months m
    LEFT JOIN won_by_month w ON w.month_start = m.month_start
    LEFT JOIN pipeline_by_month p ON p.month_start = m.month_start
  ),
  contract_stats AS (
    SELECT
      COUNT(*)::int AS contract_count,
      COUNT(*) FILTER (WHERE status IN ('executing', 'contracted'))::int AS active_contracts
    FROM contracts ct, cid
    WHERE ct.company_id = cid.company_id
  ),
  invoice_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE status = 'draft')::int AS invoice_draft,
      COUNT(*) FILTER (WHERE status = 'sent')::int AS invoice_sent,
      COALESCE(SUM(total) FILTER (WHERE status = 'sent'), 0) AS invoice_unpaid_total
    FROM invoices i, cid
    WHERE i.company_id = cid.company_id
  )
  SELECT jsonb_build_object(
    'customer_count', (
      SELECT COUNT(*)::int FROM customers c, cid
      WHERE c.company_id = cid.company_id AND c.deleted_at IS NULL
    ),
    'deal_count', (SELECT deal_count FROM deal_stats),
    'pipeline_value', (SELECT pipeline_value FROM deal_stats),
    'won_value', (SELECT won_value FROM deal_stats),
    'production_summary', jsonb_build_object(
      'contract_count', (SELECT contract_count FROM contract_stats),
      'active_contracts', (SELECT active_contracts FROM contract_stats),
      'invoice_draft', (SELECT invoice_draft FROM invoice_stats),
      'invoice_sent', (SELECT invoice_sent FROM invoice_stats),
      'invoice_unpaid_total', (SELECT invoice_unpaid_total FROM invoice_stats)
    ),
    'monthly_trend', (SELECT data FROM monthly_trend)
  );
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_aggregates() TO authenticated;
