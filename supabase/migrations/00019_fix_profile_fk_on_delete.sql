-- profiles を参照する FK に ON DELETE ルールを追加する
-- nullable カラム → SET NULL（レコードを残してユーザー参照を外す）
-- NOT NULL かつユーザー固有のレコード → CASCADE（本人データごと削除）
-- NOT NULL だがビジネスレコード → nullable 化 + SET NULL（記録を残す）

-- ── nullable FK → ON DELETE SET NULL ───────────────────────────────────────
ALTER TABLE customers
  DROP CONSTRAINT IF EXISTS customers_assigned_to_fkey,
  ADD CONSTRAINT customers_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE deals
  DROP CONSTRAINT IF EXISTS deals_assigned_to_fkey,
  ADD CONSTRAINT deals_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE deal_activities
  DROP CONSTRAINT IF EXISTS deal_activities_performed_by_fkey,
  ADD CONSTRAINT deal_activities_performed_by_fkey
    FOREIGN KEY (performed_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE todos
  DROP CONSTRAINT IF EXISTS todos_assigned_to_fkey,
  ADD CONSTRAINT todos_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE estimates
  DROP CONSTRAINT IF EXISTS estimates_assigned_to_fkey,
  ADD CONSTRAINT estimates_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE estimate_documents
  DROP CONSTRAINT IF EXISTS estimate_documents_created_by_fkey,
  ADD CONSTRAINT estimate_documents_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE contracts
  DROP CONSTRAINT IF EXISTS contracts_assigned_to_fkey,
  ADD CONSTRAINT contracts_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE constructions
  DROP CONSTRAINT IF EXISTS constructions_assigned_to_fkey,
  ADD CONSTRAINT constructions_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE construction_tasks
  DROP CONSTRAINT IF EXISTS construction_tasks_assigned_to_fkey,
  ADD CONSTRAINT construction_tasks_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE contractor_orders
  DROP CONSTRAINT IF EXISTS contractor_orders_approved_by_fkey,
  ADD CONSTRAINT contractor_orders_approved_by_fkey
    FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE attendance_entries
  DROP CONSTRAINT IF EXISTS attendance_entries_modified_by_fkey,
  ADD CONSTRAINT attendance_entries_modified_by_fkey
    FOREIGN KEY (modified_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_assigned_to_fkey,
  ADD CONSTRAINT calendar_events_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_created_by_fkey,
  ADD CONSTRAINT calendar_events_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE documents
  DROP CONSTRAINT IF EXISTS documents_uploaded_by_fkey,
  ADD CONSTRAINT documents_uploaded_by_fkey
    FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_created_by_fkey,
  ADD CONSTRAINT invoices_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE budgets
  DROP CONSTRAINT IF EXISTS budgets_created_by_fkey,
  ADD CONSTRAINT budgets_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ── ユーザー固有レコード → ON DELETE CASCADE ────────────────────────────────
ALTER TABLE attendance_comments
  DROP CONSTRAINT IF EXISTS attendance_comments_user_id_fkey,
  ADD CONSTRAINT attendance_comments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE announcement_reads
  DROP CONSTRAINT IF EXISTS announcement_reads_user_id_fkey,
  ADD CONSTRAINT announcement_reads_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE announcement_comments
  DROP CONSTRAINT IF EXISTS announcement_comments_user_id_fkey,
  ADD CONSTRAINT announcement_comments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE workflow_comments
  DROP CONSTRAINT IF EXISTS workflow_comments_user_id_fkey,
  ADD CONSTRAINT workflow_comments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE email_accounts
  DROP CONSTRAINT IF EXISTS email_accounts_user_id_fkey,
  ADD CONSTRAINT email_accounts_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ── ビジネスレコードの NOT NULL → nullable + SET NULL ───────────────────────
-- announcements.author_id: お知らせはユーザー削除後も残す
ALTER TABLE announcements
  ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE announcements
  DROP CONSTRAINT IF EXISTS announcements_author_id_fkey,
  ADD CONSTRAINT announcements_author_id_fkey
    FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- workflow_requests.requester_id: 申請はユーザー削除後も記録として残す
ALTER TABLE workflow_requests
  ALTER COLUMN requester_id DROP NOT NULL;
ALTER TABLE workflow_requests
  DROP CONSTRAINT IF EXISTS workflow_requests_requester_id_fkey,
  ADD CONSTRAINT workflow_requests_requester_id_fkey
    FOREIGN KEY (requester_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- workflow_steps.approver_id: 承認ステップはユーザー削除後も残す
ALTER TABLE workflow_steps
  ALTER COLUMN approver_id DROP NOT NULL;
ALTER TABLE workflow_steps
  DROP CONSTRAINT IF EXISTS workflow_steps_approver_id_fkey,
  ADD CONSTRAINT workflow_steps_approver_id_fkey
    FOREIGN KEY (approver_id) REFERENCES profiles(id) ON DELETE SET NULL;
