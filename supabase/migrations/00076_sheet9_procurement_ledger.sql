-- シート9: 発注書の部門・勘定科目、納品〜検収〜業者請求、帳票データ作成

ALTER TABLE contractor_orders
  ADD COLUMN IF NOT EXISTS po_no TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS account_item TEXT,
  ADD COLUMN IF NOT EXISTS account_item_source TEXT,
  ADD COLUMN IF NOT EXISTS ledger_status TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS delivery_date DATE,
  ADD COLUMN IF NOT EXISTS delivery_content TEXT,
  ADD COLUMN IF NOT EXISTS delivery_partial TEXT,
  ADD COLUMN IF NOT EXISTS inspection_result TEXT,
  ADD COLUMN IF NOT EXISTS inspection_date DATE,
  ADD COLUMN IF NOT EXISTS inspection_comment TEXT,
  ADD COLUMN IF NOT EXISTS inspector_name TEXT,
  ADD COLUMN IF NOT EXISTS vendor_invoice_no TEXT,
  ADD COLUMN IF NOT EXISTS vendor_invoice_date DATE,
  ADD COLUMN IF NOT EXISTS vendor_registration_no TEXT,
  ADD COLUMN IF NOT EXISTS vendor_invoice_remarks TEXT,
  ADD COLUMN IF NOT EXISTS vendor_invoice_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS director_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accounting_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invoice_token TEXT,
  ADD COLUMN IF NOT EXISTS invoice_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clouds_sign_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS concluded_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS contractor_orders_invoice_token_uidx
  ON contractor_orders (invoice_token)
  WHERE invoice_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS contractor_orders_ledger_status_idx
  ON contractor_orders (company_id, ledger_status);

CREATE INDEX IF NOT EXISTS contractor_orders_po_no_idx
  ON contractor_orders (company_id, po_no);

ALTER TABLE craftsmen
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_branch TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_type TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_kana TEXT;
