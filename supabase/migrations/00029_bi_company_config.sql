-- BI 会社別分析設定 + 部門紐付け

ALTER TABLE constructions ADD COLUMN IF NOT EXISTS department_name TEXT;
ALTER TABLE deals         ADD COLUMN IF NOT EXISTS department_name TEXT;
ALTER TABLE contracts     ADD COLUMN IF NOT EXISTS department_name TEXT;

CREATE INDEX IF NOT EXISTS idx_constructions_department ON constructions(company_id, department_name);
CREATE INDEX IF NOT EXISTS idx_deals_department ON deals(company_id, department_name);

CREATE TABLE IF NOT EXISTS bi_company_config (
  company_id  UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  config      JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bi_company_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bi_company_config_select" ON bi_company_config
  FOR SELECT USING (company_id = auth_company_id());
CREATE POLICY "bi_company_config_insert" ON bi_company_config
  FOR INSERT WITH CHECK (company_id = auth_company_id());
CREATE POLICY "bi_company_config_update" ON bi_company_config
  FOR UPDATE USING (company_id = auth_company_id());
CREATE POLICY "bi_company_config_delete" ON bi_company_config
  FOR DELETE USING (company_id = auth_company_id());
