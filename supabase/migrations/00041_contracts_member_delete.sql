-- 同一企業メンバーが契約書を削除できるようにする（更新と同様に company スコープのみ）
DROP POLICY IF EXISTS "tenant_delete_contracts" ON contracts;
CREATE POLICY "tenant_delete_contracts" ON contracts
  FOR DELETE USING (company_id = auth_company_id());
