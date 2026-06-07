# BRIDGE — プロジェクト仕様書

> 最終更新: 2026-05-24（2026/04/16 設計レビュー反映）

---

## 1. プロジェクト概要

**BRIDGE** は建設・リフォーム業向けの SaaS 管理プラットフォームです。  
複数の加盟店（施工店）と運営本部（BRIDGE 運営）が同一システムを共有しながら、  
それぞれの権限に応じた機能を利用します。

---

## 2. 技術スタック

| 項目 | 技術 |
|------|------|
| フレームワーク | Next.js 16 (App Router) |
| スタイリング | Tailwind CSS v4 + `class-variance-authority` |
| UI コンポーネント | Radix UI + shadcn/ui |
| バックエンド | Supabase (PostgreSQL + Auth + Storage) |
| チャート | Recharts |
| アニメーション | Framer Motion |
| デプロイ | Netlify (`apps/web`) |
| パッケージ管理 | npm (monorepo: `apps/web`) |

---

## 3. 開発・起動

```bash
cd apps/web
npm install   # 初回のみ
npm run dev   # http://localhost:3000
```

ルートから実行する場合:

```bash
npm run dev --prefix apps/web
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
NEXT_PUBLIC_APP_DOMAIN=          # テナント slug 用（本番）
```

---

## 5. ロール定義

| ロール | 説明 |
|--------|------|
| `hq_admin` | 本部管理者（最上位。旧 owner は 00033 で廃止・移行） |
| `contractor_admin` | 施工店管理者 |
| `employee` | 一般社員 |
| *(super-admin)* | BRIDGE 運営（メール固定: `super-admin@example.com`） |

Middleware (`lib/supabase/middleware.ts`) により CRM・BI・予算等のルートを保護。  
`/marketing` は全ロールアクセス不可（v2 非公開・ルートブロック）。  
Supabase RLS により `company_id` 単位でデータを分離。

---

## 6. 機能一覧と実装状況

詳細は [機能一覧](docs/features.html) を参照。

### CRM・リード

| 機能 | パス | 状態 |
|------|------|------|
| 顧客・商談管理 | `/crm` | 実装済 — 一覧/カード/パイプライン（初期:一覧）、法人/個人タブ、タグ、関連データ参照 |
| 顧客詳細タブ | `/crm/[id]` | 実装済 — 概要/記入/商談/録音・要約/ToDo/スケジューリング/ファイル |
| 商談パイプライン | `/crm?view=pipeline` | 実装済 — `/deals` はリダイレクト。カンバン D&D、KPI、受注フロー |
| 見積管理 | `/quotes` | 実装済 — 明細 CRUD、粗利計算、ステータス管理、商談連携 |
| 職人管理 | `/craftsmen` | 実装済 — CRUD、専門/ランク、下請連携 |

### 工事・生産

| 機能 | パス | 状態 |
|------|------|------|
| 契約管理 | `/contracts` | 実装済 — 7タブ（顧客情報/やり取り管理/書類作成/承認WF/電子契約/ドキュメント/見積もり） |
| 工事管理 | `/constructions` | 実装済 — **7タブ**（工程表/見積もり/契約書/追加変更/工事台帳/発注書・請書/ドキュメント一覧） |
| 追加変更 | 工事詳細タブ | 実装済 — `change_orders`、CloudSign B案連携 |
| 工事台帳 | 工事詳細タブ | 実装済 — `construction_cost_budgets` へ DB 永続化 |
| 発注書 | 工事詳細タブ | 実装済 — 支払スケジュール 2/4/6/12 回 |
| 請求管理 | `/invoices` | 実装済 — 締日ベース月次請求生成（メニュー削除は検討中・現状維持） |
| 予算管理 | `/budget` | 実装済 — 完了工事から実績集計、承認フロー（メニュー削除は検討中・現状維持） |

#### Notion 工事フロー（2-1〜2-5）

| ステップ | 内容 | 画面 |
|------|------|------|
| 2-1 | 工事案件の引き継ぎ〜工程表作成 | `/constructions/new` → 工程表タブ |
| 2-2 | 見積作成 | 工事詳細「見積もり」タブ |
| 2-3 | 追加変更工事の対応 | 工事詳細「追加変更」タブ |
| 2-4 | 工事台帳 | 工事詳細「工事台帳」タブ |
| 2-5 | 発注書・請求書 | 発注書・請書タブ + `/invoices` |

#### 工事詳細 7タブ

