-- 見積書の作成者名（自由入力テキスト）を追加
-- profiles.assigned_to に縛られず、外部担当者や入力時の任意名を保存できるようにする

ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS created_by_name TEXT;

COMMENT ON COLUMN estimates.created_by_name IS '見積書の作成者名（自由入力。profiles.assigned_to と独立）';
