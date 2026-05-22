-- ============================================================
-- document_categories テーブル追加
-- documents.category の CHECK 制約を削除して動的カテゴリ対応
-- ============================================================

-- 1. documents.category の CHECK 制約を削除
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_category_check;

-- 2. document_categories テーブルを作成
CREATE TABLE IF NOT EXISTS document_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, key)
);

CREATE INDEX IF NOT EXISTS idx_document_categories_company ON document_categories(company_id, sort_order);

-- 3. RLS
ALTER TABLE document_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company members can view document_categories" ON document_categories;
CREATE POLICY "company members can view document_categories"
  ON document_categories FOR SELECT
  USING (company_id = auth_company_id());

DROP POLICY IF EXISTS "admins can manage document_categories" ON document_categories;
CREATE POLICY "admins can manage document_categories"
  ON document_categories FOR ALL
  USING (company_id = auth_company_id() AND auth_role() IN ('owner', 'hq_admin'));

-- 4. 既存の全社にデフォルトカテゴリを投入
INSERT INTO document_categories (company_id, key, label, sort_order)
SELECT DISTINCT c.id, v.key, v.label, v.sort_order
FROM companies c
CROSS JOIN (VALUES
  ('rules',      '規程', 0),
  ('hr',         '人事', 1),
  ('accounting', '経理', 2),
  ('safety',     '安全', 3),
  ('other',      'その他', 4)
) AS v(key, label, sort_order)
ON CONFLICT (company_id, key) DO NOTHING;
