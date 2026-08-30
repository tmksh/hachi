-- 発注書の CloudSign 受け書（No.108 / 117）
-- 署名完了 webhook で contractor_orders.concluded_at を更新するために文書IDを保持する。

ALTER TABLE contractor_orders
  ADD COLUMN IF NOT EXISTS cloudsign_document_id TEXT;

CREATE INDEX IF NOT EXISTS idx_contractor_orders_cloudsign
  ON contractor_orders(cloudsign_document_id)
  WHERE cloudsign_document_id IS NOT NULL;
