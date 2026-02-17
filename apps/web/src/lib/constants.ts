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
      { key: "deals", label: "パイプライン", href: "/deals" },
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
  {
    key: "marketing",
    label: "マーケティング",
    items: [
      { key: "marketing-email", label: "メール配信", href: "/marketing/email" },
      { key: "marketing-sns", label: "SNSインサイト", href: "/marketing/sns" },
      { key: "marketing-roi", label: "ROI分析", href: "/marketing/roi" },
    ],
  },
] as const;

// User roles
export const ROLES = {
  OWNER: "owner",
  HQ_ADMIN: "hq_admin",
  CONTRACTOR_ADMIN: "contractor_admin",
  EMPLOYEE: "employee",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

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
} as const;
