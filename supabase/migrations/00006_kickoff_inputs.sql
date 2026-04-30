-- kickoff_inputs: GitHub Pages のキックオフ入力シートのデータを保存するテーブル
-- 認証不要でアクセスできるよう RLS を設定（anon ロールに読み書きを許可）

CREATE TABLE kickoff_inputs (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  key        TEXT        NOT NULL UNIQUE,
  value      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE kickoff_inputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kickoff_inputs: anon select" ON kickoff_inputs
  FOR SELECT TO anon USING (true);

CREATE POLICY "kickoff_inputs: anon insert" ON kickoff_inputs
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "kickoff_inputs: anon update" ON kickoff_inputs
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- updated_at を自動更新
CREATE OR REPLACE FUNCTION update_kickoff_inputs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER kickoff_inputs_updated_at
  BEFORE UPDATE ON kickoff_inputs
  FOR EACH ROW EXECUTE FUNCTION update_kickoff_inputs_updated_at();
