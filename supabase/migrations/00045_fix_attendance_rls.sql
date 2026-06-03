-- ============================================================
-- attendance_entries RLS 修復（打刻 INSERT/SELECT/UPDATE が拒否される問題）
-- ============================================================

ALTER TABLE attendance_entries ENABLE ROW LEVEL SECURITY;

-- 旧ポリシーをすべて削除して再作成
DROP POLICY IF EXISTS "tenant_select_attendance_entries" ON attendance_entries;
DROP POLICY IF EXISTS "tenant_insert_attendance_entries" ON attendance_entries;
DROP POLICY IF EXISTS "tenant_update_attendance_entries" ON attendance_entries;
DROP POLICY IF EXISTS "tenant_delete_attendance_entries" ON attendance_entries;
DROP POLICY IF EXISTS "attendance_employee_select" ON attendance_entries;
DROP POLICY IF EXISTS "attendance_employee_insert" ON attendance_entries;
DROP POLICY IF EXISTS "attendance_employee_update" ON attendance_entries;
DROP POLICY IF EXISTS "attendance_admin_update" ON attendance_entries;
DROP POLICY IF EXISTS "attendance_admin_delete" ON attendance_entries;

CREATE POLICY "attendance_select" ON attendance_entries
  FOR SELECT USING (
    company_id = auth_company_id()
    AND (
      user_id = auth.uid()
      OR auth_role() IN ('hq_admin', 'contractor_admin')
    )
  );

CREATE POLICY "attendance_insert" ON attendance_entries
  FOR INSERT WITH CHECK (
    company_id = auth_company_id()
    AND user_id = auth.uid()
  );

CREATE POLICY "attendance_update_own" ON attendance_entries
  FOR UPDATE USING (
    company_id = auth_company_id()
    AND user_id = auth.uid()
  );

CREATE POLICY "attendance_update_admin" ON attendance_entries
  FOR UPDATE USING (
    company_id = auth_company_id()
    AND auth_role() IN ('hq_admin', 'contractor_admin')
  );

CREATE POLICY "attendance_delete_admin" ON attendance_entries
  FOR DELETE USING (
    company_id = auth_company_id()
    AND auth_role() IN ('hq_admin', 'contractor_admin')
  );
