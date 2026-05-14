-- email_accounts に IMAP / M365 / 手動フォワード 用カラムを追加
ALTER TABLE email_accounts
  ADD COLUMN IF NOT EXISTS imap_host TEXT,
  ADD COLUMN IF NOT EXISTS imap_port INTEGER,
  ADD COLUMN IF NOT EXISTS imap_username TEXT,
  ADD COLUMN IF NOT EXISTS imap_password_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS smtp_host TEXT,
  ADD COLUMN IF NOT EXISTS smtp_port INTEGER,
  ADD COLUMN IF NOT EXISTS smtp_username TEXT,
  ADD COLUMN IF NOT EXISTS smtp_password_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS forward_address TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- provider に m365 / imap / forward を許容するよう制約を更新
-- (既存の CHECK 制約があれば削除して再作成)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'email_accounts_provider_check'
  ) THEN
    ALTER TABLE email_accounts DROP CONSTRAINT email_accounts_provider_check;
  END IF;
END $$;

ALTER TABLE email_accounts
  ADD CONSTRAINT email_accounts_provider_check
  CHECK (provider IN ('gmail', 'imap', 'forward'));
