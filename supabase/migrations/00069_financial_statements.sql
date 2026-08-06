-- ============================================
-- 決算書（財務諸表）機能: 顧客要望 No.85〜104
--   - financial_account_items    勘定科目マスタ（No.87）
--   - financial_statements       決算書本体（No.85/93/104）
--   - financial_statement_lines  決算書明細行（No.88/89）
--   - financial_report_settings  会社別の表示設定（No.101 実績列見出し）
-- ============================================

-- ── 勘定科目マスタ（No.87） ────────────────────────────────────────
-- 3階層構造: 区分(section) → 科目(行) → 合計行はアプリ側で自動計算（保存しない）。
-- 人件費は cogs(labor) と sga のどちらにも科目として登録できる（No.98 振分検討への布石）。
CREATE TABLE financial_account_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  section       TEXT NOT NULL CHECK (section IN (
    'revenue',                -- 売上高
    'cogs',                   -- 売上原価（製造原価報告書 No.90）
    'sga',                    -- 販売費及び一般管理費
    'non_operating_income',   -- 営業外収益
    'non_operating_expense'   -- 営業外費用
  )),
  -- 売上原価のサブ区分（No.90: 材料費/労務費/外注費/製造経費）。cogs 以外は NULL。
  cogs_category TEXT CHECK (cogs_category IN ('material', 'labor', 'outsourcing', 'expense')),
  name          TEXT NOT NULL,
  sort_order    INT  NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT financial_account_items_cogs_category_consistency CHECK (
    (section = 'cogs' AND cogs_category IS NOT NULL)
    OR (section <> 'cogs' AND cogs_category IS NULL)
  )
);

CREATE INDEX idx_financial_account_items_company ON financial_account_items(company_id);

COMMENT ON TABLE financial_account_items IS '決算書の勘定科目マスタ（テナント別・No.87）。標準的な建設業PLのデフォルト科目はアプリ側で初回自動seed';
COMMENT ON COLUMN financial_account_items.section IS 'PL区分: revenue=売上高 / cogs=売上原価 / sga=販管費 / non_operating_income=営業外収益 / non_operating_expense=営業外費用';
COMMENT ON COLUMN financial_account_items.cogs_category IS '製造原価報告書のサブ区分（No.90）: material=材料費 / labor=労務費 / outsourcing=外注費 / expense=製造経費。cogs のみ必須';

-- ── 決算書本体（No.85/93/104） ─────────────────────────────────────
CREATE TABLE financial_statements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  fiscal_year   INT  NOT NULL,                      -- 決算期の開始年（西暦）
  start_month   INT  NOT NULL CHECK (start_month BETWEEN 1 AND 12), -- 決算期の開始月
  period_label  TEXT NOT NULL,                      -- 自動生成ラベル（例: 2025年8月〜2026年7月期）手入力禁止（No.104）
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final')),
  finalized_at  TIMESTAMPTZ,
  created_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, fiscal_year, start_month)
);

CREATE INDEX idx_financial_statements_company ON financial_statements(company_id, fiscal_year);

COMMENT ON TABLE financial_statements IS '決算書（PL 1枚構成・No.86）。段階利益は保存せずアプリ側で自動計算（No.89）';
COMMENT ON COLUMN financial_statements.period_label IS '対象期間の自動生成ラベル。開始月・年度から生成し手入力禁止（No.104）';
COMMENT ON COLUMN financial_statements.status IS 'draft=作成中 / final=確定（確定分はBIから参照可能・No.95）';

-- ── 決算書明細行（No.88/96） ───────────────────────────────────────
-- 列構成: 当期予算 / 当期実績 / 前期実績 / 差異理由・備考。
-- 構成比・前期比・段階利益（売上総利益等）は保存せず計算で出す（No.89）。
CREATE TABLE financial_statement_lines (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  statement_id         UUID NOT NULL REFERENCES financial_statements(id) ON DELETE CASCADE,
  account_item_id      UUID NOT NULL REFERENCES financial_account_items(id) ON DELETE CASCADE,
  budget_amount        NUMERIC NOT NULL DEFAULT 0,  -- 当期予算（予算は決算書に統合・No.96）
  actual_amount        NUMERIC NOT NULL DEFAULT 0,  -- 当期実績
  prior_actual_amount  NUMERIC NOT NULL DEFAULT 0,  -- 前期実績
  variance_note        TEXT,                        -- 差異理由・備考
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (statement_id, account_item_id)
);

CREATE INDEX idx_financial_statement_lines_statement ON financial_statement_lines(statement_id);
CREATE INDEX idx_financial_statement_lines_company ON financial_statement_lines(company_id);

COMMENT ON TABLE financial_statement_lines IS '決算書の明細行（勘定科目ごと）。合計・段階利益はアプリ側で自動計算';

-- ── 会社別の決算書表示設定（No.101） ───────────────────────────────
CREATE TABLE financial_report_settings (
  company_id           UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  actual_column_label  TEXT NOT NULL DEFAULT '当期実績',  -- 例: 実績（弥生）/ 実績（freee）
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE financial_report_settings IS '決算書画面の会社別設定（No.101: 実績列の見出しラベル等）';

-- ============================================
-- RLS（既存パターン: company_id = auth_company_id()）
-- ============================================
ALTER TABLE financial_account_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_statements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_statement_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_report_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_account_items_company_isolation" ON financial_account_items
  USING (company_id = auth_company_id());
CREATE POLICY "financial_account_items_insert" ON financial_account_items
  FOR INSERT WITH CHECK (company_id = auth_company_id());
CREATE POLICY "financial_account_items_update" ON financial_account_items
  FOR UPDATE USING (company_id = auth_company_id());
CREATE POLICY "financial_account_items_delete" ON financial_account_items
  FOR DELETE USING (company_id = auth_company_id());

CREATE POLICY "financial_statements_company_isolation" ON financial_statements
  USING (company_id = auth_company_id());
CREATE POLICY "financial_statements_insert" ON financial_statements
  FOR INSERT WITH CHECK (company_id = auth_company_id());
CREATE POLICY "financial_statements_update" ON financial_statements
  FOR UPDATE USING (company_id = auth_company_id());
CREATE POLICY "financial_statements_delete" ON financial_statements
  FOR DELETE USING (company_id = auth_company_id());

CREATE POLICY "financial_statement_lines_company_isolation" ON financial_statement_lines
  USING (company_id = auth_company_id());
CREATE POLICY "financial_statement_lines_insert" ON financial_statement_lines
  FOR INSERT WITH CHECK (company_id = auth_company_id());
CREATE POLICY "financial_statement_lines_update" ON financial_statement_lines
  FOR UPDATE USING (company_id = auth_company_id());
CREATE POLICY "financial_statement_lines_delete" ON financial_statement_lines
  FOR DELETE USING (company_id = auth_company_id());

CREATE POLICY "financial_report_settings_company_isolation" ON financial_report_settings
  USING (company_id = auth_company_id());
CREATE POLICY "financial_report_settings_insert" ON financial_report_settings
  FOR INSERT WITH CHECK (company_id = auth_company_id());
CREATE POLICY "financial_report_settings_update" ON financial_report_settings
  FOR UPDATE USING (company_id = auth_company_id());
CREATE POLICY "financial_report_settings_delete" ON financial_report_settings
  FOR DELETE USING (company_id = auth_company_id());
