-- One-click app integrations (Chatwork, Slack, etc.)

CREATE TABLE IF NOT EXISTS app_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('chatwork', 'slack')),
  credentials JSONB NOT NULL DEFAULT '{}',
  settings JSONB NOT NULL DEFAULT '{}',
  events TEXT[] NOT NULL DEFAULT ARRAY[
    'customer.created',
    'deal.created',
    'deal.stage_changed'
  ]::TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  connected_at TIMESTAMPTZ,
  last_notified_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, provider)
);

CREATE INDEX idx_app_integrations_company ON app_integrations(company_id);

ALTER TABLE app_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company admins manage app_integrations" ON app_integrations;
CREATE POLICY "company admins manage app_integrations"
  ON app_integrations FOR ALL
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'hq_admin')))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'hq_admin')));
