-- External API keys and Webhook infrastructure (Phase 1 foundation)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['read'],
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_company ON api_keys(company_id);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_endpoints_company ON webhook_endpoints(company_id);

CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  endpoint_id UUID REFERENCES webhook_endpoints(id) ON DELETE SET NULL,
  event TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  response_status INT,
  response_body TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_logs_company ON webhook_logs(company_id);
CREATE INDEX idx_webhook_logs_created ON webhook_logs(created_at DESC);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company admins manage api_keys"
  ON api_keys FOR ALL
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'hq_admin')))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'hq_admin')));

CREATE POLICY "company admins manage webhook_endpoints"
  ON webhook_endpoints FOR ALL
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'hq_admin')))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'hq_admin')));

CREATE POLICY "company admins view webhook_logs"
  ON webhook_logs FOR SELECT
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'hq_admin')));

CREATE POLICY "service role webhook_logs insert"
  ON webhook_logs FOR INSERT
  WITH CHECK (true);
