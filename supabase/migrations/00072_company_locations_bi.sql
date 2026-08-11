-- No.80: 部門軸 × 拠点軸
-- 売上・原価は部門別（既存 department_name）、販管費は拠点別に積む。
-- 拠点カード表示のため工事にも location_id を持ち、拠点別の売上・粗利を集計可能にする。

CREATE TABLE IF NOT EXISTS company_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_company_locations_company
  ON company_locations(company_id, sort_order);

COMMENT ON TABLE company_locations IS '会社の拠点マスタ（No.80）。販管費予算・工事の拠点軸に使用';

ALTER TABLE company_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_company_locations" ON company_locations
  FOR SELECT USING (company_id = auth_company_id());
CREATE POLICY "tenant_insert_company_locations" ON company_locations
  FOR INSERT WITH CHECK (company_id = auth_company_id());
CREATE POLICY "tenant_update_company_locations" ON company_locations
  FOR UPDATE USING (company_id = auth_company_id());
CREATE POLICY "tenant_delete_company_locations" ON company_locations
  FOR DELETE USING (
    company_id = auth_company_id()
    AND auth_role() IN ('hq_admin', 'admin', 'contractor_admin')
  );

-- 年度設定に紐づく拠点別目標（売上目標）と販管費予算
CREATE TABLE IF NOT EXISTS bi_location_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  setting_id UUID NOT NULL REFERENCES bi_annual_settings(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES company_locations(id) ON DELETE CASCADE,
  target_revenue NUMERIC NOT NULL DEFAULT 0,
  sga_budget NUMERIC NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (setting_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_bi_location_targets_setting
  ON bi_location_targets(setting_id, sort_order);

COMMENT ON TABLE bi_location_targets IS '拠点別の売上目標・販管費予算（No.80）。販管費は拠点軸で積む';
COMMENT ON COLUMN bi_location_targets.sga_budget IS '拠点別販管費予算（万円）。全社 sga_budget と併存し、拠点ビューではこちらを優先';

ALTER TABLE bi_location_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_bi_location_targets" ON bi_location_targets
  FOR SELECT USING (company_id = auth_company_id());
CREATE POLICY "tenant_insert_bi_location_targets" ON bi_location_targets
  FOR INSERT WITH CHECK (company_id = auth_company_id());
CREATE POLICY "tenant_update_bi_location_targets" ON bi_location_targets
  FOR UPDATE USING (company_id = auth_company_id());
CREATE POLICY "tenant_delete_bi_location_targets" ON bi_location_targets
  FOR DELETE USING (company_id = auth_company_id());

-- 工事に拠点を紐づけ（拠点別売上・粗利・PJ一覧）
ALTER TABLE constructions
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES company_locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_constructions_location_id
  ON constructions(company_id, location_id);

COMMENT ON COLUMN constructions.location_id IS '担当拠点（No.80）。拠点別BI集計・PJ一覧に使用';
