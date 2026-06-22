-- ============================================================
-- 00050: 工事日報テーブル
-- ============================================================

CREATE TABLE IF NOT EXISTS construction_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  construction_id UUID NOT NULL REFERENCES constructions(id) ON DELETE CASCADE,
  author_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  report_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  title         TEXT NOT NULL DEFAULT '',
  weather       TEXT NOT NULL DEFAULT '晴れ',
  content       TEXT NOT NULL DEFAULT '',
  workers_count INT  DEFAULT NULL,
  progress_note TEXT DEFAULT NULL,
  issues        TEXT DEFAULT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_construction_reports_construction
  ON construction_reports(construction_id);

CREATE INDEX IF NOT EXISTS idx_construction_reports_company_date
  ON construction_reports(company_id, report_date DESC);

-- RLS
ALTER TABLE construction_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_members_select_reports"
  ON construction_reports FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "company_members_insert_reports"
  ON construction_reports FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    AND author_id = auth.uid()
  );

CREATE POLICY "author_or_admin_update_reports"
  ON construction_reports FOR UPDATE
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND company_id = construction_reports.company_id
        AND role IN ('hq_admin', 'contractor_admin')
    )
  );

CREATE POLICY "author_or_admin_delete_reports"
  ON construction_reports FOR DELETE
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND company_id = construction_reports.company_id
        AND role IN ('hq_admin', 'contractor_admin')
    )
  );
