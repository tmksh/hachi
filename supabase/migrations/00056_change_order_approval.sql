-- 追加変更工事の承認フロー（申請者コメント・承認者・承認日時）
ALTER TABLE change_orders
  ADD COLUMN IF NOT EXISTS submitted_to UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS submitted_comment TEXT,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
