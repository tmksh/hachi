-- メール: 利用者が自由に作るフォルダ（会社別・請求書など）と、スレッドのフラグ（No.143）
-- フォルダはメール連携と同じく「本人だけ」に見える。

CREATE TABLE IF NOT EXISTS email_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE email_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_folders_select" ON email_folders;
DROP POLICY IF EXISTS "email_folders_insert" ON email_folders;
DROP POLICY IF EXISTS "email_folders_update" ON email_folders;
DROP POLICY IF EXISTS "email_folders_delete" ON email_folders;

CREATE POLICY "email_folders_select" ON email_folders
  FOR SELECT USING (company_id = auth_company_id() AND user_id = auth.uid());
CREATE POLICY "email_folders_insert" ON email_folders
  FOR INSERT WITH CHECK (company_id = auth_company_id() AND user_id = auth.uid());
CREATE POLICY "email_folders_update" ON email_folders
  FOR UPDATE USING (company_id = auth_company_id() AND user_id = auth.uid())
  WITH CHECK (company_id = auth_company_id() AND user_id = auth.uid());
CREATE POLICY "email_folders_delete" ON email_folders
  FOR DELETE USING (company_id = auth_company_id() AND user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_email_folders_user ON email_folders(user_id, sort_order);

ALTER TABLE email_threads
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES email_folders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_email_threads_folder ON email_threads(folder_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_flagged ON email_threads(account_id) WHERE is_flagged;
