# BRIDGE — プロジェクト仕様書

> 最終更新: 2026-05-11

---

## 1. プロジェクト概要

**BRIDGE** は建設・リフォーム業向けの SaaS 管理プラットフォームです。  
複数の加盟店（施工店）と運営本部（BRIDGE 運営）が同一システムを共有しながら、  
それぞれの権限に応じた機能を利用します。

---

## 2. 技術スタック

| 項目 | 技術 |
|------|------|
| フレームワーク | Next.js 15 (App Router) |
| スタイリング | Tailwind CSS v4 + `class-variance-authority` |
| UI コンポーネント | Radix UI + shadcn/ui |
| バックエンド | Supabase (PostgreSQL + Auth + Storage) |
| チャート | Recharts |
| アニメーション | Framer Motion |
| デプロイ | Netlify |
| パッケージ管理 | npm (monorepo: `apps/web`) |

---

## 3. 環境変数 (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 4. ロール定義

| ロール | 説明 |
|--------|------|
| `owner` | 施工店オーナー |
| `hq_admin` | 本部管理者 |
| `contractor_admin` | 施工店管理者 |
| `employee` | 一般社員 |
| *(super-admin)* | BRIDGE 運営（メール固定: `super-admin@example.com`） |

---

## 5. ページ構成

### ユーザー向け (`/`)

| パス | ページ名 | 概要 |
|------|---------|------|
| `/dashboard` | ダッシュボード | KPI・勤怠打刻・ウィジェット |
| `/crm` | CRM | 顧客管理 |
| `/deals` | 商談 | 商談パイプライン（カンバン） |
| `/constructions` | 工事管理 | 工事案件一覧・ガントチャート |
| `/bi` | BIダッシュボード | 売上・粗利率・商談ステージ分析 |
| `/calendar` | カレンダー | ローカル予定 + Google カレンダー双方向同期 |
| `/mail` | メール | Gmail 連携受信トレイ |
| `/attendance` | 勤怠 | 出退勤打刻・履歴 |
| `/contracts` | 契約書 | 契約書管理 |
| `/quotes` | 見積 | 見積管理 |
| `/invoices` | 請求書 | 請求書管理 |
| `/documents` | 書類 | 各種書類 |
| `/budget` | 予算 | 予算管理 |
| `/craftsmen` | 職人管理 | 職人マスタ |
| `/circulation` | 回覧板 | 社内回覧 |
| `/workflow` | ワークフロー | 承認ワークフロー |
| `/marketing` | マーケティング | マーケティング施策 |
| `/settings` | 設定 | プロフィール・招待・パスワード |

### 管理コンソール (`/admin`)

| パス | ページ名 | 概要 |
|------|---------|------|
| `/admin` | 管理コンソール | 全国 BI・企業一覧 |
| `/admin/login` | 管理ログイン | super-admin 専用ログイン |

---

## 6. 管理コンソール仕様 (`/admin`)

- **認証**: `super-admin@example.com` のみアクセス可
- **ヘッダー**: `PageHeader` コンポーネント + `レポート出力` ドロップダウン
- **レポート出力**: 加盟店BI / 企業一覧 / ユーザー一覧 を CSV (BOM付き UTF-8) でダウンロード
- **タブ構成**:
  - `全国 BI` — KPI stat-card × 2 行 + 月次トレンド折れ線・ステータス円グラフ・粗利率分布棒グラフ・加盟店ランキングテーブル
  - `企業一覧` — 企業テーブル + 企業追加ダイアログ（オーナーアカウント同時作成）
- **サイドバー** (`AdminSidebar`): 全国加盟店BI / 企業一覧 の 2 項目
- **KPI デザイン**:
  - 上段 4 枚（登録企業数など）: `stat-card` + `neumorph-icon`（ダークグリーン）
  - BI タブ KPI: `stat-card` + 薄グリーン反転アイコン (`bg-primary/10 text-primary`)
- **チャートカラー**: グリーン系 `PIE_COLORS = ["#0F5132","#1A7A52","#2D9E6B","#4DB88A","#7DCFAA","#A8DFC5"]`

---

## 7. Google 連携

### Gmail 連携

