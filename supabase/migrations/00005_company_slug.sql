-- ============================================
-- 00005: companies テーブルに slug カラムを追加
-- サブドメイン方式（acme.bridge.jp など）に対応するための準備。
-- 今は slug を保存するだけで、ルーティングは NEXT_PUBLIC_APP_DOMAIN 設定後に有効化。
-- ============================================

ALTER TABLE companies ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- slug は小文字英数字とハイフンのみ許可
ALTER TABLE companies ADD CONSTRAINT companies_slug_format
  CHECK (slug IS NULL OR slug ~ '^[a-z0-9][a-z0-9\-]{1,61}[a-z0-9]$');

-- slug → company_id を高速に引けるインデックス
CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug) WHERE slug IS NOT NULL;

-- ============================================
-- RLS: slug は自社レコードのみ参照可
-- (company_select ポリシーは既に id = auth_company_id() で保護済み)
-- ============================================
