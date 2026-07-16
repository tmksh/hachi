-- 特需（大型案件）: 一律の見込度A/B/C確度ではなく、案件独自の確度%を使う
-- ※ 00059 で取り消し済み。履歴整合のためファイルのみ保持。
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS is_special_demand BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS special_probability NUMERIC
  CHECK (special_probability IS NULL OR (special_probability >= 0 AND special_probability <= 100));

COMMENT ON COLUMN customers.is_special_demand IS '特需（大型案件）。trueの場合はA/B/C一律確度ではなく special_probability を使用';
COMMENT ON COLUMN customers.special_probability IS '特需案件の独自確度%（0〜100）';

CREATE INDEX IF NOT EXISTS idx_customers_special_demand
  ON customers (company_id, is_special_demand)
  WHERE deleted_at IS NULL AND is_special_demand = true;
