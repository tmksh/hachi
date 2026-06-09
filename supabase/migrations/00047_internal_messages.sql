-- ============================================
-- Internal Messages: ユーザー間の社内チャット・フォローアップ問い合わせ
-- ============================================

CREATE TABLE IF NOT EXISTS internal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- recipient_id が NULL の場合はブロードキャスト（全員）
  recipient_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  -- 'chat': 通常チャット / 'followup_inquiry': フォローアップ問い合わせ
  message_type TEXT NOT NULL DEFAULT 'chat',
  related_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  related_deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_messages_company ON internal_messages(company_id);
CREATE INDEX IF NOT EXISTS idx_internal_messages_recipient ON internal_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_internal_messages_sender ON internal_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_internal_messages_created_at ON internal_messages(created_at DESC);

-- RLS 有効化
ALTER TABLE internal_messages ENABLE ROW LEVEL SECURITY;

-- 送信者・受信者のみ閲覧可（recipient_id=NULL は同会社の全員）
CREATE POLICY "internal_messages_select" ON internal_messages
  FOR SELECT USING (
    sender_id = auth.uid()
    OR recipient_id = auth.uid()
    OR (
      recipient_id IS NULL
      AND company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- 同会社のメンバーのみ送信可
CREATE POLICY "internal_messages_insert" ON internal_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- 既読更新は受信者のみ
CREATE POLICY "internal_messages_update" ON internal_messages
  FOR UPDATE USING (
    recipient_id = auth.uid() OR sender_id = auth.uid()
  );