| タブ | 内容 |
|------|------|
| 工程表 | ガントチャート、タスク CRUD |
| 見積もり | 1工事に複数見積、版（version）・改訂（parent_estimate_id）、予備費1/2 |
| 契約書 | 契約 PDF アップロード・管理 |
| 追加変更 | 変更前後明細・差額、CloudSign 送信 or PDF 代替 |
| 工事台帳 | 原価管理表、`construction_cost_budgets` 永続化 |
| 発注書・請書 | 下請発注、`payment_schedule`（2/4/6/12回） |
| ドキュメント一覧 | 工事関連ファイルの一覧・ダウンロード |

### ポータル

| 機能 | パス | 状態 |
|------|------|------|
| 勤怠管理 | `/attendance` | 実装済 |
| ワークフロー | `/workflow` | 実装済 — 多段承認、差戻し、コメント |
| 社内回覧板 | `/circulation` | 実装済 |
| カレンダー | `/calendar` | 実装済 — Google カレンダー双方向同期（OAuth 設定時） |
| メール連携 | `/mail` | 実装済 — Gmail OAuth / IMAP、未連携時はデモスレッド |
| 文書管理 | `/documents` | 実装済 — 顧客・工事紐付け、リスト/グリッド表示 |

### システム

| 機能 | パス | 状態 |
|------|------|------|
| BI ダッシュボード | `/bi` | 実装済 — 工事・請求から実績集計、期首設定 DB 連携 |
| ロールベース権限 | Middleware + RLS | 実装済 — **3 段階ロール**（owner 廃止） |
| 通知・設定 | `/settings` | 実装済 — CloudSign・請求締日、ベル通知（60 秒更新） |
| マーケティング | `/marketing` | **v2 非公開** — ナビ非表示、Middleware で全ロールブロック |

### 外部連携

| 機能 | 状態 |
|------|------|
| Supabase Auth / DB / Storage | 稼働中 |
| CloudSign API（B案） | 実装済 — 追加変更タブ、設定 > 会社情報 |
| Gmail API | OAuth 設定時に利用可 |
| Google Calendar API | OAuth 設定時に双方向同期（`calendar` スコープ） |
| 外部向け REST API | 実装済 — `/api/v1/*`（GET）、設定画面で API キー発行 |
| Webhook | 実装済 — 全主要イベント発火、HMAC 署名付き POST |
| アプリ連携 | 実装済 — LINE公式アカウント / Slack、設定画面からワンクリック接続 |

---

## 7. ページ構成

### ユーザー向け (`/`)

| パス | ページ名 |
|------|---------|
| `/dashboard` | ダッシュボード |
| `/crm` | 顧客・商談管理（一覧/カード/パイプライン） |
| `/deals` | → `/crm?view=pipeline` へリダイレクト |
| `/constructions` | 工事管理 |
| `/bi` | BI ダッシュボード |
| `/calendar` | カレンダー |
| `/mail` | メール |
| `/attendance` | 勤怠 |
| `/contracts` | 契約書 |
| `/quotes` | 見積 |
| `/invoices` | 請求書 |
| `/documents` | 書類 |
| `/budget` | 予算 |
| `/craftsmen` | 職人管理 |
| `/circulation` | 回覧板 |
| `/workflow` | ワークフロー |
| `/marketing` | マーケティング（**v2 非公開・ルートブロック**） |
| `/settings` | 設定 |

### 管理コンソール (`/admin`)

| パス | 説明 |
|------|------|
| `/admin` | 全国 BI・企業一覧 |
| `/admin/login` | super-admin 専用ログイン |

---

## 8. 外部連携 API

### REST API（Bearer 認証）

| メソッド | エンドポイント | 内容 |
|----------|---------------|------|
| GET | `/api/v1/customers` | 顧客一覧 |
| GET | `/api/v1/deals` | 商談一覧 |
| GET | `/api/v1/estimates` | 見積一覧 |
| GET | `/api/v1/contracts` | 契約一覧 |
| GET | `/api/v1/constructions` | 工事一覧 |
| GET | `/api/v1/invoices` | 請求一覧 |

認証: `Authorization: Bearer brg_...`  
API キーは **設定 → API/Webhook** から発行。

### CloudSign（B案）

- **設定**: 設定 → 会社情報 → CloudSign 連携（`companies.settings.cloudsign`）
- **用途**: 追加変更工事タブから電子署名送信
- **未設定時**: PDF ダウンロードで代替（顧客が別途 CloudSign 契約）

### アプリ連携（ワンクリック通知）

**設定 → アプリ連携** から LINE公式アカウント / Slack を接続。  
顧客・商談・見積・契約・工事・請求・ワークフロー・回覧板のイベントを各サービスへ自動通知。

