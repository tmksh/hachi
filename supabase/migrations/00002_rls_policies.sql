-- ============================================
-- BRIDGE / SHINJIDAI - RLS Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE craftsmen ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE constructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Helper function: get current user's company_id
-- ============================================

CREATE OR REPLACE FUNCTION auth_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- Companies: members can view their own company
-- ============================================

CREATE POLICY "company_select" ON companies
  FOR SELECT USING (id = auth_company_id());

-- ============================================
-- Profiles: company-scoped
-- ============================================

CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (company_id = auth_company_id());

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- ============================================
-- Tenant-scoped SELECT for all business tables
-- (Common pattern: company_id = user's company)
-- ============================================

-- Macro for creating tenant-scoped policies
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN VALUES
    ('customers'), ('deals'), ('deal_activities'), ('todos'),
    ('craftsmen'), ('estimates'), ('estimate_categories'),
    ('estimate_items'), ('estimate_documents'),
    ('contracts'), ('constructions'), ('construction_tasks'),
    ('contractor_orders'), ('announcements'), ('announcement_reads'),
    ('announcement_comments'), ('announcement_attachments'),
    ('workflow_types'), ('workflow_requests'), ('workflow_steps'),
    ('workflow_attachments'), ('workflow_comments'),
    ('email_accounts'), ('email_threads'), ('email_messages'),
    ('email_attachments'), ('calendar_events'), ('documents'),
    ('invoices'), ('invoice_items'), ('budgets'), ('budget_items')
  LOOP
    -- SELECT: company-scoped
    EXECUTE format(
      'CREATE POLICY "tenant_select_%1$s" ON %1$I FOR SELECT USING (company_id = auth_company_id())',
      t
    );
    -- INSERT: must set own company_id
    EXECUTE format(
      'CREATE POLICY "tenant_insert_%1$s" ON %1$I FOR INSERT WITH CHECK (company_id = auth_company_id())',
      t
    );
    -- UPDATE: company-scoped
    EXECUTE format(
      'CREATE POLICY "tenant_update_%1$s" ON %1$I FOR UPDATE USING (company_id = auth_company_id())',
      t
    );
    -- DELETE: company-scoped, admin only
    EXECUTE format(
      'CREATE POLICY "tenant_delete_%1$s" ON %1$I FOR DELETE USING (company_id = auth_company_id() AND auth_role() IN (''owner'', ''hq_admin''))',
      t
    );
  END LOOP;
END;
$$;

-- ============================================
-- Attendance: additional employee restrictions
-- ============================================

-- Employee can only see own entries
CREATE POLICY "attendance_employee_select" ON attendance_entries
  FOR SELECT USING (
    company_id = auth_company_id()
    AND (
      user_id = auth.uid()
      OR auth_role() IN ('owner', 'hq_admin')
    )
  );

-- Override the generic tenant_select for attendance
DROP POLICY IF EXISTS "tenant_select_attendance_entries" ON attendance_entries;

-- Employee can only insert own entries
CREATE POLICY "attendance_employee_insert" ON attendance_entries
  FOR INSERT WITH CHECK (
    company_id = auth_company_id()
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "tenant_insert_attendance_entries" ON attendance_entries;

-- ============================================
-- Email: user-scoped within company
-- ============================================

DROP POLICY IF EXISTS "tenant_select_email_accounts" ON email_accounts;
CREATE POLICY "email_accounts_select" ON email_accounts
  FOR SELECT USING (
    company_id = auth_company_id()
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "tenant_insert_email_accounts" ON email_accounts;
CREATE POLICY "email_accounts_insert" ON email_accounts
  FOR INSERT WITH CHECK (
    company_id = auth_company_id()
    AND user_id = auth.uid()
  );
