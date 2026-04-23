// Auto-derived TypeScript types matching Supabase schema (00001_initial_schema.sql)

export type Company = {
  id: string;
  name: string;
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
  role: 'owner' | 'hq_admin' | 'contractor_admin' | 'employee';
  avatar_url: string | null;
  department: string | null;
  position: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
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
  tags: string[];
  next_action: string | null;
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
  specialty: 'carpenter' | 'electrical' | 'interior' | 'plumbing' | 'general' | null;
  rank: 'A' | 'B' | 'C' | null;
  report_rate: number;
  active_projects: number;
  total_projects: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Estimate = {
  id: string;
  company_id: string;
  customer_id: string | null;
  project_id: string | null;
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

export type EstimateCategory = {
  id: string;
  company_id: string;
  estimate_id: string;
  name: string;
  sort_order: number;
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
  sort_order: number;
  created_at: string;
  updated_at: string;
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
  created_at: string;
  updated_at: string;
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
  uploaded_by: string | null;
  share_token: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  uploader?: Profile;
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
  status: 'draft' | 'sent' | 'paid';
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
