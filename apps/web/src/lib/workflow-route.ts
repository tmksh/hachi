import { ROLE_LABELS, type Role } from "@/lib/constants";

/**
 * ワークフロー承認ルートの1ステップ。
 * - approver_id: 特定メンバーを指名
 * - approver_role / approver_department: ユーザー属性（例: 営業トップ＝ role=sales & department=営業部）で指名。
 *   申請時点で条件に合うメンバーへ解決する（人事異動があってもルート定義を直さなくてよい）。
 */
export type ApprovalStep = {
  step_order: number;
  approver_id?: string | null;
  approver_role?: string | null;
  approver_department?: string | null;
  /** 属性指名の表示名（例: 営業トップ）。未設定ならロール/部署名から生成 */
  label?: string | null;
};

export type FieldDef = {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "textarea" | "select";
  required?: boolean;
  options?: string[];
};

export type RouteProfile = {
  id: string;
  display_name?: string | null;
  role?: string | null;
  department?: string | null;
};

export function isAttributeStep(step: ApprovalStep): boolean {
  return !step.approver_id && Boolean(step.approver_role || step.approver_department);
}

/** DB(jsonb) から読んだ値を安全に配列化して step_order 順に並べる */
export function normalizeApprovalRoute(route: unknown): ApprovalStep[] {
  if (!Array.isArray(route)) return [];
  return (route as ApprovalStep[])
    .filter((s) => s && (typeof s.approver_id === "string" && s.approver_id || s.approver_role || s.approver_department))
    .map((s, i) => ({ ...s, step_order: Number(s.step_order ?? i + 1) }))
    .sort((a, b) => a.step_order - b.step_order);
}

export function roleLabel(role: string | null | undefined): string {
  if (!role) return "";
  return ROLE_LABELS[role as Role] ?? role;
}

/** ステップの表示名（設定画面・申請画面で共通） */
export function describeStep(step: ApprovalStep, profiles: RouteProfile[]): string {
  if (step.approver_id) {
    const p = profiles.find((x) => x.id === step.approver_id);
    return p?.display_name ?? "不明";
  }
  if (step.label) return step.label;
  const parts = [step.approver_department, roleLabel(step.approver_role)].filter(Boolean);
  return parts.length ? parts.join(" / ") : "（未設定）";
}

/** 属性ステップに該当するメンバー一覧 */
export function matchProfiles(step: ApprovalStep, profiles: RouteProfile[]): RouteProfile[] {
  return profiles
    .filter((p) => {
      if (step.approver_role && p.role !== step.approver_role) return false;
      if (step.approver_department && (p.department ?? "").trim() !== step.approver_department.trim()) return false;
      return true;
    })
    .sort((a, b) => (a.display_name ?? "").localeCompare(b.display_name ?? "", "ja"));
}

export type ResolvedRoute = {
  approverIds: string[];
  /** 該当メンバーがいなかった属性ステップ */
  unresolved: ApprovalStep[];
  /** step ごとの解決結果（画面表示用） */
  steps: Array<{ step: ApprovalStep; approverId: string | null; displayName: string }>;
};

/**
 * ルート定義を実際の承認者IDへ解決する。
 * 属性ステップは条件一致メンバーの先頭（申請者本人・既出の承認者は可能なら除外）を採用。
 */
export function resolveApprovalRoute(
  route: unknown,
  profiles: RouteProfile[],
  opts: { excludeUserId?: string | null } = {},
): ResolvedRoute {
  const stepsIn = normalizeApprovalRoute(route);
  const used = new Set<string>();
  const unresolved: ApprovalStep[] = [];
  const steps: ResolvedRoute["steps"] = [];

  for (const step of stepsIn) {
    let approverId: string | null = null;
    if (step.approver_id) {
      approverId = step.approver_id;
    } else {
      const candidates = matchProfiles(step, profiles);
      const preferred =
        candidates.find((c) => c.id !== opts.excludeUserId && !used.has(c.id))
        ?? candidates.find((c) => !used.has(c.id))
        ?? candidates[0]
        ?? null;
      approverId = preferred?.id ?? null;
      if (!approverId) unresolved.push(step);
    }
    if (approverId) used.add(approverId);
    const displayName = approverId
      ? (profiles.find((p) => p.id === approverId)?.display_name ?? "不明")
      : `${describeStep(step, profiles)}（該当者なし）`;
    steps.push({ step, approverId, displayName });
  }

  return {
    approverIds: [...new Set(steps.map((s) => s.approverId).filter((id): id is string => Boolean(id)))],
    unresolved,
    steps,
  };
}
