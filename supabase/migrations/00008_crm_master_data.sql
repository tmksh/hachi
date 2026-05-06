-- ============================================
-- 00008: CRM マスタデータ
-- 商談ステージ / 失注理由 / 紹介元区分 / 顧客タグ
-- ============================================

-- ── 1. マスタテーブル作成 ──────────────────

-- 商談ステージ（会社ごとにカスタマイズ可能）
CREATE TABLE IF NOT EXISTS deal_stages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  label       TEXT NOT NULL,
  color       TEXT DEFAULT '#6B7280',
  sort_order  INT  NOT NULL DEFAULT 0,
  is_won      BOOLEAN DEFAULT FALSE,
  is_lost     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, key)
);

CREATE INDEX IF NOT EXISTS idx_deal_stages_company ON deal_stages(company_id, sort_order);

-- 失注理由
CREATE TABLE IF NOT EXISTS lost_reasons (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  sort_order  INT  NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, label)
);

-- 紹介元区分（リードソース）
CREATE TABLE IF NOT EXISTS lead_sources (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  sort_order  INT  NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, label)
);

-- 顧客タグマスタ
CREATE TABLE IF NOT EXISTS customer_tag_masters (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  color       TEXT DEFAULT '#6B7280',
  sort_order  INT  NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, label)
);

-- ── 2. deals.stage の CHECK 制約を外してフリーテキスト化 ──
ALTER TABLE deals
  DROP CONSTRAINT IF EXISTS deals_stage_check;

-- lost_reason 列を deals に追加
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS lost_reason TEXT;

-- ── 3. RLS ────────────────────────────────

ALTER TABLE deal_stages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE lost_reasons         ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_sources         ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_tag_masters ENABLE ROW LEVEL SECURITY;

-- 同一会社メンバーは閲覧可
CREATE POLICY "company members can view deal_stages"
  ON deal_stages FOR SELECT
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "company members can view lost_reasons"
  ON lost_reasons FOR SELECT
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "company members can view lead_sources"
  ON lead_sources FOR SELECT
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "company members can view customer_tag_masters"
  ON customer_tag_masters FOR SELECT
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- owner/hq_admin のみ編集可
CREATE POLICY "admins can manage deal_stages"
  ON deal_stages FOR ALL
  USING (company_id IN (
    SELECT company_id FROM profiles
    WHERE id = auth.uid() AND role IN ('owner','hq_admin')
  ));

CREATE POLICY "admins can manage lost_reasons"
  ON lost_reasons FOR ALL
  USING (company_id IN (
    SELECT company_id FROM profiles
    WHERE id = auth.uid() AND role IN ('owner','hq_admin')
  ));

CREATE POLICY "admins can manage lead_sources"
  ON lead_sources FOR ALL
  USING (company_id IN (
    SELECT company_id FROM profiles
    WHERE id = auth.uid() AND role IN ('owner','hq_admin')
  ));

CREATE POLICY "admins can manage customer_tag_masters"
  ON customer_tag_masters FOR ALL
  USING (company_id IN (
    SELECT company_id FROM profiles
    WHERE id = auth.uid() AND role IN ('owner','hq_admin')
  ));

-- ── 4. エイトデザイン株式会社 マスタデータ投入 ──────────

DO $$
DECLARE
  v_company_id UUID;
BEGIN
  SELECT id INTO v_company_id FROM companies WHERE name = 'エイトデザイン株式会社' LIMIT 1;
  IF v_company_id IS NULL THEN
    RAISE NOTICE 'エイトデザイン株式会社 not found, skipping seed';
    RETURN;
  END IF;

  -- 商談ステージ（7段階）
  INSERT INTO deal_stages (company_id, key, label, color, sort_order, is_won, is_lost) VALUES
    (v_company_id, 'lead',          'リード',         '#6B7280', 0, FALSE, FALSE),
    (v_company_id, 'negotiating',   '商談中',         '#3B82F6', 1, FALSE, FALSE),
    (v_company_id, 'school',        'スクール入学',   '#8B5CF6', 2, FALSE, FALSE),
    (v_company_id, 'presentation',  'プレゼン契約',   '#F59E0B', 3, FALSE, FALSE),
    (v_company_id, 'construction',  '着工',           '#10B981', 4, FALSE, FALSE),
    (v_company_id, 'delivered',     '引き渡し済み',   '#0F5132', 5, TRUE,  FALSE),
    (v_company_id, 'lost',          '失注',           '#EF4444', 6, FALSE, TRUE)
  ON CONFLICT (company_id, key) DO UPDATE
    SET label = EXCLUDED.label, color = EXCLUDED.color,
        sort_order = EXCLUDED.sort_order, is_won = EXCLUDED.is_won, is_lost = EXCLUDED.is_lost;

  -- 失注理由（13項目）
  INSERT INTO lost_reasons (company_id, label, sort_order) VALUES
    (v_company_id, '他社',           0),
    (v_company_id, '予算乖離',       1),
    (v_company_id, '時期合わず',     2),
    (v_company_id, '対応不可エリア', 3),
    (v_company_id, '理由不明',       4),
    (v_company_id, 'クレーム',       5),
    (v_company_id, '価値観合わず',   6),
    (v_company_id, '具体性なし',     7),
    (v_company_id, '融資不可',       8),
    (v_company_id, '長期検討',       9),
    (v_company_id, '親反対',         10),
    (v_company_id, '第三者反対',     11),
    (v_company_id, '物件に難あり',   12)
  ON CONFLICT (company_id, label) DO NOTHING;

  -- 紹介元区分
  INSERT INTO lead_sources (company_id, label, sort_order) VALUES
    (v_company_id, '検索',         0),
    (v_company_id, 'Facebook',     1),
    (v_company_id, 'Instagram',    2),
    (v_company_id, 'HP',           3),
    (v_company_id, '紹介',         4),
    (v_company_id, '展示会',       5),
    (v_company_id, 'OB紹介',       6),
    (v_company_id, 'チラシ',       7),
    (v_company_id, 'その他',       8)
  ON CONFLICT (company_id, label) DO NOTHING;

  -- 顧客タグマスタ（備考：リノベ・新築・カフェ利用者・イベント参加者など混在）
  INSERT INTO customer_tag_masters (company_id, label, sort_order) VALUES
    (v_company_id, 'リノベーション',   0),
    (v_company_id, '新築',             1),
    (v_company_id, 'カフェ利用者',     2),
    (v_company_id, 'イベント参加者',   3),
    (v_company_id, 'VIP',              4),
    (v_company_id, 'メルマガ購読',     5),
    (v_company_id, '訪問希望',         6),
    (v_company_id, '来場済',           7),
    (v_company_id, 'OB顧客',           8),
    (v_company_id, '長期検討',         9),
    (v_company_id, '物件オーナー',     10),
    (v_company_id, '解決済',           11)
  ON CONFLICT (company_id, label) DO NOTHING;

END $$;
