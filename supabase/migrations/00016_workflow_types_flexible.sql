-- workflow_types の key CHECK 制約を削除してフリーテキストに変更
ALTER TABLE workflow_types
  DROP CONSTRAINT IF EXISTS workflow_types_key_check;

-- 種別説明・カスタムフィールド定義・承認ルート・期限日数を追加
ALTER TABLE workflow_types
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS fields_schema JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS approval_route JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS deadline_days INTEGER,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
