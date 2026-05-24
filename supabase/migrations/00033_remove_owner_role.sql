-- 議事録: オーナーロール廃止 → 本部管理者へ移行
-- RLS ポリシーは hq_admin を含むためそのまま動作（owner ロールのユーザーは存在しなくなる）
UPDATE profiles SET role = 'hq_admin' WHERE role = 'owner';

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('hq_admin', 'contractor_admin', 'employee'));
