-- 営業フロー（1-1〜1-7）連携: エンティティ紐付け・承認・CloudSign・ステージ提案

-- 見積: 商談紐付け・上長承認
ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_status TEXT CHECK (
    approval_status IN ('none', 'pending', 'approved', 'conditional', 'rejected', 'returned')
  ) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS workflow_request_id UUID REFERENCES workflow_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_estimates_deal ON estimates(deal_id);
CREATE INDEX IF NOT EXISTS idx_estimates_approval ON estimates(company_id, approval_status);

-- 工事: 商談・見積紐付け
ALTER TABLE constructions
  ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estimate_id UUID REFERENCES estimates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_constructions_deal ON constructions(deal_id);

-- 契約: 商談紐付け・CloudSign連携
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cloudsign_document_id TEXT,
  ADD COLUMN IF NOT EXISTS cloudsign_status TEXT,
  ADD COLUMN IF NOT EXISTS cloudsign_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cloudsign_signed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contracts_deal ON contracts(deal_id);
CREATE INDEX IF NOT EXISTS idx_contracts_cloudsign ON contracts(cloudsign_document_id) WHERE cloudsign_document_id IS NOT NULL;

-- 商談ステージ変更提案（1-3: Linq提案 → 人レビュー）
CREATE TABLE IF NOT EXISTS deal_stage_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  recording_id UUID REFERENCES customer_recordings(id) ON DELETE SET NULL,
  current_stage TEXT NOT NULL,
  proposed_stage TEXT NOT NULL,
  reason TEXT,
  confidence NUMERIC,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'modified')) DEFAULT 'pending',
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  final_stage TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_stage_proposals_pending
  ON deal_stage_proposals(company_id, status) WHERE status = 'pending';

ALTER TABLE deal_stage_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_deal_stage_proposals" ON deal_stage_proposals
  FOR SELECT USING (company_id = auth_company_id());
CREATE POLICY "tenant_insert_deal_stage_proposals" ON deal_stage_proposals
  FOR INSERT WITH CHECK (company_id = auth_company_id());
CREATE POLICY "tenant_update_deal_stage_proposals" ON deal_stage_proposals
  FOR UPDATE USING (company_id = auth_company_id());

-- 見積承認用ワークフロー種別（規定粗利未達）
INSERT INTO workflow_types (company_id, key, name, description, sort_order, approval_route)
SELECT c.id, 'estimate_margin', '規定粗利未達見積承認', '営業フロー 1-4/1-5', 5, '[]'::jsonb
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM workflow_types wt WHERE wt.company_id = c.id AND wt.key = 'estimate_margin'
);
