-- 予備費②の行（大項目/フロアー）レベル設定
ALTER TABLE estimate_categories
  ADD COLUMN IF NOT EXISTS reserve_fee_rate NUMERIC NOT NULL DEFAULT 0;

COMMENT ON COLUMN estimate_categories.reserve_fee_rate IS '予備費②用の行レベル原価積増し率（0〜1）';
