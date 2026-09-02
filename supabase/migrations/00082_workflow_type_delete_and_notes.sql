-- ワークフロー種別削除時に申請を残す（type_id を NULL へ）
ALTER TABLE workflow_requests
  ALTER COLUMN type_id DROP NOT NULL;

ALTER TABLE workflow_requests
  DROP CONSTRAINT IF EXISTS workflow_requests_type_id_fkey;

ALTER TABLE workflow_requests
  ADD CONSTRAINT workflow_requests_type_id_fkey
  FOREIGN KEY (type_id) REFERENCES workflow_types(id) ON DELETE SET NULL;
