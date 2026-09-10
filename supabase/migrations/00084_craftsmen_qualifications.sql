-- 職人の保有資格（設定 › 職人マスタの資格ラベルを配列で保持）
ALTER TABLE craftsmen
  ADD COLUMN IF NOT EXISTS qualifications TEXT[] NOT NULL DEFAULT '{}';
