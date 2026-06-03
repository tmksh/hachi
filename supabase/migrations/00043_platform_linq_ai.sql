-- プラットフォーム共通設定（SaaS: 運営が設定 → 全テナントで利用）
CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
-- ポリシーなし = 一般ユーザーはアクセス不可（service_role のみ）

INSERT INTO platform_settings (key, value)
VALUES (
  'linq_ai',
  '{"enabled": false, "provider": "google", "model": "gemini-2.0-flash", "sttProvider": "web_speech"}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
