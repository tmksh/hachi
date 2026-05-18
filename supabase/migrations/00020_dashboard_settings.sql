-- ============================================
-- Dashboard settings per user
-- ============================================

CREATE TABLE user_dashboard_settings (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  settings   JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE user_dashboard_settings ENABLE ROW LEVEL SECURITY;

-- 自分の設定のみ参照可能
CREATE POLICY "users can view own dashboard settings"
  ON user_dashboard_settings FOR SELECT
  USING (auth.uid() = user_id);

-- 自分の設定のみ挿入可能
CREATE POLICY "users can insert own dashboard settings"
  ON user_dashboard_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 自分の設定のみ更新可能
CREATE POLICY "users can update own dashboard settings"
  ON user_dashboard_settings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
