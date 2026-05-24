-- 2026/04/16 デザインレビュー定例: 工事管理機能仕様反映

-- 見積もり: 1工事に複数版対応
ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS construction_id UUID REFERENCES constructions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_estimate_id UUID REFERENCES estimates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reserve_fee_1_rate NUMERIC NOT NULL DEFAULT 0.02,
  ADD COLUMN IF NOT EXISTS reserve_fee_2_rate NUMERIC NOT NULL DEFAULT 0.03,
  ADD COLUMN IF NOT EXISTS default_gross_profit_rate NUMERIC NOT NULL DEFAULT 0.50;

CREATE INDEX IF NOT EXISTS idx_estimates_construction ON estimates(construction_id);

-- 追加変更工事
CREATE TABLE IF NOT EXISTS change_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  construction_id UUID NOT NULL REFERENCES constructions(id) ON DELETE CASCADE,
  estimate_id UUID REFERENCES estimates(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','pending','approved','rejected','sent')) DEFAULT 'draft',
  before_amount NUMERIC NOT NULL DEFAULT 0,
  after_amount NUMERIC NOT NULL DEFAULT 0,
  diff_amount NUMERIC NOT NULL DEFAULT 0,
  before_items JSONB NOT NULL DEFAULT '[]',
  after_items JSONB NOT NULL DEFAULT '[]',
  change_reason TEXT,
  cloudsign_document_id TEXT,
  cloudsign_status TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_change_orders_construction ON change_orders(construction_id);
CREATE INDEX IF NOT EXISTS idx_change_orders_company ON change_orders(company_id);

-- 下請発注: 支払スケジュール（2回/4回割合配分）
ALTER TABLE contractor_orders
  ADD COLUMN IF NOT EXISTS payment_schedule JSONB NOT NULL DEFAULT '[]';

-- RLS
ALTER TABLE change_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_change_orders" ON change_orders
  FOR SELECT USING (company_id = auth_company_id());
CREATE POLICY "tenant_insert_change_orders" ON change_orders
  FOR INSERT WITH CHECK (company_id = auth_company_id());
CREATE POLICY "tenant_update_change_orders" ON change_orders
  FOR UPDATE USING (company_id = auth_company_id());
CREATE POLICY "tenant_delete_change_orders" ON change_orders
  FOR DELETE USING (company_id = auth_company_id());
