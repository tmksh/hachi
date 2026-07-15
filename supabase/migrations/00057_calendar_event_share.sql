-- 予定のメンバー共有（No.4-6-2）: 共有先メンバーIDの配列
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS shared_with UUID[] NOT NULL DEFAULT '{}';