| 項目 | 内容 |
|------|------|
| 認証フロー | `/api/gmail/auth` → Google OAuth → `/api/gmail/callback` |
| スコープ | `gmail.readonly`, `gmail.send`, `gmail.modify`, `userinfo.email`, `userinfo.profile` |
| トークン保存 | `email_accounts` テーブル (`access_token`, `refresh_token`, `token_expires_at`) |
| 同期 | `/api/gmail/sync` — Gmail スレッド・メッセージを `email_threads` / `email_messages` に保存 |
| 切断 | `disconnectGmailAccount()` — `email_accounts` レコード削除 |

### Google カレンダー連携

| 項目 | 内容 |
|------|------|
| 認証フロー | Supabase OAuth (`signInWithOAuth`) → `/api/auth/callback` でトークン抽出 |
| スコープ | `calendar.readonly` |
| トークン保存 | `profiles` テーブル (`google_access_token`, `google_refresh_token`, `google_token_expires_at`) |
| トークン取得 | `/api/google-token` — 期限切れ時にリフレッシュ |
| 双方向同期 | ローカル予定作成時に Google Calendar へ書き込み (`google_event_id` で紐付け) |
| 切断 | `disconnectGoogleCalendar()` — `profiles` のトークンフィールドを null 更新 |

---

## 8. データベーススキーマ (主要テーブル)

| テーブル | 用途 |
|---------|------|
| `profiles` | ユーザープロフィール・Google トークン |
| `companies` | 加盟企業マスタ |
| `customers` | 顧客マスタ |
| `deals` | 商談 |
| `constructions` | 工事案件 |
| `calendar_events` | カレンダー予定 (`google_event_id`, `google_calendar_id` を含む) |
| `email_accounts` | 連携メールアカウント (unique: `user_id, provider`) |
| `email_threads` | メールスレッド |
| `email_messages` | メールメッセージ |
| `attendance_records` | 勤怠打刻 |
| `contracts` | 契約書 |
| `quotes` | 見積書 |
| `invoices` | 請求書 |
| `announcements` | 回覧板 |

### マイグレーション履歴

| ファイル | 内容 |
|---------|------|
| `00001_initial_schema.sql` | 初期スキーマ |
| `00002_rls_policies.sql` | Row Level Security ポリシー |
| `00003_storage_policies.sql` | Storage ポリシー |
| `00004_announcement_target_roles.sql` | 回覧対象ロール |
| `00005_company_slug.sql` | 企業サブドメイン slug |
| `00006_kickoff_inputs.sql` | キックオフ入力フォームデータ |
| `00007_kickoff_company_update.sql` | 会社情報更新 |
| `00008_crm_master_data.sql` | CRM マスタデータ |
| `00009_craftsmen_master_data.sql` | 職人マスタデータ |
| `00010_email_accounts_unique.sql` | `email_accounts(user_id, provider)` ユニーク制約 |
| `00011_google_tokens.sql` | `profiles` に Google トークンカラム追加 |
| `00012_calendar_google_event_id.sql` | `calendar_events` に `google_event_id`, `google_calendar_id` 追加 |

---

## 9. 主要コンポーネント

| コンポーネント | パス | 説明 |
|----------------|------|------|
| `PageHeader` | `components/shared/page-header.tsx` | ページヘッダー（タイトル・説明・スロット） |
| `AdminSidebar` | `components/layout/admin-sidebar.tsx` | 管理コンソール用サイドバー |
| `AnalogClock` | `components/shared/analog-clock.tsx` | アナログ時計 |
| `WidgetCustomizer` | `components/shared/widget-customizer.tsx` | ダッシュボードウィジェット表示設定 |
| `BiKpi` | `app/(app)/admin/page.tsx` (ローカル) | BI タブ用 KPI カード |

---

## 10. 認証フロー

```
ログイン (/login)
  ├── メール/パスワード認証 (Supabase signInWithPassword)
  ├── Google OAuth (signInWithOAuth) → /api/auth/callback → Google トークン保存
  └── 初回招待 (inviteUserByEmail / createUser + verifyOtp)

パスワード更新 (/update-password)
オンボーディング (/onboarding)
```

---

## 11. 開発メモ

- **開発サーバー起動**: `cd apps/web && npm run dev`
- **Supabase マイグレーション適用**: Supabase ダッシュボードの SQL Editor で直接実行
- **Turbopack キャッシュクリア**: `pkill -f "next dev"; rm -f .next/dev/lock; npm run dev`
- **管理コンソールアクセス**: `/admin/login` にて `super-admin@example.com` でログイン
- **Google OAuth テストユーザー**: Google Cloud Console の OAuth 同意画面でテストユーザーを追加する必要あり（外部ユーザータイプの場合）
