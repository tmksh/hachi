/** Linq AI 連携の型定義（営業フロー 1-2〜1-7） */

export type LinqResultSource = "linq" | "heuristic" | "stub";

export type LinqResultMeta = {
  source: LinqResultSource;
  /** 本番 LLM/API 接続済みか */
  productionReady: boolean;
  model?: string;
  latencyMs?: number;
};

// --- 1-2 問い合わせ受付〜商談化 ---

export type InquiryChannel = "email" | "web_form" | "instagram" | "phone";

export type AppointmentParseResult = LinqResultMeta & {
  hasAppointment: boolean;
  mode: "single" | "multiple" | "unknown";
  candidates: Array<{ datetime: string; label: string; confidence: number }>;
};

export type LeadAssignCandidate = {
  profileId: string;
  displayName: string;
  score: number;
  reasons: string[];
};

export type LeadAssignResult = LinqResultMeta & {
  candidates: LeadAssignCandidate[];
  recommendedId: string | null;
};

export type FollowUpEmailRequest = {
  customerName: string;
  inquiryContent: string;
  templateId?: string;
  tone?: "formal" | "friendly";
};

export type FollowUpEmailResult = LinqResultMeta & {
  subject: string;
  body: string;
};

// --- 1-3 商談進捗管理 ---

export type MeetingSummaryInput = {
  customerId: string;
  dealId?: string;
  transcript: string;
  memo?: string;
};

export type MeetingSummaryResult = LinqResultMeta & {
  title: string;
  summary: string;
  keyPoints: string[];
  customerUpdates: Array<{ field: string; value: string; reason: string }>;
  todos: Array<{ title: string; dueDate?: string; priority: "high" | "medium" | "low" }>;
};

export type StageTransitionProposal = LinqResultMeta & {
  currentStage: string;
  proposedStage: string;
  confidence: number;
  reason: string;
};

// --- 1-4 見積作成 ---

export type EstimateDraftItem = {
  categoryName: string;
  name: string;
  quantity: number;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  specification?: string;
};

export type EstimateDraftResult = LinqResultMeta & {
  title: string;
  items: EstimateDraftItem[];
  notes: string;
};

// --- 1-5 上長承認 ---

export type ApprovalSupportResult = LinqResultMeta & {
  similarEstimates: Array<{ id: string; title: string; grossProfitRate: number; total: number }>;
  analysis: string;
  recommendation: "approve" | "conditional" | "return" | "reject";
  suggestedComment?: string;
};

// --- 1-6 受注〜工事引き継ぎ ---

export type DurationEstimateResult = LinqResultMeta & {
  startDate: string;
  endDate: string;
  workingDays: number;
  reason: string;
};

export type AssigneeCandidate = {
  profileId: string;
  displayName: string;
  score: number;
  reasons: string[];
  currentLoad: number;
};

export type AssigneeRecommendResult = LinqResultMeta & {
  candidates: AssigneeCandidate[];
  recommendedId: string | null;
};

// --- 1-7 契約書 ---

export type ContractFieldMapping = {
  fieldKey: string;
  value: string;
  source: "customer" | "deal" | "estimate" | "recording" | "manual";
};

export type ContractAutoFillResult = LinqResultMeta & {
  fields: ContractFieldMapping[];
};

export type EsignMessageResult = LinqResultMeta & {
  subject: string;
  body: string;
};

export type CommunicationAgreementItem = {
  messageId: string;
  summary: string;
  confidence: number;
};

export type CommunicationAgreementResult = LinqResultMeta & {
  items: CommunicationAgreementItem[];
};

/** 将来の LLM プロバイダ設定 */
export type LinqAiConfig = {
  enabled: boolean;
  provider?: "openai" | "anthropic" | "google" | "azure";
  apiKey?: string;
  model?: string;
  /** STT プロバイダ（録音文字起こし） */
  sttProvider?: "whisper" | "google_speech" | "web_speech";
};
