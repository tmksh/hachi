-- 会社指定粗利率（基準粗利率）: 見積・実行予算の承認基準ライン。
-- 承認判定では「会社指定粗利率 ＋ 予備費率」を満たす必要がある。管理者のみ設定。
ALTER TABLE bi_annual_settings
  ADD COLUMN IF NOT EXISTS base_gross_profit_rate NUMERIC NOT NULL DEFAULT 0.5;

COMMENT ON COLUMN bi_annual_settings.base_gross_profit_rate IS '会社指定粗利率（0〜1）。承認の基準ライン。予備費率と合算して判定';
