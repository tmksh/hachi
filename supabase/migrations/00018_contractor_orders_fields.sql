-- contractor_orders に発注書フォームの追加フィールドを追加
ALTER TABLE contractor_orders
  ADD COLUMN IF NOT EXISTS order_date      DATE,
  ADD COLUMN IF NOT EXISTS start_date      DATE,
  ADD COLUMN IF NOT EXISTS end_date        DATE,
  ADD COLUMN IF NOT EXISTS completion_date DATE,
  ADD COLUMN IF NOT EXISTS payment_date    DATE,
  ADD COLUMN IF NOT EXISTS payment_count   TEXT DEFAULT '1回',
  ADD COLUMN IF NOT EXISTS work_content    TEXT,
  ADD COLUMN IF NOT EXISTS special_notes   TEXT;
