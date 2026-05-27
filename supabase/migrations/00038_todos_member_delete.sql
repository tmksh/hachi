-- 同一企業メンバーが ToDo を削除できるようにする（管理者限定を解除）
DROP POLICY IF EXISTS "tenant_delete_todos" ON todos;
CREATE POLICY "tenant_delete_todos" ON todos
  FOR DELETE USING (company_id = auth_company_id());
