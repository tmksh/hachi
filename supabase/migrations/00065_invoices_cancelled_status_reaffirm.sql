-- =========================================================
-- invoices.status に cancelled を再保証
--   本番で 00017 未適用だと入金済み→キャンセルが CHECK で失敗する
-- =========================================================

ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_status_check
    CHECK (status IN ('draft', 'sent', 'paid', 'cancelled'));

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
