# BRIDGE — プロジェクト仕様書

> 最終更新: 2026-07-25  
> **詳細仕様（メニュー〜画面タブ）の正本:** [docs/index.html](docs/index.html)（公開: https://tmksh.github.io/hachi/index.html）

---

## 1. プロジェクト概要

**BRIDGE Linq** は建設・リフォーム業向けの SaaS 管理プラットフォームです。  
加盟店は `{slug}.bridge-linq.com` のサブドメインでテナント分離して利用します。  
サイドバー大項目は **ダッシュボード / リード / 生産 / ポータル**（マーケティングはフェーズ2・ルート遮断）。

---

## 2. 技術スタック

| 項目 | 技術 |
|------|------|
| フレームワーク | Next.js 16.1.x (App Router) |
| UI | React 19.2.x + Tailwind CSS v4 + Radix / shadcn/ui |
| バックエンド | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| データ取得 | TanStack Query / Table |
| アニメーション | Framer Motion |
| デプロイ | Netlify (`apps/web`, 本番 `bridge-linq.com`) |
| パッケージ管理 | npm workspaces (`apps/web`) |

---

## 3. 開発・起動

```bash
cd apps/web
npm install   # 初回のみ
npm run dev   # http://localhost:3000
```

---

## 4. 環境変数 (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_DOMAIN=          # テナント slug 用（本番: bridge-linq.com）
NETLIFY_TOKEN=...                # 企業登録時のドメイン alias 追加
NETLIFY_SITE_ID=...
```

---

## 5. ロール定義

| 種別 | ロール |
|------|--------|
| レガシー | `hq_admin`, `contractor_admin`, `employee` |
| CSV デフォルト | `admin`, `executive`, `sales`, `field_manager`, `designer`, `administration` |
| 外部 | `external_partner`（`/partner/[token]`） |
| プラットフォーム | `super-admin@example.com`（`/admin`） |

- 旧 `owner` は廃止（→ `hq_admin`）
- 実行時のメニュー表示は会社 `settings.role_permissions`（未設定時は `NAV_ITEM_ROLES` / `ROUTE_ROLES`）
- `/marketing` は全ロールアクセス不可

定義の正本: `apps/web/src/lib/constants.ts`

---

## 6. メニュー構成（サイドバー正本）

| グループ | メニュー | ルート |
|----------|----------|--------|
| ダッシュボード | ダッシュボード / BI | `/dashboard`, `/bi` |
| リード | 顧客・商談 / 見積 / 職人 | `/crm`, `/quotes`, `/craftsmen` |
| 生産 | 契約 / 工事 | `/contracts`, `/constructions` |
| ポータル | カレンダー〜文書 | `/calendar`, `/mail`, `/attendance`, `/workflow`, `/circulation`, `/documents` |

ナビ外: `/settings`, `/admin`, `/bi2`, `/invoices`, `/budget`, `/marketing/*`  
詳細タブ・ステータス・業務フローは [docs/index.html](docs/index.html) を参照。

---

## 7. 機能一覧と実装状況

カード形式の一覧は [docs/features.html](docs/features.html)。  
外部連携は [docs/api.html](docs/api.html)、AI は [docs/ai.html](docs/ai.html)。

### 要点（2026-07）

- **CRM:** 見込度 A/B/C・特需、録音 Whisper、AI ステージ／見込度提案
- **見積:** 予備費1/2、粗利ゲート、顧客向け／原価内訳 PDF
- **工事:** **8タブ**（顧客情報追加）＋工程表からの工事日報
- **BI:** 着地予測・昨対・部門別・見込度期待値売上
- **ポータル:** 社内チャット（`internal_messages`）、回覧ロール投稿、Gmail/IMAP
- **権限:** 会社別権限マトリクス＋カスタムロール
- **DB:** migrations `00001`〜`00064`

---

## 8. マルチテナント

1. Host から slug 抽出（`{slug}.bridge-linq.com` / 開発は `{slug}.localhost`）
2. RPC `resolve_company_id_by_slug` で `company_id` 取得
3. 認証・RBAC。別テナントは自社サブドメインへリダイレクト
4. `x-tenant-slug` / `x-tenant-id` を Server Components へ伝搬

企業登録時に Netlify API で `{slug}.bridge-linq.com` を domain alias 追加。

---

## 9. 検証用アカウント

| 用途 | メール | パスワード |
|------|--------|------------|
| 管理者メイン | `admin@example.com` | `admin2026` |
| Super Admin | `super-admin@example.com` | `admin2026` |
| 本部 / 施工店 / 社員 | `hqadmin@bridge.test` 等 | `admin2026` |

本番: https://bridge-linq.com  
仕様書: https://tmksh.github.io/hachi/index.html
