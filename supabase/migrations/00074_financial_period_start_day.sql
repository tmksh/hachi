-- ============================================
-- 決算書: 期間の期首日設定（No.104）
--   例: エイトデザインは 3/21〜翌3/20
-- ============================================

ALTER TABLE financial_report_settings
  ADD COLUMN IF NOT EXISTS period_start_day INT NOT NULL DEFAULT 1
  CHECK (period_start_day BETWEEN 1 AND 28);

COMMENT ON COLUMN financial_report_settings.period_start_day IS
  '決算期の期首日（1〜28）。月末開始でない会社向け（No.104）。例: 21 → 3/21〜翌3/20';
