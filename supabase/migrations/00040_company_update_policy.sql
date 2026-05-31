-- ============================================
-- companies テーブルの UPDATE ポリシーを追加
--   これまで companies には SELECT ポリシー (company_select) しか無く、
--   UPDATE 用ポリシーが存在しなかったため、会社情報・権限設定・PDFテンプレート等の
--   保存 (updateCompany) が RLS により 0 行更新となり .single() がエラーになっていた。
--   自社かつ本部管理者(hq_admin)のみ更新可能とする。
-- ============================================

DROP POLICY IF EXISTS "company_update" ON companies;

CREATE POLICY "company_update" ON companies
  FOR UPDATE
  USING (id = auth_company_id() AND auth_role() = 'hq_admin')
  WITH CHECK (id = auth_company_id() AND auth_role() = 'hq_admin');
