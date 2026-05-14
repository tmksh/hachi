-- attendance_entries の UPDATE RLS ポリシーを追加
-- 従業員は自分のレコードを更新可能（出退勤打刻・休暇区分）
CREATE POLICY "attendance_employee_update" ON attendance_entries
  FOR UPDATE USING (
    company_id = auth_company_id()
    AND user_id = auth.uid()
  );

-- 管理者・オーナーは全レコードを更新可能（承認・却下）
CREATE POLICY "attendance_admin_update" ON attendance_entries
  FOR UPDATE USING (
    company_id = auth_company_id()
    AND auth_role() IN ('owner', 'hq_admin')
  );
