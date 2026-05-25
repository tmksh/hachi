-- Repair: slug column missing on remote despite 00005 being recorded
ALTER TABLE companies ADD COLUMN IF NOT EXISTS slug TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_slug_key'
  ) THEN
    ALTER TABLE companies ADD CONSTRAINT companies_slug_key UNIQUE (slug);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_slug_format'
  ) THEN
    ALTER TABLE companies ADD CONSTRAINT companies_slug_format
      CHECK (slug IS NULL OR slug ~ '^[a-z0-9][a-z0-9\-]{1,61}[a-z0-9]$');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug) WHERE slug IS NOT NULL;
