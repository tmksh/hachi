-- Dashboard KPI aggregation, unfollowed customers, and query indexes

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_customers_company_active
  ON customers(company_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customers_assigned_active
  ON customers(company_id, assigned_to)
  WHERE deleted_at IS NULL AND assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deals_company_updated
  ON deals(company_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_deals_company_created
  ON deals(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deals_active_customer
  ON deals(customer_id, updated_at DESC)
  WHERE stage NOT IN ('won', 'lost');

CREATE INDEX IF NOT EXISTS idx_invoices_company_status
  ON invoices(company_id, status);

CREATE INDEX IF NOT EXISTS idx_constructions_active_end
  ON constructions(company_id, end_date)
  WHERE status IN ('in_progress', 'preparing');

-- ============================================
-- Dashboard aggregates (KPI + production + monthly trend)
-- ============================================

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
  monthly_trend AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'month_key', to_char(m.month_start, 'YYYY-MM'),
        'won_value', COALESCE((
          SELECT SUM(d.value)
          FROM deals d, cid
          WHERE d.company_id = cid.company_id
            AND d.stage = 'won'
            AND date_trunc('month', d.updated_at) = m.month_start
        ), 0),
        'pipeline_value', COALESCE((
          SELECT SUM(d.value)
          FROM deals d, cid
          WHERE d.company_id = cid.company_id
            AND d.stage NOT IN ('won', 'lost')
            AND date_trunc('month', d.created_at) = m.month_start
        ), 0)
      ) ORDER BY m.month_start
    ), '[]'::jsonb) AS data
    FROM months m
  )
  SELECT jsonb_build_object(
    'customer_count', (
      SELECT COUNT(*)::int FROM customers c, cid
      WHERE c.company_id = cid.company_id AND c.deleted_at IS NULL
    ),
    'deal_count', (
      SELECT COUNT(*)::int FROM deals d, cid WHERE d.company_id = cid.company_id
    ),
    'pipeline_value', COALESCE((
      SELECT SUM(d.value) FROM deals d, cid
      WHERE d.company_id = cid.company_id AND d.stage NOT IN ('won', 'lost')
    ), 0),
    'won_value', COALESCE((
      SELECT SUM(d.value) FROM deals d, cid
      WHERE d.company_id = cid.company_id AND d.stage = 'won'
    ), 0),
    'production_summary', jsonb_build_object(
      'contract_count', (
        SELECT COUNT(*)::int FROM contracts ct, cid WHERE ct.company_id = cid.company_id
      ),
      'active_contracts', (
        SELECT COUNT(*)::int FROM contracts ct, cid
        WHERE ct.company_id = cid.company_id
          AND ct.status IN ('executing', 'contracted')
      ),
      'invoice_draft', (
        SELECT COUNT(*)::int FROM invoices i, cid
        WHERE i.company_id = cid.company_id AND i.status = 'draft'
      ),
      'invoice_sent', (
        SELECT COUNT(*)::int FROM invoices i, cid
        WHERE i.company_id = cid.company_id AND i.status = 'sent'
      ),
      'invoice_unpaid_total', COALESCE((
        SELECT SUM(i.total) FROM invoices i, cid
        WHERE i.company_id = cid.company_id AND i.status = 'sent'
      ), 0)
    ),
    'monthly_trend', (SELECT data FROM monthly_trend)
  );
$$;

-- ============================================
-- Customer counts (single query)
-- ============================================

CREATE OR REPLACE FUNCTION get_customer_counts()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT jsonb_build_object(
    'total', COUNT(*)::int,
    'corporation', COUNT(*) FILTER (WHERE company_name IS NOT NULL)::int
  )
  FROM customers
  WHERE deleted_at IS NULL
    AND company_id = auth_company_id();
$$;

-- ============================================
-- Unfollowed customers (SQL-side filter)
-- ============================================

CREATE OR REPLACE FUNCTION get_unfollowed_customers(
  p_days int DEFAULT 7,
  p_page int DEFAULT 1,
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  name text,
  company_name text,
  phone text,
  email text,
  address text,
  assigned_to uuid,
  status text,
  inquiry_date date,
  created_at timestamptz,
  assigned_to_profile_id uuid,
  assigned_to_display_name text,
  last_deal_updated timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH active_deals AS (
    SELECT customer_id, MAX(updated_at) AS last_updated
    FROM deals
    WHERE stage NOT IN ('won', 'lost')
    GROUP BY customer_id
  )
  SELECT
    c.id,
    c.name,
    c.company_name,
    c.phone,
    c.email,
    c.address,
    c.assigned_to,
    c.status,
    c.inquiry_date,
    c.created_at,
    p.id AS assigned_to_profile_id,
    p.display_name AS assigned_to_display_name,
    ad.last_updated AS last_deal_updated
  FROM customers c
  LEFT JOIN active_deals ad ON ad.customer_id = c.id
  LEFT JOIN profiles p ON p.id = c.assigned_to
  WHERE c.deleted_at IS NULL
    AND c.assigned_to IS NOT NULL
    AND c.company_id = auth_company_id()
    AND (
      ad.last_updated IS NULL
      OR ad.last_updated < NOW() - (GREATEST(p_days, 1) || ' days')::interval
    )
  ORDER BY COALESCE(ad.last_updated, c.created_at) ASC
  OFFSET GREATEST(p_page - 1, 0) * LEAST(GREATEST(p_limit, 1), 100)
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
$$;

CREATE OR REPLACE FUNCTION get_unfollowed_customers_count(p_days int DEFAULT 7)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH active_deals AS (
    SELECT customer_id, MAX(updated_at) AS last_updated
    FROM deals
    WHERE stage NOT IN ('won', 'lost')
    GROUP BY customer_id
  )
  SELECT COUNT(*)::bigint
  FROM customers c
  LEFT JOIN active_deals ad ON ad.customer_id = c.id
  WHERE c.deleted_at IS NULL
    AND c.assigned_to IS NOT NULL
    AND c.company_id = auth_company_id()
    AND (
      ad.last_updated IS NULL
      OR ad.last_updated < NOW() - (GREATEST(p_days, 1) || ' days')::interval
    );
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_aggregates() TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION get_unfollowed_customers(int, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION get_unfollowed_customers_count(int) TO authenticated;
