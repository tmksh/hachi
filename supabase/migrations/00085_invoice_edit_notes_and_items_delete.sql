-- 請求書の編集保存（宛名・期日・明細）が本番で落ちる件
--   - notes 列が未適用だと UPDATE 全体が失敗する
--   - invoice_items の DELETE が hq_admin 限定のため、総務が明細を作り直せない

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS notes TEXT;

DROP POLICY IF EXISTS "tenant_delete_invoice_items" ON invoice_items;
CREATE POLICY "tenant_delete_invoice_items" ON invoice_items
  FOR DELETE USING (company_id = auth_company_id());
