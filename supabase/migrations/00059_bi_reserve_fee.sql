-- 予備費（非表示%）: 会社が指定する売上に対する隠しバッファ。
-- 管理者のみ設定でき、通常はBI上で利益から控除して保守表示、決算で利益に戻す。
ALTER TABLE bi_annual_settings
  ADD COLUMN IF NOT EXISTS reserve_fee_rate NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reserve_released BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reserve_released_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reserve_released_by UUID REFERENCES profiles(id);

COMMENT ON COLUMN bi_annual_settings.reserve_fee_rate IS '予備費率（0〜1）。売上に対して抜く非表示バッファ。管理者のみ設定';
COMMENT ON COLUMN bi_annual_settings.reserve_released IS '決算で予備費を利益に戻したか（true=戻し済み）';
COMMENT ON COLUMN bi_annual_settings.reserve_released_at IS '予備費を利益に戻した日時';
COMMENT ON COLUMN bi_annual_settings.reserve_released_by IS '予備費を戻した操作者';
