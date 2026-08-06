-- 従業員区分（No.77/78: 1人当たり利益の係数計算に使用。正社員=1.0 / パート=0.5）
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS employment_type TEXT NOT NULL DEFAULT 'full_time'
  CHECK (employment_type IN ('full_time', 'part_time'));

COMMENT ON COLUMN profiles.employment_type IS '従業員区分（full_time=正社員 係数1.0 / part_time=パート 係数0.5）';
