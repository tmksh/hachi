-- 個人向けお知らせ（営業フロー3経路通知の②）
ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS target_user_ids UUID[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_announcements_target_user_ids
  ON announcements USING GIN (target_user_ids);
