-- invoices に notes 追加と cancelled ステータス対応
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft','sent','paid','cancelled'));
