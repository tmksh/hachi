-- 顧客ごとのメッセージング連携 ID（契約やり取り管理用）

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS line_user_id TEXT,
  ADD COLUMN IF NOT EXISTS slack_channel_id TEXT;

COMMENT ON COLUMN customers.line_user_id IS 'LINE Messaging API のユーザー ID（契約単位のやり取りフィルタ用）';
COMMENT ON COLUMN customers.slack_channel_id IS 'Slack チャンネル ID（契約単位のやり取りフィルタ用）';
