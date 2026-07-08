-- 顧客の見込度（A/B/C）。確度%は会社ごとに bi_company_config.config.prospect_grade_rates で設定
ALTER TABLE customers ADD COLUMN IF NOT EXISTS prospect_grade TEXT CHECK (prospect_grade IN ('A', 'B', 'C'));

COMMENT ON COLUMN customers.prospect_grade IS '見込度 A/B/C（確度%は会社別設定）';
