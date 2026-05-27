-- 顧客記入画面用フィールド
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS eight_id TEXT,
  ADD COLUMN IF NOT EXISTS customer_type TEXT DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS age INT,
  ADD COLUMN IF NOT EXISTS inquiry_category TEXT,
  ADD COLUMN IF NOT EXISTS inquiry_date DATE,
  ADD COLUMN IF NOT EXISTS inquiry_content TEXT,
  ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
