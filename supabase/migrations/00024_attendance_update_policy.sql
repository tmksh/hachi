-- ============================================================
-- attendance_entries に UPDATE / DELETE ポリシーを追加
-- 打刻・承認・区分変更に必要
-- ============================================================

-- 自分のエントリを更新（打刻・勤務区分変更）
CREATE POLICY "attendance_employee_update" ON attendance_entries
  FOR UPDATE USING (
    company_id = auth_company_id()
    AND user_id = auth.uid()
  );

-- 管理者は全員分を更新（承認・却下）
CREATE POLICY "attendance_admin_update" ON attendance_entries
  FOR UPDATE USING (
    company_id = auth_company_id()
    AND auth_role() IN ('owner', 'hq_admin')
  );

-- 管理者は削除可能
CREATE POLICY "attendance_admin_delete" ON attendance_entries
  FOR DELETE USING (
    company_id = auth_company_id()
    AND auth_role() IN ('owner', 'hq_admin')
  );
