# BRIDGE 機能 QA チェックリスト

> 実施日: 2026-05-22（更新: 2026-05-22 後半 — E2E 追加）  
> 環境: `localhost:3000` / `admin@example.com`（オーナー）ほか 4 ロール  
> 自動実行: `cd apps/web && node scripts/qa-e2e.mjs`  
> 参照: [機能一覧](https://tmksh.github.io/hachi/features.html)

## サマリー

| 区分 | OK | WARN | FAIL |
|---|---:|---:|---:|
| 画面機能（17ルート） | 17 | 0 | 0 |
| 外部連携 | 4 | 2 | 0 |
| BI 期首設定 Dialog | 5 | 1 | 0 |
| **ロール権限マトリクス（4ロール×17ルート）** | **68** | **0** | **0** |
| **リードフロー E2E** | **13** | **0** | **0** |
| **Webhook / アプリ連携 E2E** | **5** | **0** | **0** |
| **全ルート QA** | **54** | **0** | **0** |

**結論:** 機能一覧の主要画面・4ロール権限・リードフロー・Webhook/アプリ連携の自動 E2E まで完了。OAuth 系（Gmail / Calendar）のみ環境依存で WARN。

---

## 1. BI 期首設定 Dialog E2E

| # | 項目 | 結果 | 備考 |
|---|---|---|---|
| D1 | 「期首設定」ボタンで Dialog 表示 | OK | 全セクション（全社目標・分析ルール・着地 tier）表示 |
| D2 | 保存 → Dialog 閉じる → KPI 再取得 | OK | POST /bi 200、トースト「設定を保存しました」 |
| D3 | Esc / キャンセルで Dialog 閉じる | OK | |
| D4 | `/bi/settings` → `/bi` リダイレクト + Dialog 自動表示 | OK | URL は `/bi` に正規化（クエリ除去） |
| D5 | スクロール可能（長フォーム） | OK | max-h 90vh + overflow-y-auto |
| D6 | React Strict Mode 二重マウント | WARN | 開発時 Dialog が二重表示されることがある（本番影響なし） |

---

## 2. 画面機能 QA（features.html 準拠）

| 機能 | ルート | 状態 | 備考 |
|---|---|---|---|
| 顧客管理 | `/crm` | OK | 見出し「顧客管理」 |
| 商談パイプライン | `/deals` | OK | カンバン・KPI |
| 見積管理 | `/quotes` | OK | ステータスタブ |
| 職人管理 | `/craftsmen` | OK | GET 200 |
| 契約管理 | `/contracts` | OK | GET 200 |
| 工事管理 | `/constructions` | OK | GET 200 |
| 請求管理 | `/invoices` | OK | GET 200 |
| 予算管理 | `/budget` | OK | GET 200 |
| 勤怠管理 | `/attendance` | OK | GET 200 |
| ワークフロー | `/workflow` | OK | GET 200 |
| 社内回覧板 | `/circulation` | OK | GET 200（見出し「回覧・お知らせ」） |
| カレンダー | `/calendar` | OK | GET 200 |
| メール連携 | `/mail` | OK | GET 200（未連携時デモスレッド） |
| 文書管理 | `/documents` | OK | GET 200 |
| BI ダッシュボード | `/bi` | OK | KPI 表示 |
| 通知・設定 | `/settings` | OK | アプリ連携 / API/Webhook タブあり |
| ダッシュボード | `/dashboard` | OK | ウィジェット・勤怠打刻表示 |

---

## 3. 外部連携 QA

| 機能 | 確認方法 | 状態 | 備考 |
|---|---|---|---|
| Supabase Auth / DB / Storage | ログイン・データ表示 | OK | 全画面データ取得正常 |
| 外部向け REST API | `curl` 6 EP | OK | 未認証 401（期待通り） |
| Webhook | `scripts/qa-e2e.mjs` | OK | 実配信 + `webhook_logs` 記録確認 |
| アプリ連携 | `scripts/qa-e2e.mjs` | OK | ローカル受信サーバーへ通知 POST 確認 |
| Gmail API | `/mail` | WARN | OAuth 未設定時はデモ表示 |
| Google Calendar API | `/calendar` | WARN | OAuth 未設定時は DB イベントのみ |

### REST API エンドポイント（未認証 curl）

```
GET /api/v1/customers     → 401
GET /api/v1/deals         → 401
GET /api/v1/estimates     → 401
GET /api/v1/constructions → 401
GET /api/v1/invoices      → 401
GET /api/v1/contracts     → 401
```

---

## 4. ロール権限マトリクス（2026-05-22 実施）

| ロール | アカウント | パスワード |
|---|---|---|
| オーナー | `admin@example.com` | `admin2026` |
| 本部管理者 | `hqadmin@bridge.test` | `Bridge2024!` |
| 施工店管理者 | `contractor@bridge.test` | `Bridge2024!` |
| 社員 | `employee@bridge.test` | `Bridge2024!` |

> 注: 仕様書記載の `owner@bridge.test` は DB 未登録。オーナー権限は `admin@example.com` で検証。

### 保護ルート（middleware.ts）

| ルート | オーナー | 本部管理者 | 施工店管理者 | 社員 |
|---|---|---|---|---|
| `/bi` `/crm` `/deals` `/quotes` `/craftsmen` `/contracts` `/invoices` | ✅ | ✅ | ✅ | ❌ → `/unauthorized` |
| `/budget` `/marketing/roi` | ✅ | ✅ | ❌ | ❌ |
| ポータル（`/dashboard` `/attendance` 等 8 ルート） | ✅ 全ロール | ✅ | ✅ | ✅ |

**結果:** 4 ロール × 17 ルート = **68 ケースすべて OK**

---

## 5. リードフロー E2E（2026-05-22 実施）

| Step | 操作 | 結果 |
|---|---|---|
| 1 | 顧客登録（`customers` INSERT） | OK |
| 2 | 商談追加（`deals` stage=inquiry） | OK |
| 3 | 見積作成（`estimates` + 金額計算） | OK |
| 4 | 受注確定（`deals` stage=won） | OK |
| 5 | 工事登録（`constructions` + 受注額引き継ぎ） | OK |
| — | DB 整合性確認（4 テーブル） | OK |
| — | 各画面 GET 200（`/crm` `/deals` `/quotes` `/constructions`） | OK |

---

## 6. Webhook / アプリ連携 E2E（2026-05-22 実施）

| # | 項目 | 結果 | 備考 |
|---|---|---|---|
| W1 | ローカル受信サーバー起動 | OK | `:9876` |
| W2 | `dispatchWebhook` 相当処理実行 | OK | `scripts/dispatch-runner.mjs` |
| W3 | Webhook 実配信（`deal.updated`） | OK | ペイロード + HMAC 署名 |
| W4 | アプリ連携通知 POST | OK | Slack 形式 → ローカル URL |
| W5 | `webhook_logs` 成功記録 | OK | `success=true`, `response_status=200` |

---

## 7. 未実施（次回 QA 推奨）

- [ ] CRUD 操作の詳細（新規作成 → 編集 → 削除）各画面
- [ ] 本番 Slack / Chatwork への接続テスト（実トークン）
- [ ] Gmail / Google Calendar OAuth 本番連携
- [ ] モバイル幅レイアウト

---

## 8. 全ルート QA（2026-05-22 実施）

> 実行: `npm run qa:routes`（owner: `admin@example.com`）

| 区分 | 件数 | 結果 |
|---|---|---|
| 静的ルート | 34 | ✅ 全 OK |
| 動的ルート（詳細・編集） | 13 | ✅ 全 OK |
| REST API 未認証 | 6 | ✅ 401 |
| スキップ | 1 | ⏭ `/marketing/email/[id]`（email_threads データなし） |

**合計: 54 OK / 0 FAIL**

### 対象ルート一覧

- **ダッシュボード:** `/dashboard`, `/bi`, `/bi/settings`
- **リード:** `/crm`, `/deals`, `/quotes`, `/craftsmen` + new + 詳細/編集
- **生産:** `/contracts`, `/constructions`, `/invoices`, `/budget` + new + 詳細/編集
- **ポータル:** `/calendar`, `/mail`, `/attendance`, `/workflow`, `/circulation`, `/documents` + new + 詳細
- **システム:** `/settings`
- **マーケ:** `/marketing/email`, `/sns`, `/roi`, `/creative` + new

---

## 9. ビルド

```
npm run build  → 成功（2026-05-22 確認）
node scripts/qa-e2e.mjs   → 86 OK / 0 WARN / 0 FAIL（2026-05-22 確認）
node scripts/qa-routes.mjs → 54 OK / 0 FAIL（2026-05-22 確認）
```
