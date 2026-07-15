-- 発注書（contractor_orders）の承認申請フロー用フィールド
ALTER TABLE contractor_orders
  ADD COLUMN IF NOT EXISTS submitted_comment TEXT,
  ADD COLUMN IF NOT EXISTS submitted_to UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
