-- シート9 残り: 納品添付・分納行・業者請求PDF

ALTER TABLE contractor_orders
  ADD COLUMN IF NOT EXISTS delivery_attachments JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS vendor_invoice_pdf_path TEXT,
  ADD COLUMN IF NOT EXISTS parent_order_id UUID REFERENCES contractor_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lot_no INTEGER DEFAULT 1;

CREATE INDEX IF NOT EXISTS contractor_orders_parent_idx
  ON contractor_orders (parent_order_id)
  WHERE parent_order_id IS NOT NULL;
