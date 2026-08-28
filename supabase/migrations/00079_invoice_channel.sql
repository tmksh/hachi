-- 議事録 2026/08/27:
--   自社書式・紙発注の業者は検収完了一覧からPDF添付し「請求書受領」へ進める。
--   紙発注分は色分けで識別する。業者向けログインは設けない（メール認証）。

ALTER TABLE craftsmen
  ADD COLUMN IF NOT EXISTS invoice_channel TEXT NOT NULL DEFAULT 'email';

ALTER TABLE craftsmen
  DROP CONSTRAINT IF EXISTS craftsmen_invoice_channel_check;

ALTER TABLE craftsmen
  ADD CONSTRAINT craftsmen_invoice_channel_check
  CHECK (invoice_channel IN ('email', 'paper'));

COMMENT ON COLUMN craftsmen.invoice_channel IS
  '請求書の受領方法。email=メールのURL（ログイン不要） / paper=紙発注・自社書式（社内PDF添付）';

ALTER TABLE contractor_orders
  ADD COLUMN IF NOT EXISTS vendor_invoice_amount NUMERIC;

COMMENT ON COLUMN contractor_orders.vendor_invoice_amount IS
  '請求書で確認した税抜金額。帳票・全銀はこの数字を使う（未入力時は発注金額）';
