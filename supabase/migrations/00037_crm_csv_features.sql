-- CSV要件（建築CRM シート1）向けスキーマ拡張

-- EIGHT-ID: 会社内一意
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_eight_id
  ON customers(company_id, eight_id)
  WHERE eight_id IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE deals ADD COLUMN IF NOT EXISTS summary TEXT;

ALTER TABLE craftsmen
  ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS service_areas TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS contract_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS payment_notes TEXT;

CREATE TABLE IF NOT EXISTS craftsman_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  craftsman_id UUID NOT NULL REFERENCES craftsmen(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('scheduled','paid')) DEFAULT 'scheduled',
  due_date DATE,
  paid_at TIMESTAMPTZ,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_craftsman_payments_craftsman ON craftsman_payments(craftsman_id);

CREATE TABLE IF NOT EXISTS customer_recordings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT '商談録音',
  transcript TEXT DEFAULT '',
  summary TEXT DEFAULT '',
  memo TEXT DEFAULT '',
  duration_seconds INT DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('recording','completed')) DEFAULT 'completed',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_recordings_customer ON customer_recordings(customer_id);

CREATE TABLE IF NOT EXISTS customer_scheduling_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  meeting_type TEXT NOT NULL CHECK (meeting_type IN ('in_person','online','phone')) DEFAULT 'in_person',
  time_slot TEXT NOT NULL CHECK (time_slot IN ('morning','afternoon','evening','anytime')) DEFAULT 'anytime',
  duration_minutes INT NOT NULL DEFAULT 60,
  candidate_dates JSONB DEFAULT '[]',
  ai_optimized BOOLEAN DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contract_communications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('line','slack','email')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')) DEFAULT 'inbound',
  sender_name TEXT,
  body TEXT NOT NULL,
  is_important BOOLEAN DEFAULT FALSE,
  agreement_status TEXT CHECK (agreement_status IN ('pending','addressed')) DEFAULT 'pending',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contract_post_sign_info (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  value TEXT,
  category TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partner_access_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  construction_id UUID REFERENCES constructions(id) ON DELETE CASCADE,
  contractor_order_id UUID,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ロール拡張（CSV 37–43）
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'hq_admin', 'contractor_admin', 'employee',
    'admin', 'executive', 'sales', 'field_manager', 'designer', 'administration', 'external_partner'
  ));

-- RLS
ALTER TABLE craftsman_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_scheduling_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_post_sign_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_access_tokens ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'craftsman_payments','customer_recordings','customer_scheduling_requests',
    'contract_communications','contract_post_sign_info','partner_access_tokens'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_company', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()))',
      t || '_company', t
    );
  END LOOP;
END $$;
