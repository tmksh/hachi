-- No.66: 業者マスタに「種別」を追加（vendor=実業者 / system=システム予約）
-- システム予約は「未登録業者」「予備費」の2件をテナントごとに利用する（seedはアプリ側で自動作成）。
ALTER TABLE craftsmen
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'vendor' CHECK (kind IN ('vendor','system')),
  ADD COLUMN IF NOT EXISTS system_key TEXT CHECK (system_key IN ('unregistered','reserve'));

COMMENT ON COLUMN craftsmen.kind IS '種別: vendor=実業者（デフォルト）/ system=システム予約（削除・改名不可）';
COMMENT ON COLUMN craftsmen.system_key IS 'システム予約の識別キー: unregistered=未登録業者 / reserve=予備費。kind=system のときのみ設定';

-- システム予約はテナントごとに1件ずつ
CREATE UNIQUE INDEX IF NOT EXISTS idx_craftsmen_system_key_unique
  ON craftsmen(company_id, system_key)
  WHERE system_key IS NOT NULL AND deleted_at IS NULL;

-- No.70/57: 見積明細行の「発注業者」欄（業者マスタ参照＋表示名）
-- No.61/67: 発注業者に「予備費」（システム予約）を選んだ行は原価のみ・売価0・顧客向けPDF非表示。
--           文字列判定を避けるため、craftsman の種別フラグから導出した is_reserve_row を保持する。
ALTER TABLE estimate_items
  ADD COLUMN IF NOT EXISTS vendor_craftsman_id UUID REFERENCES craftsmen(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vendor_name TEXT,
  ADD COLUMN IF NOT EXISTS is_reserve_row BOOLEAN NOT NULL DEFAULT false,
  -- No.69: テキスト行を2種類に（category_id あり=大項目に紐づく / なし=独立）。既存 is_text_row(00063) を拡張
  ADD COLUMN IF NOT EXISTS text_row_scope TEXT CHECK (text_row_scope IN ('category','standalone'));

COMMENT ON COLUMN estimate_items.vendor_craftsman_id IS '発注業者（業者マスタ craftsmen 参照）。未登録の自由入力は vendor_name のみ';
COMMENT ON COLUMN estimate_items.vendor_name IS '発注業者の表示名（入力時のテキスト）';
COMMENT ON COLUMN estimate_items.is_reserve_row IS '予備費行（発注業者=システム予約「予備費」）。原価のみ入力可・売価0固定・顧客向けPDF非表示。craftsmen.system_key=reserve から導出';
COMMENT ON COLUMN estimate_items.text_row_scope IS 'テキスト行の種類: category=大項目に紐づく / standalone=独立。is_text_row=true のときのみ意味を持つ';

CREATE INDEX IF NOT EXISTS idx_estimate_items_vendor_craftsman ON estimate_items(vendor_craftsman_id);

-- No.70: 大項目（カテゴリ行）にも明細行と同等の入力（形状・摘要、発注業者、数量、単位、原単価、見積単価）
-- No.68: 配下の詳細行に金額があるときは詳細行を優先（UI側で「詳細項目により上書き」表示）
ALTER TABLE estimate_categories
  ADD COLUMN IF NOT EXISTS specification TEXT,
  ADD COLUMN IF NOT EXISTS vendor_craftsman_id UUID REFERENCES craftsmen(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vendor_name TEXT,
  ADD COLUMN IF NOT EXISTS quantity NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit TEXT,
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selling_price NUMERIC NOT NULL DEFAULT 0;

COMMENT ON COLUMN estimate_categories.specification IS '大項目の形状・摘要（直接入力）。配下詳細行がある場合は詳細優先';
COMMENT ON COLUMN estimate_categories.vendor_craftsman_id IS '大項目の発注業者（業者マスタ参照）';
COMMENT ON COLUMN estimate_categories.vendor_name IS '大項目の発注業者表示名';
COMMENT ON COLUMN estimate_categories.quantity IS '大項目の数量（直接入力）';
COMMENT ON COLUMN estimate_categories.unit IS '大項目の単位（直接入力）';
COMMENT ON COLUMN estimate_categories.cost_price IS '大項目の原単価（直接入力）';
COMMENT ON COLUMN estimate_categories.selling_price IS '大項目の見積単価（直接入力）';