### Webhook

業務イベント発生時に登録 URL へ JSON POST。ヘッダー `X-Bridge-Signature: sha256=...` で HMAC 検証可能。  
**発火対象:** 顧客 CRUD、商談 CRUD/ステージ変更、見積作成/受理/却下、契約作成/締結、工事作成/着工/完了、請求送付/入金、WF 承認/却下、回覧板投稿。

詳細設計: [docs/api.html](docs/api.html)

---

## 9. Google 連携

### Gmail

| 項目 | 内容 |
|------|------|
| 認証 | `/api/gmail/auth` → OAuth → `/api/gmail/callback` |
| 同期 | `/api/gmail/sync` |
| 未連携時 | デモスレッド表示（`lib/mocks/mail-mock.ts`） |

### Google カレンダー

| 項目 | 内容 |
|------|------|
| スコープ | `https://www.googleapis.com/auth/calendar` |
| 双方向同期 | ローカル予定 ↔ Google Calendar（`google_event_id` で紐付け） |
| トークン | `profiles.google_*` / `/api/google-token` |

---

## 10. BI ダッシュボード

- **期首設定**: `/bi` の Dialog（旧 `/bi/settings` は `/bi?settings=1` へリダイレクト）→ `bi_annual_settings`, `bi_overhead_items`, `bi_department_targets`
- **分析ルール（会社共通）**: `bi_company_config` — 着地予測 tier（A見込等）、実績ソース、粗利率
- **期中変更**: `bi_budget_change_log` — 予算変更の修正履歴・遡及按分
- **実績集計**: `getBiActuals()` — 設定に基づき工事/商談/請求から売上・粗利を集計
- **部門紐付け**: `constructions.department_name`, `deals.department_name`（工事・商談編集で設定）
- **表示単位**: 万円
- **月次按分**: 製造間接費は変更履歴を反映。全社は均等÷12または売上構成比、部門別は売上構成比

---

## 11. データベース（主要テーブル）

| テーブル | 用途 |
|---------|------|
| `profiles` | ユーザープロフィール・Google トークン（role: hq_admin / contractor_admin / employee） |
| `companies` | 加盟企業（settings: cloudsign, invoice_closing_day 等） |
| `customers` | 顧客 |
| `deals` | 商談 |
| `constructions` | 工事 |
| `estimates` / `estimate_items` | 見積（construction_id, version, reserve_fee_*） |
| `change_orders` | 追加変更工事（CloudSign 連携） |
| `construction_cost_budgets` | 工事台帳（原価管理表）永続化 |
| `contractor_orders` | 下請発注（payment_schedule JSONB） |
| `contracts` | 契約 |
| `invoices` | 請求 |
| `budgets` | 予算 |
| `documents` | 文書（customer_id, construction_id 紐付け） |
| `bi_annual_settings` | BI 期首設定 |
| `bi_company_config` | BI 分析ルール（着地 tier・実績ソース等） |
| `bi_budget_change_log` | BI 期中予算変更履歴 |
| `api_keys` | 外部 API キー |
| `app_integrations` | LINE公式 / Slack アプリ連携設定 |
| `webhook_endpoints` / `webhook_logs` | Webhook 設定・ログ |
| `announcements` | 回覧板 |

### マイグレーション

`supabase/migrations/` — 00001〜00033

| 番号 | 内容 |
|------|------|
| 00031 | 見積版管理・予備費、change_orders、payment_schedule |
| 00032 | construction_cost_budgets、documents 顧客/工事紐付け |
| 00033 | owner ロール廃止 → hq_admin へ移行 |

---

## 12. 認証フロー

```
/login          メール/パスワード + Google OAuth
/onboarding     初回セットアップ
/update-password  パスワード変更
/api/auth/callback  OAuth コールバック
```

---

## 13. 既知の制約

| 項目 | 内容 |
|------|------|
| Gmail / Google Calendar | Google Cloud OAuth 同意画面・審査が必要（テストユーザー追加で開発可） |
| メール未連携 | デモスレッドを表示（仕様通り） |
| マーケティング | v2 非公開。ナビ非表示、Middleware で `/marketing` 全ロールブロック |
| CloudSign | B案（顧客別途契約）。API 未設定時は PDF ダウンロード代替 |
| BI 請求の二重計上 | 工事+請求を両方ソースにした場合、工事紐付き請求は自動除外 |

---

## 14. 関連ドキュメント

- [機能一覧](docs/features.html)
- [外部連携 API 仕様](docs/api.html)
- [仕様書トップ](docs/index.html)
