-- 顧客化前の問い合わせ（リード）受信箱

CREATE TABLE IF NOT EXISTS inbound_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  source TEXT,
  inquiry_category TEXT,
  inquiry_content TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'in_progress', 'converted', 'discarded')),
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbound_leads_company_status
  ON inbound_leads(company_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbound_leads_company_source
  ON inbound_leads(company_id, source);

COMMENT ON TABLE inbound_leads IS '顧客化前の問い合わせ（Web/メール/Instagram/電話など）';

ALTER TABLE inbound_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_inbound_leads" ON inbound_leads
  FOR SELECT USING (company_id = auth_company_id());
CREATE POLICY "tenant_insert_inbound_leads" ON inbound_leads
  FOR INSERT WITH CHECK (company_id = auth_company_id());
CREATE POLICY "tenant_update_inbound_leads" ON inbound_leads
  FOR UPDATE USING (company_id = auth_company_id());
CREATE POLICY "tenant_delete_inbound_leads" ON inbound_leads
  FOR DELETE USING (
    company_id = auth_company_id()
    AND auth_role() IN ('hq_admin', 'admin', 'contractor_admin')
  );
