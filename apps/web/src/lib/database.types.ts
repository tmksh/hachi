// Auto-derived TypeScript types matching Supabase schema (00001_initial_schema.sql)

export type Company = {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  company_id: string;
  display_name: string;
  email: string;
  role: 'hq_admin' | 'contractor_admin' | 'employee' | 'admin' | 'executive' | 'sales' | 'field_manager' | 'designer' | 'administration' | 'external_partner';
  avatar_url: string | null;
  department: string | null;
  position: string | null;
  phone: string | null;
  /** 従業員区分（1人当たり利益の係数: full_time=1.0 / part_time=0.5）。マイグレーション未適用環境では undefined */
  employment_type?: 'full_time' | 'part_time';
  created_at: string;
  updated_at: string;
};

export type InboundLead = {
  id: string;
  company_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  inquiry_category: string | null;
  inquiry_content: string | null;
  status: "new" | "in_progress" | "converted" | "discarded";
  assigned_to: string | null;
  customer_id: string | null;
  deal_id: string | null;
  converted_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  assignee?: { id: string; display_name: string } | null;
};

export type Customer = {
  id: string;
  company_id: string;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  source: string | null;
  status: string;
  assigned_to: string | null;
  budget_min: number | null;
  budget_max: number | null;
  ai_score: number | null;
  tags: string[];
  notes: string | null;
  eight_id: string | null;
  customer_type: 'corporation' | 'individual' | null;
  department: string | null;
  age: number | null;
  inquiry_category: string | null;
  inquiry_date: string | null;
  inquiry_content: string | null;
  custom_fields: Record<string, string>;
  line_user_id: string | null;
  slack_channel_id: string | null;
  prospect_grade: 'A' | 'B' | 'C' | null;
  /** 特需（大型案件）。trueの場合はA/B/C一律確度ではなく special_probability を使用 */
  is_special_demand: boolean;
  /** 特需案件の独自確度%（0〜100） */
  special_probability: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Deal = {
  id: string;
  company_id: string;
  customer_id: string;
  title: string;
  stage: 'inquiry' | 'first_meeting' | 'materials_sent' | 'quote_submitted' | 'negotiation' | 'closing' | 'won' | 'lost';
  value: number | null;
  priority: string;
  assigned_to: string | null;
  expected_close_date: string | null;
  department_name: string | null;
  tags: string[];
  next_action: string | null;
  summary: string | null;
  days_in_stage: number;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  assignee?: Profile;
};

export type DealActivity = {
  id: string;
  company_id: string;
  deal_id: string;
  type: string;
  title: string;
  description: string | null;
  performed_by: string | null;
  performed_at: string;
  tags: string[];
  created_at: string;
};

export type Todo = {
  id: string;
  company_id: string;
  customer_id: string | null;
  deal_id: string | null;
  assigned_to: string | null;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  priority: string;
  due_date: string | null;
  tags: string[];
  source: string | null;
  created_at: string;
  updated_at: string;
};

export type Craftsman = {
  id: string;
  company_id: string;
  name: string;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  /** 種別: vendor=実業者（デフォルト）/ system=システム予約（削除・改名不可） */
  kind?: 'vendor' | 'system';
  /** システム予約の識別キー（unregistered=未登録業者 / reserve=予備費）。kind=system のときのみ */
  system_key?: 'unregistered' | 'reserve' | 'management' | null;
  specialty: 'carpenter' | 'electrical' | 'interior' | 'plumbing' | 'general' | null;
  rank: 'A' | 'B' | 'C' | null;
  report_rate: number;
  active_projects: number;
  total_projects: number;
  notes: string | null;
  skills: string[];
  service_areas: string[];
  contract_rate: number | null;
  payment_notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Estimate = {
  id: string;
  company_id: string;
  customer_id: string | null;
  project_id: string | null;
  construction_id: string | null;
  version: number;
  parent_estimate_id: string | null;
  estimate_no: string;
  title: string | null;
  status: 'draft' | 'issued' | 'sent' | 'accepted' | 'rejected';
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  cost_total: number;
  gross_profit: number;
  gross_profit_rate: number;
  reserve_fee_1_rate: number;
  reserve_fee_2_rate: number;
  /** 経営調整費（会社規定%・担当者編集不可）金額。明細外サマリーで記入（旧称: 予備費） */
  reserve_fee_1_amount?: number;
  /** 予備費（担当者がリスク用に計上）金額。明細外サマリーで記入（旧称: 予備予備費） */
  reserve_fee_2_amount?: number;
  default_gross_profit_rate: number;
  /** 事業部門。部門別規定粗利率の判定に使用（No.72） */
  department_name?: string | null;
  validity_date: string | null;
  issued_at: string | null;
  assigned_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  categories?: EstimateCategory[];
  items?: EstimateItem[];
};

/** 部門別規定粗利率マスタ（No.72） */
export type DepartmentMarginRate = {
  id: string;
  company_id: string;
  department_name: string;
  margin_rate_percent: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ChangeOrder = {
  id: string;
  company_id: string;
  construction_id: string;
  estimate_id: string | null;
  title: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'sent';
  before_amount: number;
  after_amount: number;
  diff_amount: number;
  before_items: unknown[];
  after_items: unknown[];
  change_reason: string | null;
  cloudsign_document_id: string | null;
  cloudsign_status: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  creator?: Profile;
};

export type EstimateCategory = {
  id: string;
  company_id: string;
  estimate_id: string;
  name: string;
  sort_order: number;
  reserve_fee_rate?: number;
  /** 大項目の形状・摘要（直接入力）。配下詳細行に金額があれば詳細優先 */
  specification?: string | null;
  /** 大項目の発注業者（業者マスタ参照） */
  vendor_craftsman_id?: string | null;
  /** 大項目の発注業者表示名 */
  vendor_name?: string | null;
  /** 大項目の数量（直接入力） */
  quantity?: number;
  /** 大項目の単位（直接入力） */
  unit?: string | null;
  /** 大項目の原単価（直接入力） */
  cost_price?: number;
  /** 大項目の見積単価（直接入力） */
  selling_price?: number;
  created_at: string;
};

export type EstimateItem = {
  id: string;
  company_id: string;
  estimate_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  specification: string | null;
  quantity: number;
  unit: string | null;
  cost_price: number;
  cost_amount: number;
  selling_price: number;
  selling_amount: number;
  gross_profit: number;
  gross_profit_rate: number;
  sort_order: number;
  notes: string | null;
  /** テキスト行（注釈用・売価ゼロ・計算なし） */
  is_text_row?: boolean;
  /** テキスト行の種類: category=大項目に紐づく / standalone=独立 */
  text_row_scope?: 'category' | 'standalone' | null;
  /** 発注業者（業者マスタ craftsmen 参照）。未登録の自由入力は vendor_name のみ */
  vendor_craftsman_id?: string | null;
  /** 発注業者の表示名 */
  vendor_name?: string | null;
  /** 予備費行（発注業者=システム予約「予備費」）。原価のみ・売価0固定・顧客向けPDF非表示 */
  is_reserve_row?: boolean;
  created_at: string;
  updated_at: string;
};

export type Contract = {
  id: string;
  company_id: string;
  customer_id: string | null;
  estimate_id: string | null;
  contract_no: string;
  title: string;
  status: 'preparing' | 'contracted' | 'executing' | 'completed' | 'cancelled';
  contract_date: string | null;
  start_date: string | null;
  end_date: string | null;
  amount: number;
  assigned_to: string | null;
  progress: number;
  notes: string | null;
  department_name: string | null;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  estimate?: Estimate;
  assignee?: Profile;
};

export type Construction = {
  id: string;
  company_id: string;
  contract_id: string | null;
  construction_no: string;
  customer_id: string | null;
  title: string;
  status: 'preparing' | 'in_progress' | 'completed' | 'suspended' | 'delayed';
  start_date: string | null;
  end_date: string | null;
  order_amount: number;
  order_cost: number;
  budget_cost: number;
  actual_cost: number;
  payment_date: string | null;
  payment_amount: number;
  worker_count: number;
  progress: number;
  assigned_to: string | null;
  department_name: string | null;
  /** 担当拠点（No.80）。拠点別BI集計に使用 */
  location_id?: string | null;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  contract?: Contract;
  assignee?: Profile;
};

export type ConstructionTask = {
  id: string;
  company_id: string;
  construction_id: string;
  parent_task_id: string | null;
  name: string;
  start_date: string | null;
  end_date: string | null;
  progress: number;
  status: string;
  assigned_to: string | null;
  description: string | null;
  contractor_name: string | null;
  depends_on_task_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type PaymentScheduleItem = {
  phase: string;
  rate: number;
  amount: number;
  due_date: string | null;
};

export type ContractorOrder = {
  id: string;
  company_id: string;
  construction_id: string;
  craftsman_id: string | null;
  title: string;
  amount: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  order_date: string | null;
  start_date: string | null;
  end_date: string | null;
  completion_date: string | null;
  payment_date: string | null;
  payment_count: string | null;
  work_content: string | null;
  special_notes: string | null;
  payment_schedule: PaymentScheduleItem[];
  created_at: string;
  updated_at: string;
  craftsman?: { id: string; name: string };
};

export type AttendanceEntry = {
  id: string;
  company_id: string;
  user_id: string;
  work_date: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  leave_type: 'none' | 'overtime' | 'dayoff' | 'morning_leave' | 'afternoon_leave';
  status: 'pending' | 'approved' | 'rejected';
  note: string | null;
  modified_by: string | null;
  modified_reason: string | null;
  created_at: string;
  updated_at: string;
  user?: Profile;
};

export type AttendanceComment = {
  id: string;
  company_id: string;
  entry_id: string;
  user_id: string;
  message: string;
  created_at: string;
};

export type Announcement = {
  id: string;
  company_id: string;
  author_id: string;
  title: string;
  body: string;
  pinned: boolean;
  is_urgent: boolean;
  target_type: 'all' | 'roles' | 'departments' | 'individuals';
  target_roles: string[];
  target_departments: string[];
  target_user_ids: string[];
  due_date: string | null;
  published_at: string;
  created_at: string;
  updated_at: string;
  author?: Profile;
};

export type AnnouncementRead = {
  company_id: string;
  announcement_id: string;
  user_id: string;
  read_at: string;
};

export type AnnouncementComment = {
  id: string;
  company_id: string;
  announcement_id: string;
  user_id: string;
  message: string;
  created_at: string;
  user?: Profile;
};

export type WorkflowType = {
  id: string;
  company_id: string;
  key: 'expense' | 'leave' | 'purchase' | 'custom';
  name: string;
  schema: Record<string, unknown>;
  created_at: string;
};

export type WorkflowRequest = {
  id: string;
  company_id: string;
  type_id: string;
  requester_id: string;
  title: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'cancelled';
  payload: Record<string, unknown>;
  amount: number | null;
  is_urgent: boolean;
  due_date: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
  requester?: Profile;
  workflow_type?: WorkflowType;
  steps?: WorkflowStep[];
};

export type WorkflowStep = {
  id: string;
  company_id: string;
  request_id: string;
  step_order: number;
  approver_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  comment: string | null;
  decided_at: string | null;
  created_at: string;
  approver?: Profile;
};

export type EmailAccount = {
  id: string;
  company_id: string;
  user_id: string;
  provider: string;
  email_address: string;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
};

export type EmailThread = {
  id: string;
  company_id: string;
  account_id: string;
  external_thread_id: string | null;
  subject: string | null;
  snippet: string | null;
  is_read: boolean;
  is_starred: boolean;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  messages?: EmailMessage[];
};

export type EmailMessage = {
  id: string;
  company_id: string;
  thread_id: string;
  external_message_id: string | null;
  from_address: string | null;
  from_name: string | null;
  to_addresses: Array<{ name?: string; address: string }>;
  cc_addresses: Array<{ name?: string; address: string }>;
  bcc_addresses: Array<{ name?: string; address: string }>;
  subject: string | null;
  snippet: string | null;
  body_text: string | null;
  body_html: string | null;
  has_attachment: boolean;
  received_at: string | null;
  direction: 'inbound' | 'outbound' | null;
  created_at: string;
};

export type CalendarEvent = {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  category: 'sales' | 'construction' | 'task' | 'facility' | 'equipment' | null;
  color: string | null;
  location: string | null;
  customer_id: string | null;
  assigned_to: string | null;
  shared_with?: string[] | null;
  google_event_id: string | null;
  google_calendar_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  customer?: Customer;
};

export type Document = {
  id: string;
  company_id: string;
  name: string;
  category: 'rules' | 'hr' | 'accounting' | 'safety' | 'other' | null;
  description: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size: number;
  customer_id: string | null;
  construction_id: string | null;
  uploaded_by: string | null;
  share_token: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  uploader?: Profile;
  customer?: { id: string; name: string } | null;
};

export type Invoice = {
  id: string;
  company_id: string;
  construction_id: string | null;
  customer_id: string | null;
  invoice_no: string | null;
  recipient: string | null;
  invoice_date: string | null;
  due_date: string | null;
  payment_terms: string | null;
  subtotal: number;
  tax: number;
  total: number;
  status: 'draft' | 'sent' | 'paid' | 'cancelled';
  notes: string | null;
  paid_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  items?: InvoiceItem[];
  customer?: Customer;
  construction?: Construction;
};

export type InvoiceItem = {
  id: string;
  company_id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  sort_order: number;
  created_at: string;
};

export type Budget = {
  id: string;
  company_id: string;
  fiscal_year: number;
  branch: string | null;
  target_revenue: number;
  status: 'draft' | 'approved';
  created_by: string | null;
  created_at: string;
  updated_at: string;
  items?: BudgetItem[];
};

export type BudgetItem = {
  id: string;
  company_id: string;
  budget_id: string;
  category: 'revenue' | 'direct_cost' | 'indirect_cost' | null;
  name: string;
  amount: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type InternalMessage = {
  id: string;
  company_id: string;
  sender_id: string;
  recipient_id: string | null;
  content: string;
  message_type: 'chat' | 'followup_inquiry';
  related_customer_id: string | null;
  related_deal_id: string | null;
  read_at: string | null;
  created_at: string;
  sender?: { id: string; display_name: string; avatar_url: string | null };
  recipient?: { id: string; display_name: string; avatar_url: string | null } | null;
  related_customer?: { id: string; name: string } | null;
};

// ── 決算書（財務諸表）関連: 00069_financial_statements.sql ──────────────

/** PL区分（No.87 勘定科目マスタの第1階層） */
export type FinancialAccountSection =
  | 'revenue'
  | 'cogs'
  | 'sga'
  | 'non_operating_income'
  | 'non_operating_expense';

/** 製造原価報告書のサブ区分（No.90: 材料費/労務費/製造経費。outsourcing は旧互換） */
export type FinancialCogsCategory = 'material' | 'labor' | 'outsourcing' | 'expense';

/** 製造原価の加減算ロール（No.90） */
export type FinancialFormulaRole =
  | 'begin_material'
  | 'material_purchase'
  | 'end_material'
  | 'begin_wip'
  | 'end_wip';

export type FinancialAccountItem = {
  id: string;
  company_id: string;
  section: FinancialAccountSection;
  cogs_category: FinancialCogsCategory | null;
  /** 棚卸・仕掛の加減算ロール（No.90） */
  formula_role?: FinancialFormulaRole | null;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type FinancialStatement = {
  id: string;
  company_id: string;
  /** 決算期の開始年（西暦） */
  fiscal_year: number;
  /** 決算期の開始月（1〜12） */
  start_month: number;
  /** 自動生成ラベル（例: 2025年8月〜2026年7月期）手入力禁止（No.104） */
  period_label: string;
  status: 'draft' | 'final';
  finalized_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  lines?: FinancialStatementLine[];
};

export type FinancialStatementLine = {
  id: string;
  company_id: string;
  statement_id: string;
  account_item_id: string;
  budget_amount: number;
  actual_amount: number;
  prior_actual_amount: number;
  variance_note: string | null;
  created_at: string;
  updated_at: string;
  account_item?: FinancialAccountItem;
};

export type FinancialReportSettings = {
  company_id: string;
  /** 実績列の見出しラベル（No.101 例: 実績（弥生）） */
  actual_column_label: string;
  /** 決算期の期首日 1〜28（No.104）。例: 21 → 3/21開始 */
  period_start_day?: number;
  created_at: string;
  updated_at: string;
};
