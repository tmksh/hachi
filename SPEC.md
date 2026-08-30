# BRIDGE — プロジェクト仕様書

> 最終更新: 2026-08-30  
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
| 外部 | `external_partner`（`/partner/[token]`、業者請求 `/partner/invoice/[token]`） |
| プラットフォーム | `super-admin@example.com`（`/admin`・`/admin/login`） |

- 旧 `owner` は廃止（→ `hq_admin`）
- 実行時のメニュー表示は会社 `settings.role_permissions`（未設定時は `NAV_ITEM_ROLES` / `ROUTE_ROLES`）
- `/marketing` は全ロールアクセス不可
- テナント内の権限外ページは `/unauthorized`
- `/admin` 配下は super-admin 以外を `/admin/login` へ（加盟店 RBAC とは別ルート）

定義の正本: `apps/web/src/lib/constants.ts`

---

## 6. メニュー構成（サイドバー正本）

`NAV_GROUPS`（`apps/web/src/lib/constants.ts`）が正本。

| グループ | メニュー | ルート |
|----------|----------|--------|
| ダッシュボード | ダッシュボード / BI | `/dashboard`, `/bi` |
| リード | 問い合わせ / 顧客・商談 / 見積 / 職人 | `/leads`, `/crm`, `/quotes`, `/craftsmen` |
| 生産 | 契約 / 工事 / 納品・検収 / 帳票データ作成 / 勘定科目の確定 | `/contracts`, `/constructions`, `/fulfillment`, `/ledger`, `/account-items` |
| ポータル | カレンダー〜文書 | `/calendar`, `/mail`, `/attendance`, `/workflow`, `/circulation`, `/documents` |

ナビ外: `/settings`（ユーザーメニュー）、`/admin`（運営専用ログイン）、`/bi2`、`/invoices`、`/budget`、`/financials`（BI から・経営層）、`/marketing/*`  
詳細タブ・ステータス・業務フローは [docs/index.html](docs/index.html)。  
**入力項目ごとの参照先（問い合わせ〜運営まで全機能）は [入力 → 参照](docs/index.html#data-map)**。他の画面では使われない項目は、その旨を平文で書いてあります。

---

## 7. 機能一覧と実装状況

カード形式の一覧は [docs/features.html](docs/features.html)。  
外部連携は [docs/api.html](docs/api.html)、AI は [docs/ai.html](docs/ai.html)。

### 要点（2026-08-30）

- **CRM:** 見込度 A/B/C・特需、録音 Whisper、AI ステージ／見込度提案
- **問い合わせ:** Webhook / 手動登録。顧客化はボタン操作
- **見積:** 予備費1/2、粗利ゲート、顧客向け／原価内訳 PDF
- **工事:** **8タブ**（顧客情報〜ドキュメント）。工程表から日報画面へ遷移（タスク値は手入力）
- **納品・検収 / 帳票 / 勘定科目:** 発注後フロー。全銀は会社情報の振込元＋職人口座
- **契約書:** 顧客・工事・会社情報から甲乙・工期・名称を自動転記。請負金額欄のラベルは税抜、実値は工事 `order_amount`（見積 `total`＝税込が入ることがある）
- **BI:** 着地予測・昨対・部門別・見込度期待値売上。会計開始月・見込度%は会社情報
- **ポータル:** 社内チャット（`internal_messages`）。BombAlert は未読の**緊急回覧 1件以上**（チャット未読では出さない）
- **メール:** Gmail OAuth（スレッド返信可）／ IMAP ／ 手動フォワード
- **カレンダー:** Google 連携の操作本体は **設定 → 外部連携 → Googleカレンダー**
- **勤怠:** 始業・終業は会社情報と組織→勤怠設定で共通（`attendance_settings`）
- **権限:** 会社別権限マトリクス＋カスタムロール
- **DB:** migrations `00001`〜`00080`

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
