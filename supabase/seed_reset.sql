-- ============================================================
-- BRIDGE テスト用シードデータ削除スクリプト
-- seed.sql で作成したデータをすべて削除します。
-- ============================================================

DO $$
DECLARE
  company_id UUID := '00000000-0000-0000-0000-000000000001';
  owner_id   UUID := '00000000-0000-0000-0000-000000000010';
  hq_id      UUID := '00000000-0000-0000-0000-000000000020';
  contr_id   UUID := '00000000-0000-0000-0000-000000000030';
  emp_id     UUID := '00000000-0000-0000-0000-000000000040';
BEGIN
  DELETE FROM auth.identities WHERE user_id IN (owner_id, hq_id, contr_id, emp_id);
  DELETE FROM auth.users      WHERE id       IN (owner_id, hq_id, contr_id, emp_id);
  DELETE FROM companies       WHERE id = company_id;
  RAISE NOTICE '✅ テストユーザーを削除しました。';
END $$;
