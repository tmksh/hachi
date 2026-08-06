-- No.72: 部門別規定粗利率マスタ ＋ 見積の部門選択

CREATE TABLE IF NOT EXISTS department_margin_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  department_name TEXT NOT NULL,
  -- 規定粗利率（パーセント値。例: 50 = 50%）
  margin_rate_percent NUMERIC NOT NULL DEFAULT 50
    CHECK (margin_rate_percent >= 0 AND margin_rate_percent < 100),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, department_name)
);

CREATE INDEX IF NOT EXISTS idx_department_margin_rates_company
  ON department_margin_rates(company_id, sort_order);

COMMENT ON TABLE department_margin_rates IS '部門別の見積規定粗利率（No.72）。未設定時は会社一律基準にフォールバック';
COMMENT ON COLUMN department_margin_rates.margin_rate_percent IS '規定粗利率（パーセント値。例: 50 = 50%）';

ALTER TABLE department_margin_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_department_margin_rates" ON department_margin_rates
  FOR SELECT USING (company_id = auth_company_id());
CREATE POLICY "tenant_insert_department_margin_rates" ON department_margin_rates
  FOR INSERT WITH CHECK (company_id = auth_company_id());
CREATE POLICY "tenant_update_department_margin_rates" ON department_margin_rates
  FOR UPDATE USING (company_id = auth_company_id());
CREATE POLICY "tenant_delete_department_margin_rates" ON department_margin_rates
  FOR DELETE USING (
    company_id = auth_company_id()
    AND auth_role() IN ('hq_admin', 'admin', 'contractor_admin')
  );

-- 見積に部門を持たせる
ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS department_name TEXT;

COMMENT ON COLUMN estimates.department_name IS '見積の事業部門。部門別規定粗利率の判定に使用（No.72）';

CREATE INDEX IF NOT EXISTS idx_estimates_department_name
  ON estimates(company_id, department_name);
