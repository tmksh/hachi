-- 全銀フォーマット用: 業者の銀行コード・支店コード・カナ名

ALTER TABLE craftsmen
  ADD COLUMN IF NOT EXISTS bank_code TEXT,
  ADD COLUMN IF NOT EXISTS bank_name_kana TEXT,
  ADD COLUMN IF NOT EXISTS bank_branch_code TEXT,
  ADD COLUMN IF NOT EXISTS bank_branch_kana TEXT;
