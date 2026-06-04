export type AppIntegrationProvider =
  | "chatwork"
  | "slack"
  | "line_works"
  | "kintone";

export type AppIntegrationPublic = {
  id: string;
  provider: AppIntegrationProvider;
  is_active: boolean;
  events: string[];
  connected_at: string | null;
  settings: Record<string, string>;
  credential_hint: string | null;
  summary: string | null;
};

export type ChatworkRoom = {
  room_id: number;
  name: string;
  type: string;
};

export const DEFAULT_INTEGRATION_EVENTS = [
  "customer.created",
  "deal.created",
  "deal.stage_changed",
] as const;

export const INTEGRATION_EVENT_OPTIONS: { value: string; label: string }[] = [
  { value: "customer.created", label: "新規顧客" },
  { value: "customer.updated", label: "顧客更新" },
  { value: "customer.deleted", label: "顧客削除" },
  { value: "deal.created", label: "新規商談" },
  { value: "deal.updated", label: "商談更新" },
  { value: "deal.stage_changed", label: "商談ステージ変更" },
  { value: "deal.closed", label: "商談クローズ（受注/失注）" },
  { value: "estimate.created", label: "新規見積" },
  { value: "estimate.approved", label: "見積受理" },
  { value: "estimate.rejected", label: "見積却下" },
  { value: "contract.created", label: "新規契約" },
  { value: "contract.signed", label: "契約締結" },
  { value: "construction.created", label: "新規工事" },
  { value: "construction.started", label: "工事着工" },
  { value: "construction.completed", label: "工事完了" },
  { value: "invoice.issued", label: "請求書送付" },
  { value: "invoice.paid", label: "入金確認" },
  { value: "workflow.approved", label: "ワークフロー承認" },
  { value: "workflow.rejected", label: "ワークフロー却下" },
  { value: "announcement.published", label: "回覧板投稿" },
];

export { PROVIDER_DEFINITIONS } from "./providers/registry";
