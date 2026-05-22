-- ============================================
-- BI ダッシュボード 年度設定
-- ============================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 年度ごとの全社設定
CREATE TABLE bi_annual_settings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  fiscal_year         INT  NOT NULL,                           -- 西暦年度 (e.g. 2026 = R8年度)
  target_revenue      NUMERIC NOT NULL DEFAULT 0,             -- 全社目標売上（年額）
  target_gross_profit NUMERIC NOT NULL DEFAULT 0,             -- 全社目標粗利（年額）
  overhead_budget     NUMERIC NOT NULL DEFAULT 0,             -- 予算配賦（製造間接費）年額
  sga_budget          NUMERIC NOT NULL DEFAULT 0,             -- 販管費予算（年額）
  overhead_mode       TEXT    NOT NULL DEFAULT 'lump_sum'
    CHECK (overhead_mode IN ('breakdown', 'lump_sum')),        -- 内訳入力 or 一括入力
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, fiscal_year)
);

CREATE INDEX idx_bi_annual_settings_company ON bi_annual_settings(company_id);

-- 予算配賦 内訳明細（モードA用）
CREATE TABLE bi_overhead_items (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID    NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  setting_id  UUID    NOT NULL REFERENCES bi_annual_settings(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  amount      NUMERIC NOT NULL DEFAULT 0,
  sort_order  INT     NOT NULL DEFAULT 0,
  is_custom   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bi_overhead_items_setting ON bi_overhead_items(setting_id);

-- 部門別 売上・粗利目標
CREATE TABLE bi_department_targets (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID    NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  setting_id      UUID    NOT NULL REFERENCES bi_annual_settings(id) ON DELETE CASCADE,
  department_name TEXT    NOT NULL,
  target_revenue  NUMERIC NOT NULL DEFAULT 0,
  target_gross_profit NUMERIC NOT NULL DEFAULT 0,
  sort_order      INT     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (setting_id, department_name)
);

CREATE INDEX idx_bi_dept_targets_setting ON bi_department_targets(setting_id);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE bi_annual_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE bi_overhead_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE bi_department_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bi_annual_settings_company_isolation" ON bi_annual_settings
  USING (company_id = auth_company_id());
CREATE POLICY "bi_annual_settings_insert" ON bi_annual_settings
  FOR INSERT WITH CHECK (company_id = auth_company_id());
CREATE POLICY "bi_annual_settings_update" ON bi_annual_settings
  FOR UPDATE USING (company_id = auth_company_id());
CREATE POLICY "bi_annual_settings_delete" ON bi_annual_settings
  FOR DELETE USING (company_id = auth_company_id());

CREATE POLICY "bi_overhead_items_company_isolation" ON bi_overhead_items
  USING (company_id = auth_company_id());
CREATE POLICY "bi_overhead_items_insert" ON bi_overhead_items
  FOR INSERT WITH CHECK (company_id = auth_company_id());
CREATE POLICY "bi_overhead_items_update" ON bi_overhead_items
  FOR UPDATE USING (company_id = auth_company_id());
CREATE POLICY "bi_overhead_items_delete" ON bi_overhead_items
  FOR DELETE USING (company_id = auth_company_id());

CREATE POLICY "bi_dept_targets_company_isolation" ON bi_department_targets
  USING (company_id = auth_company_id());
CREATE POLICY "bi_dept_targets_insert" ON bi_department_targets
  FOR INSERT WITH CHECK (company_id = auth_company_id());
CREATE POLICY "bi_dept_targets_update" ON bi_department_targets
  FOR UPDATE USING (company_id = auth_company_id());
CREATE POLICY "bi_dept_targets_delete" ON bi_department_targets
  FOR DELETE USING (company_id = auth_company_id());
