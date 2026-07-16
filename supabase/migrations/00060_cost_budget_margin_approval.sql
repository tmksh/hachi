-- 実行予算（工事台帳）の粗利承認: 見積と同様に「会社指定粗利＋予備費」未達なら上長承認。
ALTER TABLE construction_cost_budgets
  ADD COLUMN IF NOT EXISTS approval_status TEXT CHECK (
    approval_status IN ('none', 'pending', 'approved', 'conditional', 'rejected', 'returned')
  ) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS workflow_request_id UUID REFERENCES workflow_requests(id);

COMMENT ON COLUMN construction_cost_budgets.approval_status IS '実行予算の粗利承認状態';
COMMENT ON COLUMN construction_cost_budgets.workflow_request_id IS '粗利未達承認ワークフローの申請ID';

-- ワークフロー種別（会社ごと）: 実行予算の粗利未達承認
INSERT INTO workflow_types (company_id, key, name, description, fields_schema, approval_route, sort_order)
SELECT c.id, 'budget_margin', '規定粗利未達 実行予算承認', '実行予算で会社指定粗利＋予備費に達しない場合の上長承認', '[]'::jsonb, '[]'::jsonb, 0
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM workflow_types wt WHERE wt.company_id = c.id AND wt.key = 'budget_margin'
);
