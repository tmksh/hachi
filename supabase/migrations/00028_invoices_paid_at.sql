-- invoices: 入金日カラム追加（BI 実績集計・Webhook 用）

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

UPDATE invoices
SET paid_at = updated_at
WHERE status = 'paid' AND paid_at IS NULL;
