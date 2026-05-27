// Navigation structure matching BRIDGE prototype
export const NAV_GROUPS = [
  {
    key: "dashboard",
    label: "ダッシュボード",
    items: [
      { key: "dashboard", label: "ダッシュボード", href: "/dashboard" },
      { key: "bi", label: "BIダッシュボード", href: "/bi" },
    ],
  },
  {
    key: "lead",
    label: "リード",
    items: [
      { key: "crm", label: "顧客・商談管理", href: "/crm" },
      { key: "quotes", label: "見積管理", href: "/quotes" },
      { key: "craftsmen", label: "職人管理", href: "/craftsmen" },
    ],
  },
  {
    key: "production",
    label: "生産",
    items: [
      { key: "contracts", label: "契約管理", href: "/contracts" },
      { key: "constructions", label: "工事管理", href: "/constructions" },
    ],
  },
  {
    key: "admin",
    label: "管理",
    items: [
      { key: "admin-settings", label: "管理者設定", href: "/settings" },
    ],
  },
  {
    key: "portal",
    label: "ポータル",
    items: [
      { key: "calendar", label: "カレンダー", href: "/calendar" },
      { key: "mail", label: "メール", href: "/mail" },
      { key: "attendance", label: "勤怠", href: "/attendance" },
      { key: "workflow", label: "ワークフロー", href: "/workflow" },
      { key: "circulation", label: "回覧", href: "/circulation" },
      { key: "documents", label: "文書管理", href: "/documents" },
    ],
  },
  // マーケティンググループ: フェーズ2で公開予定のため現在は非表示
  // {
  //   key: "marketing",
  //   label: "マーケティング",
  //   items: [
  //     { key: "marketing-email", label: "メール配信", href: "/marketing/email" },
  //     { key: "marketing-sns", label: "SNSインサイト", href: "/marketing/sns" },
  //     { key: "marketing-roi", label: "ROI分析", href: "/marketing/roi" },
  //     { key: "marketing-creative", label: "クリエイティブ", href: "/marketing/creative" },
  //   ],
  // },
] as const;

// User roles（議事録: オーナーロール廃止 → 本部管理者が最上位）
export const ROLES = {
  HQ_ADMIN: "hq_admin",
  CONTRACTOR_ADMIN: "contractor_admin",
  EMPLOYEE: "employee",
  ADMIN: "admin",
  EXECUTIVE: "executive",
  SALES: "sales",
  FIELD_MANAGER: "field_manager",
  DESIGNER: "designer",
  ADMINISTRATION: "administration",
  EXTERNAL_PARTNER: "external_partner",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** 管理者ロール（設定変更・メンバー管理可能） */
export const ADMIN_ROLES: Role[] = ["hq_admin", "admin"];

/**
 * Route prefix → 許可するロール一覧 (未定義 = 全ロール許可)
 * ミドルウェアとクライアントで共有する。
 */
export const ROUTE_ROLES: Record<string, Role[]> = {
  "/bi":          ["hq_admin", "contractor_admin"],
  "/crm":         ["hq_admin", "contractor_admin"],
  "/deals":       ["hq_admin", "contractor_admin"],
  "/quotes":      ["hq_admin", "contractor_admin"],
  "/craftsmen":   ["hq_admin", "contractor_admin"],
  "/contracts":   ["hq_admin", "contractor_admin", "admin", "sales"],
  "/marketing":   [],
};

/** CSV定義ロールラベル（37–43） */
export const CSV_ROLE_LABELS: Record<string, string> = {
  admin: "管理者（Admin）",
  executive: "経営層（Executive）",
  sales: "営業（Sales）",
  field_manager: "現場担当（Field Manager）",
  designer: "設計士（Designer）",
  administration: "総務（Administration）",
  external_partner: "外部協力業者",
  hq_admin: "本部管理者",
  contractor_admin: "施工店管理者",
  employee: "社員",
};

/** ナビ項目キー → 許可するロール一覧 (未定義 = 全ロール許可) */
export const NAV_ITEM_ROLES: Record<string, Role[]> = {
  bi:                 ["hq_admin", "contractor_admin"],
  crm:                ["hq_admin", "contractor_admin"],
  deals:              ["hq_admin", "contractor_admin"],
  quotes:             ["hq_admin", "contractor_admin"],
  craftsmen:          ["hq_admin", "contractor_admin"],
  contracts:          ["hq_admin", "contractor_admin", "admin", "sales"],
  "admin-settings":   ["hq_admin", "admin"],
  "marketing-email":  ["hq_admin"],
  "marketing-sns":    ["hq_admin"],
  "marketing-roi":    ["hq_admin"],
  "marketing-creative": ["hq_admin"],
};

/** ナビ項目にアクセスできるか */
export function canAccessNavItem(key: string, role: Role): boolean {
  const allowed = NAV_ITEM_ROLES[key];
  if (!allowed) return true;
  return allowed.includes(role);
}

/** パスにアクセスできるか (ミドルウェアとページ共通ヘルパー) */
export function canAccessRoute(pathname: string, role: Role): boolean {
  const matched = Object.keys(ROUTE_ROLES).find((p) => pathname.startsWith(p));
  if (!matched) return true;
  const allowed = ROUTE_ROLES[matched];
  if (allowed.length === 0) return false;
  return allowed.includes(role);
}

export const ROLE_LABELS: Record<Role, string> = {
  hq_admin:         "本部管理者",
  contractor_admin: "施工店管理者",
  employee:         "社員",
  admin:            "管理者",
  executive:        "経営層",
  sales:            "営業",
  field_manager:    "現場担当",
  designer:         "設計士",
  administration:   "総務",
  external_partner: "外部協力業者",
};

// Departments
export const DEPARTMENTS = {
  sales: "営業部",
  engineering: "開発部",
  hr: "人事部",
  finance: "財務部",
  general: "総務部",
  construction: "工事部",
} as const;

export type Department = keyof typeof DEPARTMENTS;

// Attendance leave types
export const LEAVE_TYPES = {
  none: "なし",
  overtime: "残業",
  dayoff: "休日",
  morning_leave: "午前休",
  afternoon_leave: "午後休",
} as const;

// Workflow types
export const WORKFLOW_TYPES = {
  expense: "経費申請",
  leave: "休暇申請",
  purchase: "購入申請",
  custom: "その他",
} as const;

// Status colors
export const STATUS_COLORS = {
  draft: "bg-muted text-muted-foreground",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  cancelled: "bg-muted text-muted-foreground",
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  preparing: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  contracted: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  executing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  suspended: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  delayed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  issued: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
} as const;
