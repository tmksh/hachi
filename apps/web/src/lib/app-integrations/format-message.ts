import type { WebhookEvent } from "@/lib/webhooks";

const STAGE_LABELS: Record<string, string> = {
  lead: "リード",
  inquiry: "問い合わせ",
  first_meeting: "初回面談",
  proposal: "提案",
  closing: "クロージング",
  won: "受注",
  lost: "失注",
  delivered: "引渡済",
};

function stageLabel(stage: unknown): string {
  if (typeof stage !== "string") return "—";
  return STAGE_LABELS[stage] ?? stage;
}

function yen(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `¥${n.toLocaleString("ja-JP")}`;
}

export function formatIntegrationNotification(
  event: WebhookEvent,
  data: Record<string, unknown>
): { title: string; body: string } | null {
  switch (event) {
    case "customer.created":
      return {
        title: "BRIDGE: 新規顧客",
        body: `顧客「${data.name ?? "—"}」が登録されました。`,
      };
    case "customer.updated":
      return {
        title: "BRIDGE: 顧客更新",
        body: `顧客「${data.name ?? "—"}」が更新されました。`,
      };
    case "customer.deleted":
      return {
        title: "BRIDGE: 顧客削除",
        body: `顧客「${data.name ?? "—"}」が削除されました。`,
      };
    case "deal.created":
      return {
        title: "BRIDGE: 新規商談",
        body: `商談「${data.title ?? "—"}」が作成されました。\nステージ: ${stageLabel(data.stage)}`,
      };
    case "deal.updated":
      return {
        title: "BRIDGE: 商談更新",
        body: `商談「${data.title ?? "—"}」が更新されました。\nステージ: ${stageLabel(data.stage)}`,
      };
    case "deal.stage_changed":
      return {
        title: "BRIDGE: 商談ステージ変更",
        body: `商談「${data.title ?? "—"}」\n${stageLabel(data.previous_stage)} → ${stageLabel(data.stage)}`,
      };
    case "deal.closed":
      return {
        title: "BRIDGE: 商談クローズ",
        body: `商談「${data.title ?? "—"}」が ${stageLabel(data.stage)} になりました。`,
      };
    case "estimate.created":
      return {
        title: "BRIDGE: 新規見積",
        body: `見積「${data.title ?? "—"}」（${data.estimate_no ?? ""}）\n合計: ${yen(data.total)}`,
      };
    case "estimate.approved":
      return {
        title: "BRIDGE: 見積受理",
        body: `見積「${data.title ?? "—"}」が受理されました。\n合計: ${yen(data.total)}`,
      };
    case "estimate.rejected":
      return {
        title: "BRIDGE: 見積却下",
        body: `見積「${data.title ?? "—"}」が却下されました。`,
      };
    case "contract.created":
      return {
        title: "BRIDGE: 新規契約",
        body: `契約「${data.title ?? "—"}」（${data.contract_no ?? ""}）\n金額: ${yen(data.amount)}`,
      };
    case "contract.signed":
      return {
        title: "BRIDGE: 契約締結",
        body: `契約「${data.title ?? "—"}」が締結されました。\n金額: ${yen(data.amount)}`,
      };
    case "construction.created":
      return {
        title: "BRIDGE: 新規工事",
        body: `工事「${data.title ?? "—"}」（${data.construction_no ?? ""}）が登録されました。`,
      };
    case "construction.started":
      return {
        title: "BRIDGE: 工事着工",
        body: `工事「${data.title ?? "—"}」が着工しました。`,
      };
    case "construction.completed":
      return {
        title: "BRIDGE: 工事完了",
        body: `工事「${data.title ?? "—"}」が完了しました。\n受注金額: ${yen(data.order_amount)}`,
      };
    case "invoice.issued":
      return {
        title: "BRIDGE: 請求書送付",
        body: `請求 ${data.invoice_no ?? "—"} を送付しました。\n合計: ${yen(data.total)}`,
      };
    case "invoice.paid":
      return {
        title: "BRIDGE: 入金確認",
        body: `請求 ${data.invoice_no ?? "—"} の入金を確認しました。\n合計: ${yen(data.total)}`,
      };
    case "workflow.approved":
      return {
        title: "BRIDGE: ワークフロー承認",
        body: `申請「${data.title ?? "—"}」が承認されました。`,
      };
    case "workflow.rejected":
      return {
        title: "BRIDGE: ワークフロー却下",
        body: `申請「${data.title ?? "—"}」が却下されました。`,
      };
    case "announcement.published":
      return {
        title: "BRIDGE: 回覧板投稿",
        body: `「${data.title ?? "—"}」が公開されました。`,
      };
    default:
      return null;
  }
}
