-- 見積明細: テキスト行（注釈用・売価ゼロ）と、明細外の予備費・予備予備費金額

ALTER TABLE estimate_items
  ADD COLUMN IF NOT EXISTS is_text_row BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN estimate_items.is_text_row IS 'テキスト行（注釈用）。数量×単価の計算を行わず、顧客向け見積PDFには売価ゼロと同様に非出力';

ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS reserve_fee_1_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reserve_fee_2_amount NUMERIC NOT NULL DEFAULT 0;

COMMENT ON COLUMN estimates.reserve_fee_1_amount IS '予備費（会社確保分）金額。明細表の外・サマリー欄で記入';
COMMENT ON COLUMN estimates.reserve_fee_2_amount IS '予備予備費（現場対応分）金額。見積段階は明細外、実行予算移行後は明細側で操作可';
