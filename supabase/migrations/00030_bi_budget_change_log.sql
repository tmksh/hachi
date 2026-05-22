-- BI 期中予算変更の修正履歴（§5.2 遡及按分用）

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS bi_budget_change_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  setting_id      UUID NOT NULL REFERENCES bi_annual_settings(id) ON DELETE CASCADE,
  fiscal_year     INT  NOT NULL,
  field_name      TEXT NOT NULL CHECK (field_name IN (
    'overhead_budget', 'sga_budget', 'target_revenue', 'target_gross_profit'
  )),
  old_value       NUMERIC NOT NULL DEFAULT 0,
  new_value       NUMERIC NOT NULL DEFAULT 0,
  effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
  note            TEXT,
  changed_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bi_budget_change_log_setting
  ON bi_budget_change_log(setting_id, effective_from DESC);
CREATE INDEX IF NOT EXISTS idx_bi_budget_change_log_company_year
  ON bi_budget_change_log(company_id, fiscal_year);

ALTER TABLE bi_budget_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bi_budget_change_log_select" ON bi_budget_change_log
  FOR SELECT USING (company_id = auth_company_id());
CREATE POLICY "bi_budget_change_log_insert" ON bi_budget_change_log
  FOR INSERT WITH CHECK (company_id = auth_company_id());
