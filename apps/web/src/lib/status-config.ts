export const STATUS_LABELS: Record<string, string> = {
  draft: "下書き",
  pending: "承認待ち",
  approved: "承認済み",
  rejected: "却下",
  returned: "差戻し",
  submitted: "提出済み",
  cancelled: "キャンセル",
  active: "有効",
  completed: "完了",
  preparing: "準備中",
  contracted: "契約済み",
  executing: "履行中",
  in_progress: "進行中",
  suspended: "中断",
  delayed: "遅延",
  issued: "発行済み",
  sent: "送付済み",
  accepted: "受理",
  paid: "入金済み",
  none: "未申請",
  conditional: "条件付き承認",
};

export type StatusEntity =
  | "estimate"
  | "contract"
  | "construction"
  | "invoice"
  | "workflow";

export type StatusOption = {
  value: string;
  label: string;
  color: string;
};

export const ENTITY_STATUS_OPTIONS: Record<StatusEntity, StatusOption[]> = {
  estimate: [
    { value: "draft", label: "下書き", color: "text-muted-foreground" },
    { value: "issued", label: "発行済み", color: "text-blue-600" },
    { value: "sent", label: "送付済み", color: "text-blue-600" },
    { value: "accepted", label: "受理", color: "text-emerald-600" },
    { value: "rejected", label: "却下", color: "text-rose-500" },
  ],
  contract: [
    { value: "preparing", label: "準備中", color: "text-orange-600" },
    { value: "contracted", label: "契約済み", color: "text-blue-600" },
    { value: "executing", label: "履行中", color: "text-blue-600" },
    { value: "completed", label: "完了", color: "text-emerald-600" },
    { value: "cancelled", label: "キャンセル", color: "text-muted-foreground" },
  ],
  construction: [
    { value: "preparing", label: "準備中", color: "text-orange-600" },
    { value: "in_progress", label: "進行中", color: "text-blue-600" },
    { value: "completed", label: "完了", color: "text-emerald-600" },
    { value: "suspended", label: "中断", color: "text-amber-600" },
    { value: "delayed", label: "遅延", color: "text-rose-500" },
  ],
  invoice: [
    { value: "draft", label: "下書き", color: "text-muted-foreground" },
    { value: "sent", label: "送付済み", color: "text-blue-600" },
    { value: "paid", label: "入金済み", color: "text-emerald-600" },
    { value: "cancelled", label: "キャンセル", color: "text-rose-500" },
  ],
  workflow: [
    { value: "draft", label: "下書き", color: "text-muted-foreground" },
    { value: "submitted", label: "申請中", color: "text-blue-600" },
    { value: "approved", label: "承認済み", color: "text-emerald-600" },
    { value: "rejected", label: "却下", color: "text-rose-500" },
    { value: "returned", label: "差戻し", color: "text-amber-600" },
    { value: "cancelled", label: "キャンセル", color: "text-muted-foreground" },
  ],
};

export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

/** ワークフロー申請の表示用ラベル（差戻しと却下を区別） */
export function getWorkflowStatusLabel(
  status: string,
  payload?: Record<string, unknown> | null,
): string {
  if (status === "rejected" && payload?.remand) return "差戻し";
  return getStatusLabel(status);
}

export function isWorkflowRemanded(
  status: string,
  payload?: Record<string, unknown> | null,
): boolean {
  return status === "rejected" && Boolean(payload?.remand);
}

export function getStatusOption(
  entity: StatusEntity,
  status: string,
): StatusOption | undefined {
  return ENTITY_STATUS_OPTIONS[entity].find((o) => o.value === status);
}
