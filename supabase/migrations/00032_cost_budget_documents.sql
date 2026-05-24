-- 工事台帳（原価管理表）永続化
CREATE TABLE IF NOT EXISTS construction_cost_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  construction_id UUID NOT NULL REFERENCES constructions(id) ON DELETE CASCADE,
  contract_amount NUMERIC NOT NULL DEFAULT 0,
  period_start TEXT NOT NULL DEFAULT '2025-01',
  rows JSONB NOT NULL DEFAULT '[]',
  comments JSONB NOT NULL DEFAULT '[]',
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(construction_id)
);

CREATE INDEX IF NOT EXISTS idx_cost_budgets_construction ON construction_cost_budgets(construction_id);

ALTER TABLE construction_cost_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_select_construction_cost_budgets" ON construction_cost_budgets
  FOR SELECT USING (company_id = auth_company_id());
CREATE POLICY "tenant_insert_construction_cost_budgets" ON construction_cost_budgets
  FOR INSERT WITH CHECK (company_id = auth_company_id());
CREATE POLICY "tenant_update_construction_cost_budgets" ON construction_cost_budgets
  FOR UPDATE USING (company_id = auth_company_id());
CREATE POLICY "tenant_delete_construction_cost_budgets" ON construction_cost_budgets
  FOR DELETE USING (company_id = auth_company_id());

-- 文書: 顧客・工事単位での集約保管
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS construction_id UUID REFERENCES constructions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_customer ON documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_documents_construction ON documents(construction_id);

-- カレンダー: 公開範囲・工事紐付け
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'company'
    CHECK (visibility IN ('personal', 'department', 'company')),
  ADD COLUMN IF NOT EXISTS construction_id UUID REFERENCES constructions(id) ON DELETE SET NULL;
