-- 運営管理の API 利用集計用。テナントは自社分のみ INSERT 可。SELECT は service_role（運営）向け。
CREATE TABLE IF NOT EXISTS ai_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'linq',
  provider TEXT,
  model TEXT,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_usage_events_company_created_idx
  ON ai_usage_events (company_id, created_at DESC);

ALTER TABLE ai_usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_usage_events_insert_own ON ai_usage_events;
CREATE POLICY ai_usage_events_insert_own
  ON ai_usage_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  );
