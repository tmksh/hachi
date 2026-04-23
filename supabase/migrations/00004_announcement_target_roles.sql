-- =========================================================
-- 回覧・お知らせのロール別ターゲティング
--   - target_type に 'roles' を追加（対象ロールで絞り込み）
--   - target_roles: 対象ロール配列（例: '{"owner","hq_admin"}'）
--   - target_type='all' の場合は全員に通知、
--     target_type='roles' の場合は target_roles に含まれるロールの
--     ユーザーのみ、一覧・通知ベルに表示される。
-- =========================================================

-- target_type CHECK 制約を拡張
ALTER TABLE announcements
  DROP CONSTRAINT IF EXISTS announcements_target_type_check;

ALTER TABLE announcements
  ADD CONSTRAINT announcements_target_type_check
  CHECK (target_type IN ('all', 'roles', 'departments', 'individuals'));

-- ロール配列カラムを追加
ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS target_roles TEXT[] DEFAULT '{}';

-- よく使うので GIN index を作成（ロール配列での検索を高速化）
CREATE INDEX IF NOT EXISTS idx_announcements_target_roles
  ON announcements USING GIN (target_roles);
