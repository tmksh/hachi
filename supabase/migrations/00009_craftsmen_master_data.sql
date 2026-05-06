-- ============================================
-- 00009: 職人マスタデータ
-- 職種区分 / 資格 / 契約形態
-- ============================================

-- ── 1. マスタテーブル作成 ──────────────────

-- 職種区分（会社ごとにカスタマイズ可能）
CREATE TABLE IF NOT EXISTS craftsmen_specialties (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  sort_order  INT  NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, label)
);

CREATE INDEX IF NOT EXISTS idx_craftsmen_specialties_company ON craftsmen_specialties(company_id, sort_order);

-- 資格マスタ
CREATE TABLE IF NOT EXISTS craftsmen_qualifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  sort_order  INT  NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, label)
);

-- ── 2. craftsmen.specialty の CHECK 制約を外してフリーテキスト化 ──
ALTER TABLE craftsmen
  DROP CONSTRAINT IF EXISTS craftsmen_specialty_check;

-- ── 3. RLS ────────────────────────────────

ALTER TABLE craftsmen_specialties    ENABLE ROW LEVEL SECURITY;
ALTER TABLE craftsmen_qualifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company members can view craftsmen_specialties"
  ON craftsmen_specialties FOR SELECT
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "admins can manage craftsmen_specialties"
  ON craftsmen_specialties FOR ALL
  USING (company_id IN (
    SELECT company_id FROM profiles
    WHERE id = auth.uid() AND role IN ('owner','hq_admin')
  ));

CREATE POLICY "company members can view craftsmen_qualifications"
  ON craftsmen_qualifications FOR SELECT
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "admins can manage craftsmen_qualifications"
  ON craftsmen_qualifications FOR ALL
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

  -- 職種区分（13種）
  INSERT INTO craftsmen_specialties (company_id, label, sort_order) VALUES
    (v_company_id, 'とび・土工',   0),
    (v_company_id, '大工',         1),
    (v_company_id, '鉄筋・型枠',   2),
    (v_company_id, '左官',         3),
    (v_company_id, '屋根・板金',   4),
    (v_company_id, '外装・防水',   5),
    (v_company_id, '塗装',         6),
    (v_company_id, '内装仕上げ',   7),
    (v_company_id, '電気工事',     8),
    (v_company_id, '管工事（設備）', 9),
    (v_company_id, '外構・造園',   10),
    (v_company_id, '解体',         11),
    (v_company_id, 'その他',       12)
  ON CONFLICT (company_id, label) DO NOTHING;

  -- 資格
  INSERT INTO craftsmen_qualifications (company_id, label, sort_order) VALUES
    (v_company_id, '建築士',           0),
    (v_company_id, '施工管理技士',     1),
    (v_company_id, '電気工事士',       2),
    (v_company_id, '管工事施工管理技士', 3),
    (v_company_id, '足場作業主任者',   4),
    (v_company_id, '玉掛け技能者',     5),
    (v_company_id, '危険物取扱者',     6)
  ON CONFLICT (company_id, label) DO NOTHING;

END $$;
