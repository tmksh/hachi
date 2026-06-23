-- ============================================================
-- 00051: 音声録音ジョブ管理テーブル + Storage バケット
-- ============================================================

-- voice_jobs: 非同期文字起こしジョブ管理
CREATE TABLE IF NOT EXISTS voice_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  deal_id         UUID,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','processing','done','error')),
  storage_path    TEXT NOT NULL,
  duration_sec    INT,
  file_size_bytes BIGINT,
  transcript      TEXT,
  result          JSONB,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voice_jobs_company_id_idx  ON voice_jobs(company_id);
CREATE INDEX IF NOT EXISTS voice_jobs_customer_id_idx ON voice_jobs(customer_id);
CREATE INDEX IF NOT EXISTS voice_jobs_status_idx      ON voice_jobs(status);

-- updated_at 自動更新
CREATE OR REPLACE FUNCTION update_voice_jobs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER voice_jobs_updated_at
  BEFORE UPDATE ON voice_jobs
  FOR EACH ROW EXECUTE FUNCTION update_voice_jobs_updated_at();

-- RLS
ALTER TABLE voice_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "voice_jobs: 同一会社のみ参照・更新" ON voice_jobs
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- voice-recordings Storage バケット（プライベート・128MB上限）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-recordings',
  'voice-recordings',
  false,
  134217728, -- 128MB
  ARRAY['audio/webm','audio/ogg','audio/mp4','audio/wav','audio/mpeg']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: 自社のパスのみアクセス可
CREATE POLICY "voice-recordings: 自社フォルダのみ"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'voice-recordings'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'voice-recordings'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM profiles WHERE id = auth.uid()
    )
  );
