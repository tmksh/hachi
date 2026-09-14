"use client";

import { useState, useEffect, useMemo, useCallback, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CustomerInfoPanel } from "@/components/crm/customer-info-panel";
import { CustomerFilesTab, CUSTOMER_DOCUMENTS_DESCRIPTION } from "@/components/crm/customer-files-tab";
import { CustomerAvatar } from "@/components/shared/customer-avatar";
import { ContractMessagingTab } from "@/components/contracts/contract-messaging-tab";
import { ContractWorkflowTab } from "@/components/contracts/contract-workflow-tab";
import {
  sendContractCloudSign, generateContractEsignMessage,
  createEmptyEstimateForContract, copyEstimateForContract,
  getContractApprovalWorkflowTypes, getContractWorkflowRequests, submitContractWorkflow,
  type ContractApprovalWorkflowType,
} from "@/lib/actions/contract-features";
import { fetchContractEstimates, fetchEstimate } from "@/lib/queries/details";
import { Calendar, FileText, RefreshCw, Download, Loader2, RotateCcw, FolderOpen, CheckCircle2, Sparkles, Lock } from "lucide-react";
import { toast } from "sonner";
import type { ContractDetail } from "./contract-detail-types";
import { EstimateDetailView, type EstimateForView } from "@/components/estimate/estimate-detail-view";
import { EstimateListView, type EstimateListItem } from "@/components/estimate/estimate-list-view";
import { CreateEstimateDialog } from "@/components/estimate/create-estimate-dialog";
import { StatusSelect } from "@/components/shared/status-select";
import { Label } from "@/components/ui/label";
import { updateContract } from "@/lib/actions/contracts";
import { CONTRACT_TEMPLATES, buildDefaults, renderPreview, mergeDefaults, syncFromContext, prepareFormForOutput, resolveCompanyContext, type FormValues, type RenderContext } from "@/lib/contract-templates";
import { ContractDocumentEditorLayout } from "@/components/contracts/contract-document-editor-layout";
import { fetchCompany } from "@/lib/queries/portal";
import { resolvePdfTemplates, type PdfTemplate } from "@/lib/pdf-template";
import { TemplatePicker } from "@/components/contracts/contract-doc-editor-parts";
import { fetchPdfFormTemplates } from "@/lib/queries/portal";
import { buildFillContext, type PdfFormTemplate } from "@/lib/pdf-form-template";
import { PdfFormFillerPanel } from "@/components/settings/pdf-form-filler";
import { ContractPdfTemplatePicker } from "@/components/contracts/contract-pdf-template-picker";
import { cn } from "@/lib/utils";
import { buildContractPrintHtml } from "@/lib/contract-pdf";

const VALID_TABS = ["customer", "messaging", "documents", "workflow", "esign", "files", "estimates"] as const;

/** 社内承認完了後（または契約進行中）は電子契約タブを開放（仕様 Step18 / No.88） */
function isEsignUnlockedByContractStatus(status: string | null | undefined): boolean {
  const s = (status ?? "").toLowerCase();
  return s === "contracted" || s === "executing" || s === "completed";
}

export function ContractDetailTabs({
  data,
  contractId,
  onRefresh,
}: {
  data: ContractDetail;
  contractId: string;
  onRefresh?: () => void;
}) {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const defaultTab = VALID_TABS.includes(initialTab as typeof VALID_TABS[number])
    ? (initialTab as typeof VALID_TABS[number])
    : "customer";

  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [, startTransition] = useTransition();
  /** WF承認済みフラグ（非同期）。ステータス開放とは OR で合成する */
  const [wfApproved, setWfApproved] = useState(false);
  const [wfPending, setWfPending] = useState(false);

  const statusUnlocksEsign = isEsignUnlockedByContractStatus(data.status);
  const cloudsignUnlocksEsign = Boolean(
    (data as { cloudsign_document_id?: string | null }).cloudsign_document_id
    || (data as { cloudsign_status?: string | null }).cloudsign_status,
  );
  // ステータスは同期で即判定。WF取得失敗でロックし直さない（No.88 / No.90 ブロック解消）
  const esignEnabled = statusUnlocksEsign || cloudsignUnlocksEsign || wfApproved;
  const esignLockReason = esignEnabled
    ? null
    : wfPending
      ? "社内承認が完了するまで電子契約タブはロックされています。"
      : "社内承認ワークフローを完了すると、電子契約タブが利用できるようになります。";

  useEffect(() => {
    if (initialTab && VALID_TABS.includes(initialTab as typeof VALID_TABS[number])) {
      setActiveTab(initialTab as typeof VALID_TABS[number]);
    }
  }, [initialTab]);

  useEffect(() => {
    let cancelled = false;
    getContractWorkflowRequests(contractId)
      .then((rows) => {
        if (cancelled) return;
        setWfApproved(rows.some((r) => r.status === "approved"));
        setWfPending(rows.some((r) => r.status === "submitted"));
      })
      .catch(() => {
        if (cancelled) return;
        setWfApproved(false);
        setWfPending(false);
      });
    return () => { cancelled = true; };
  }, [contractId, data.updated_at, data.status]);

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => {
        startTransition(() => setActiveTab(v));
      }}
    >
      <TabsList className="flex w-full overflow-x-auto h-auto flex-wrap gap-0.5">
        <TabsTrigger value="customer" className="text-xs">顧客情報</TabsTrigger>
        <TabsTrigger value="messaging" className="text-xs">やり取り管理</TabsTrigger>
        <TabsTrigger value="documents" className="text-xs">書類作成</TabsTrigger>
        <TabsTrigger value="workflow" className="text-xs">承認WF</TabsTrigger>
        <TabsTrigger
          value="esign"
          className={cn("text-xs gap-1", !esignEnabled && "opacity-60")}
        >
          {!esignEnabled && <Lock className="h-3 w-3" />}
          電子契約
        </TabsTrigger>
        <TabsTrigger value="files" className="text-xs gap-1.5"><FolderOpen className="h-3.5 w-3.5" />ドキュメント一覧</TabsTrigger>
        <TabsTrigger value="estimates" className="text-xs">見積もり</TabsTrigger>
      </TabsList>
      <TabsContent value="customer" className="mt-4">
        <CustomerTab data={data} contractId={contractId} onRefresh={onRefresh} />
      </TabsContent>
      <TabsContent value="messaging" className="mt-4">
        <ContractMessagingTab contractId={contractId} customerId={data.customer_id} />
      </TabsContent>
      <TabsContent value="documents" className="mt-4">
        <DocumentsTab contractId={contractId} data={data} onRefresh={onRefresh} />
      </TabsContent>
      <TabsContent value="workflow" className="mt-4">
        <ContractWorkflowTab
          contractId={contractId}
          data={data}
          onRefresh={onRefresh}
          onEsignEnabled={() => setWfApproved(true)}
        />
      </TabsContent>
      <TabsContent value="esign" className="mt-4">
        {esignEnabled
          ? <EsignTab contractId={contractId} customerEmail={data.customer?.email} customerName={data.customer?.name} contractTitle={data.title} />
          : (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground space-y-3">
                <p className="flex items-center gap-2">
                  <Lock className="h-4 w-4 shrink-0" />
                  {esignLockReason}
                </p>
                <p className="text-xs pl-6">
                  承認WFタブから申請し、全ステップの承認が完了すると送信フォーム（テンプレート／Linq自動生成／手動入力）が利用できます。
                </p>
                <div className="pl-6">
                  <Button size="sm" variant="outline" onClick={() => setActiveTab("workflow")}>
                    承認WFタブを開く
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
      </TabsContent>
      <TabsContent value="files" className="mt-4"><FilesTab contractId={contractId} customerId={data.customer_id} /></TabsContent>
      <TabsContent value="estimates" className="mt-4">
        <EstimatesTab
          contractId={contractId}
          pdfCustomer={data.customer ? {
            name: data.customer.name,
            company_name: data.customer.company_name,
            customer_type: data.customer.customer_type,
            notes: data.customer.notes,
          } : null}
        />
      </TabsContent>
    </Tabs>
  );
}

function CustomerTab({
  data,
  contractId,
  onRefresh,
}: {
  data: ContractDetail;
  contractId: string;
  onRefresh?: () => void;
}) {
  const linkedEstimate = (data as ContractDetail & {
    estimate?: { id: string; estimate_no: string; title: string | null; total: number } | null;
    estimate_id?: string | null;
  }).estimate;

  const [status, setStatus] = useState(data.status);
  const [estimateId, setEstimateId] = useState(data.estimate_id ?? "");
  const [estimateOptions, setEstimateOptions] = useState<
    { id: string; estimate_no: string; title: string | null; total: number }[]
  >([]);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    setStatus(data.status);
    setEstimateId(data.estimate_id ?? "");
  }, [data.status, data.estimate_id]);

  useEffect(() => {
    fetchContractEstimates(contractId)
      .then((rows) =>
        setEstimateOptions(
          rows.map((r) => ({
            id: r.id,
            estimate_no: r.estimate_no,
            title: r.title,
            total: r.total ?? 0,
          })),
        ),
      )
      .catch(() => {});
  }, [contractId]);

  const patchContract = async (
    patch: Parameters<typeof updateContract>[1],
    field: string,
  ) => {
    setUpdating(field);
    try {
      await updateContract(contractId, patch);
      onRefresh?.();
      toast.success("契約情報を更新しました");
    } catch {
      setStatus(data.status);
      setEstimateId(data.estimate_id ?? "");
      toast.error("更新に失敗しました");
    } finally {
      setUpdating(null);
    }
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
    void patchContract({ status: value as ContractDetail["status"] }, "status");
  };

  const handleEstimateChange = (value: string) => {
    const id = value === "_none" ? "" : value;
    const selected = estimateOptions.find((e) => e.id === id);
    setEstimateId(id);
    void patchContract(
      {
        estimate_id: id || null,
        ...(selected?.total != null ? { amount: selected.total } : {}),
      },
      "estimate",
    );
  };

  const selectedEstimate =
    estimateOptions.find((e) => e.id === estimateId) ??
    (linkedEstimate && estimateId === linkedEstimate.id ? linkedEstimate : null);

  return (
    <div className="space-y-6">
      <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">契約基本情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.customer && (
              <div className="flex items-center gap-3 pb-4 border-b border-border/50">
                <CustomerAvatar seed={data.customer.id} name={data.customer.name} size="sm" className="h-9 w-9" />
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{data.customer.name}</p>
                  <p className="text-xs text-muted-foreground">{data.customer.company_name ?? "個人"}</p>
                </div>
              </div>
            )}
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground flex items-center gap-1.5 shrink-0">
                  <FileText className="h-3.5 w-3.5" />件名
                </dt>
                <dd className="font-medium text-right">{data.title}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />契約日
                </dt>
                <dd className="tabular-nums">{data.contract_date ?? "-"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />工期
                </dt>
                <dd className="tabular-nums">{data.start_date ?? "-"} ~ {data.end_date ?? "-"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">進捗</dt>
                <dd>{data.progress ?? 0}%</dd>
              </div>
              <div className="flex justify-between items-center gap-3">
                <dt className="text-muted-foreground">契約金額</dt>
                <dd className="font-semibold tabular-nums">¥{(data.amount ?? 0).toLocaleString()}</dd>
              </div>
            </dl>

            <div className="pt-4 border-t space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">ステータス</Label>
                <StatusSelect
                  entity="contract"
                  value={status}
                  disabled={updating === "status"}
                  onValueChange={handleStatusChange}
                  className="w-full max-w-[200px]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">関連見積</Label>
                <Select
                  value={estimateId || "_none"}
                  disabled={updating === "estimate"}
                  onValueChange={handleEstimateChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="見積を選択（任意）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">未設定</SelectItem>
                    {estimateOptions.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.estimate_no} — {e.title ?? "無題"}
                        {e.total != null ? `（¥${e.total.toLocaleString()}）` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {estimateOptions.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    見積がありません。
                    <Link href="/quotes" className="text-primary hover:underline ml-1">
                      見積管理
                    </Link>
                    または「見積もり」タブから作成できます
                  </p>
                )}
                {selectedEstimate && (
                  <p className="text-xs text-muted-foreground">
                    <Link href={`/quotes/${selectedEstimate.id}`} className="text-primary hover:underline font-medium">
                      {selectedEstimate.estimate_no}
                    </Link>
                    {" — "}
                    {selectedEstimate.title ?? "無題"}
                    {selectedEstimate.total != null && (
                      <span className="tabular-nums ml-1">¥{selectedEstimate.total.toLocaleString()}</span>
                    )}
                  </p>
                )}
              </div>
            </div>

            {data.notes && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground">{data.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

      {data.customer_id ? (
        <CustomerInfoPanel
          customerId={data.customer_id}
          context="contract"
          initialCustomer={data.customer ?? undefined}
          onSaved={onRefresh}
        />
      ) : (
        <p className="text-sm text-muted-foreground">顧客が紐づいていません</p>
      )}
    </div>
  );
}

function parseContractDraft(notes: string | null | undefined): { template_id: string; form: FormValues } | null {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes) as { contract_draft?: { template_id: string; form: FormValues } };
    if (parsed.contract_draft?.template_id) return parsed.contract_draft;
  } catch {
    // plain text notes
  }
  return null;
}

function DocumentsTab({
  contractId,
  data,
  onRefresh,
}: {
  contractId: string;
  data: ContractDetail;
  onRefresh?: () => void;
}) {
  const router = useRouter();
  const draft = parseContractDraft(data.notes);
  const [templateId, setTemplateId] = useState(draft?.template_id ?? CONTRACT_TEMPLATES[0]?.id ?? "");
  const tpl = CONTRACT_TEMPLATES.find((t) => t.id === templateId);
  const linked = data.linked_construction;
  const estimateTotal = (data as { estimate?: { total?: number } | null }).estimate?.total ?? null;
  const baseCtx: RenderContext = useMemo(() => ({
    construction: {
      title: linked?.title || data.title,
      start_date: data.start_date ?? linked?.start_date ?? null,
      end_date: data.end_date ?? linked?.end_date ?? null,
      order_amount: data.amount || linked?.order_amount || estimateTotal || null,
    },
    customer: data.customer ? {
      name: data.customer.name,
      address: data.customer.address ?? null,
      company_name: data.customer.company_name ?? null,
      customer_type: data.customer.customer_type ?? null,
      notes: data.customer.notes ?? null,
    } : null,
  }), [data, linked, estimateTotal]);
  const [companyCtx, setCompanyCtx] = useState<RenderContext["company"]>(null);
  const renderCtx: RenderContext = useMemo(
    () => ({ ...baseCtx, company: companyCtx }),
    [baseCtx, companyCtx],
  );
  const [form, setForm] = useState<FormValues>(() => draft?.form ?? (tpl ? buildDefaults(tpl, baseCtx) : {}));
  const [pdfTemplate, setPdfTemplate] = useState<PdfTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [formTemplates, setFormTemplates] = useState<PdfFormTemplate[]>([]);
  const [pdfFormPicker, setPdfFormPicker] = useState(false);
  const [fillerTpl, setFillerTpl] = useState<PdfFormTemplate | null>(null);
  const [companyReady, setCompanyReady] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submittingWorkflow, setSubmittingWorkflow] = useState(false);
  const [wfTypes, setWfTypes] = useState<ContractApprovalWorkflowType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState("");

  const selectedWfType = wfTypes.find((t) => t.id === selectedTypeId) ?? wfTypes[0] ?? null;

  const fillCtx = useMemo(() => buildFillContext({
    recordId: contractId,
    constructionTitle: linked?.title || data.title || null,
    constructionNo: linked?.construction_no ?? null,
    orderAmount: data.amount ?? linked?.order_amount ?? null,
    startDate: data.start_date ?? linked?.start_date ?? null,
    endDate: data.end_date ?? linked?.end_date ?? null,
    customer: data.customer ?? null,
    customerAssigneeName: data.customer_assignee_name ?? null,
  }), [contractId, data, linked]);

  const persistDraft = useCallback(async (nextForm: FormValues, nextTemplateId = templateId) => {
    setSaving(true);
    try {
      let notesPayload: Record<string, unknown> = {};
      try {
        notesPayload = data.notes ? JSON.parse(data.notes) as Record<string, unknown> : {};
      } catch {
        notesPayload = { legacy_notes: data.notes };
      }
      notesPayload.contract_draft = { template_id: nextTemplateId, form: nextForm };
      await updateContract(contractId, { notes: JSON.stringify(notesPayload) });
      setSavedAt(new Date().toLocaleTimeString().slice(0, 5));
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }, [contractId, data.notes, templateId]);

  useEffect(() => {
    fetchPdfFormTemplates().then(setFormTemplates).catch(() => {});
  }, []);

  useEffect(() => {
    getContractApprovalWorkflowTypes()
      .then((types) => {
        setWfTypes(types);
        setSelectedTypeId((prev) => prev || types[0]?.id || "");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchCompany().then((c) => {
      if (!c) {
        setCompanyReady(true);
        return;
      }
      const templates = resolvePdfTemplates((c?.settings as Record<string, unknown> | undefined)?.pdf_templates);
      const pdf = templates.contract ?? templates.estimate ?? null;
      setPdfTemplate(pdf);
      const company = resolveCompanyContext(c, pdf);
      setCompanyCtx(company.name || company.address ? company : null);
      setCompanyReady(true);
    }).catch(() => setCompanyReady(true));
  }, []);

  // 自社情報ロード後：空欄を補完してドラフト保存（入力中のトグルは上書きしない）
  useEffect(() => {
    if (!companyReady || !tpl) return;
    setForm((prev) => {
      const next = mergeDefaults(tpl, renderCtx, prev);
      const changed = JSON.stringify(next) !== JSON.stringify(prev);
      if (changed) void persistDraft(next);
      return next;
    });
    // renderCtx 全体は依存に入れない。トグルOFF(0)を空欄扱いして戻すのを防ぐ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyReady, companyCtx, tpl]);

  useEffect(() => {
    if (!tpl) return;
    setForm((prev) => mergeDefaults(tpl, renderCtx, prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, tpl]);

  const setField = (name: string, value: string | number) => {
    const next = { ...form, [name]: value };
    setForm(next);
    void persistDraft(next);
  };

  const handleSyncSchedule = () => {
    const next = syncFromContext(form, renderCtx);
    if (JSON.stringify(next) === JSON.stringify(form)) {
      toast.info("反映できる新しい情報はありません");
      return;
    }
    setForm(next);
    void persistDraft(next);
    toast.success("顧客・工事・工程表の情報を反映しました");
  };

  const handlePdfPrint = () => {
    if (!tpl) return;
    const next = prepareFormForOutput(tpl, renderCtx, form);
    setForm(next);
    void persistDraft(next);
    const pdf = pdfTemplate ?? resolvePdfTemplates(null).contract;
    const html = buildContractPrintHtml(renderPreview(tpl, next, renderCtx), pdf, tpl.name);
    const w = window.open("", "_blank", "width=900,height=1200");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  const handleConfirm = async () => {
    if (!tpl || !data.customer_id) {
      toast.error("顧客が紐づいていないため確定できません");
      return;
    }
    setConfirming(true);
    try {
      await persistDraft(form);
      setConfirmOpen(true);
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setConfirming(false);
    }
  };

  const handleSubmitWorkflow = async () => {
    if (!selectedTypeId && wfTypes.length > 0) {
      toast.error("承認ワークフロー種別を選択してください");
      return;
    }
    setSubmittingWorkflow(true);
    try {
      const req = await submitContractWorkflow(contractId, data.title, selectedTypeId || undefined);
      if (!req.ok) {
        toast.error(req.error);
        return;
      }
      const steps = selectedWfType?.approvalSteps.length ?? 0;
      toast.success(
        steps > 1
          ? `承認ワークフローに申請しました（${steps}段階）`
          : "承認ワークフローに申請しました",
      );
      setConfirmOpen(false);
      onRefresh?.();
      router.push(`/workflow/${req.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "申請に失敗しました");
    } finally {
      setSubmittingWorkflow(false);
    }
  };

  const handleDefer = async () => {
    setSubmittingWorkflow(true);
    try {
      await persistDraft(form);
      toast.success("下書きを保存しました");
      setConfirmOpen(false);
      router.push("/contracts");
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setSubmittingWorkflow(false);
    }
  };

  if (!tpl) {
    return (
      <Card><CardContent className="p-6 text-sm text-muted-foreground">テンプレートが見つかりません。</CardContent></Card>
    );
  }

  return (
    <div className="-mt-2 space-y-3">
      <div className="rounded-xl border border-border bg-slate-50/60 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground">契約書テンプレート</p>
            <p className="text-sm font-semibold truncate">{tpl.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{tpl.description}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => setPickerOpen(true)}>
          <RefreshCw className="h-3.5 w-3.5" />
          テンプレートを変更
        </Button>
      </div>

      <div className="sticky top-0 z-20 bg-white border border-border rounded-xl px-4 py-2.5 flex items-center gap-2">
        <h2 className="text-sm font-semibold truncate">{tpl.name}</h2>
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">下書き</span>
        {saving
          ? <span className="text-[10px] text-muted-foreground shrink-0 inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />保存中…</span>
          : savedAt && <span className="text-[10px] text-muted-foreground shrink-0">保存済み {savedAt}</span>}

        <div className="ml-auto flex items-center gap-1 shrink-0 flex-wrap justify-end">
          <Button variant="ghost" size="sm" className="h-8 text-xs px-2.5 gap-1.5" title="工程表と同期" onClick={handleSyncSchedule}>
            <RotateCcw className="h-3.5 w-3.5" />同期
          </Button>
          {formTemplates.length > 0 && (
            <Button variant="ghost" size="sm" className="h-8 text-xs px-2.5" title="アップロードPDF" onClick={() => setPdfFormPicker(true)}>
              PDFフォーム
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-8 text-xs px-2.5 gap-1.5" title="PDF出力" onClick={handlePdfPrint}>
            <Download className="h-3.5 w-3.5" />PDF出力
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs px-3 gap-1.5 bg-green-600 hover:bg-green-700"
            onClick={handleConfirm}
            disabled={confirming || !data.customer_id}
          >
            {confirming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            確定する
          </Button>
        </div>
      </div>

      <ContractDocumentEditorLayout
        templateId={templateId}
        form={form}
        renderCtx={renderCtx}
        pdfTemplate={pdfTemplate}
        onFieldChange={setField}
        autoSaveNote="入力内容は右のプレビューにリアルタイム反映されます（自動保存）"
      />

      {fillerTpl && (
        <PdfFormFillerPanel
          template={fillerTpl}
          ctx={fillCtx}
          onClose={() => setFillerTpl(null)}
        />
      )}

      <TemplatePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(t) => { setTemplateId(t.id); setPickerOpen(false); void persistDraft(form, t.id); }}
      />

      <ContractPdfTemplatePicker
        open={pdfFormPicker}
        onOpenChange={setPdfFormPicker}
        onSelectForm={(t) => { setPdfFormPicker(false); setFillerTpl(t); }}
        formTemplates={formTemplates}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>社内承認を取りますか？</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>契約書の内容を確定し、ポータルで設定した承認ルートどおりに申請できます。後で対応する場合は下書きのまま一覧に戻れます。</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>テンプレート: {tpl.name}</li>
                  <li>名称: {String(form.work_name ?? data.title)}</li>
                </ul>
                {wfTypes.length > 0 ? (
                  <div className="space-y-2 pt-1">
                    <p className="text-xs font-medium text-foreground">承認ワークフロー種別</p>
                    <Select value={selectedWfType?.id ?? ""} onValueChange={setSelectedTypeId}>
                      <SelectTrigger className="h-9 bg-background">
                        <SelectValue placeholder="種別を選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {wfTypes.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                            {t.approvalSteps.length > 0
                              ? `（${t.approvalSteps.length}段階）`
                              : "（ルート未設定）"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedWfType && selectedWfType.approvalSteps.length > 0 ? (
                      <div className="space-y-1.5">
                        <ol className="rounded-md border bg-background px-3 py-2 space-y-1 text-xs text-foreground">
                          {selectedWfType.approvalSteps.map((s) => (
                            <li key={`${s.stepOrder}-${s.approverId}`}>
                              Step {s.stepOrder}: {s.displayName}
                              {s.isAdministration && (
                                <span className="ml-1 text-teal-700">（総務・追記可）</span>
                              )}
                            </li>
                          ))}
                        </ol>
                        {!selectedWfType.hasAdministrationApprover && (
                          <p className="text-[11px] text-teal-800">
                            ルートに総務がいません。申請時に総務ロールを最終ステップへ自動追加します。
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-amber-700">
                        承認ルートが未設定です。設定＞組織＞ワークフローで追加してください。
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-amber-700">
                    契約書用のワークフロー種別がありません。設定＞組織＞ワークフローで作成してください。
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={submittingWorkflow}>キャンセル</AlertDialogCancel>
            <Button
              variant="outline"
              disabled={submittingWorkflow}
              onClick={() => void handleDefer()}
            >
              後で対応する
            </Button>
            <AlertDialogAction
              disabled={submittingWorkflow || !selectedWfType || selectedWfType.approvalSteps.length === 0}
              onClick={(e) => { e.preventDefault(); void handleSubmitWorkflow(); }}
            >
              {submittingWorkflow ? "申請中..." : "承認ワークフローに申請"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const ESIGN_TEMPLATE_MESSAGE = {
  subject: "契約書のご確認",
  body: "お世話になっております。契約書を送付いたします。内容をご確認のうえ、署名をお願いいたします。",
};

type MessageGenMethod = "template" | "linq" | "manual";

function EsignTab({
  contractId,
  customerEmail,
  customerName,
  contractTitle,
}: {
  contractId: string;
  customerEmail?: string | null;
  customerName?: string | null;
  contractTitle?: string;
}) {
  const [email, setEmail] = useState(customerEmail ?? "");
  const [subject, setSubject] = useState(ESIGN_TEMPLATE_MESSAGE.subject);
  const [message, setMessage] = useState(ESIGN_TEMPLATE_MESSAGE.body);
  const [genMethod, setGenMethod] = useState<MessageGenMethod>("template");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);

  const applyTemplate = () => {
    setSubject(ESIGN_TEMPLATE_MESSAGE.subject);
    setMessage(ESIGN_TEMPLATE_MESSAGE.body);
  };

  const handleMethodChange = async (method: MessageGenMethod) => {
    setGenMethod(method);
    if (method === "template") {
      applyTemplate();
      return;
    }
    if (method === "linq") {
      setGenerating(true);
      try {
        const result = await generateContractEsignMessage(contractId);
        setSubject(result.subject);
        setMessage(result.body);
        toast.success(result.source === "linq" ? "Linq AIでメッセージを生成しました" : "メッセージを生成しました");
      } catch {
        toast.error("メッセージ生成に失敗しました");
        applyTemplate();
      } finally {
        setGenerating(false);
      }
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          クラウドサイン連携 — 送信する契約書は電子文書文面（電子文書を作成し双方が保管）になります。書面2通の文言は使いません。
        </p>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">送信メッセージの生成方法</Label>
          <div className="flex flex-wrap gap-2">
            {([
              { value: "template", label: "テンプレート" },
              { value: "linq", label: "Linq自動生成" },
              { value: "manual", label: "手動入力" },
            ] as const).map((opt) => (
              <Button
                key={opt.value}
                type="button"
                size="sm"
                variant={genMethod === opt.value ? "default" : "outline"}
                className="text-xs"
                disabled={generating && opt.value === "linq"}
                onClick={() => void handleMethodChange(opt.value)}
              >
                {opt.value === "linq" && generating
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  : opt.value === "linq" ? <Sparkles className="h-3.5 w-3.5 mr-1" /> : null}
                {opt.label}
              </Button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {genMethod === "template" && "定型文を件名・本文に反映しています。編集すると手動入力に切り替わります。"}
            {genMethod === "linq" && "Linq AI が契約内容に合わせて件名・本文を生成します。"}
            {genMethod === "manual" && "件名・本文を自由に編集できます。"}
          </p>
        </div>

        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="メールアドレス" />
        <Input
          value={subject}
          onChange={(e) => { setSubject(e.target.value); setGenMethod("manual"); }}
          placeholder="件名"
        />
        <Textarea
          value={message}
          onChange={(e) => { setMessage(e.target.value); setGenMethod("manual"); }}
          rows={5}
          placeholder="本文"
        />
        {customerName && contractTitle && (
          <p className="text-xs text-muted-foreground">
            宛先: {customerName} ／ 契約: {contractTitle}
          </p>
        )}
        <Button
          size="sm"
          disabled={sending || !email.trim()}
          onClick={async () => {
            setSending(true);
            try {
              const res = await sendContractCloudSign(contractId, email, subject, message);
              toast.success(res.message);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "送信に失敗しました");
            } finally {
              setSending(false);
            }
          }}
        >
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
          電子契約を送信
        </Button>
      </CardContent>
    </Card>
  );
}

function FilesTab({ contractId, customerId }: { contractId: string; customerId?: string | null }) {
  if (!customerId) {
    return <p className="text-sm text-muted-foreground py-6 text-center">顧客が紐づいていません</p>;
  }
  return (
    <CustomerFilesTab
      customerId={customerId}
      contractId={contractId}
      description={CUSTOMER_DOCUMENTS_DESCRIPTION}
    />
  );
}

function EstimatesTab({
  contractId,
  pdfCustomer,
}: {
  contractId: string;
  pdfCustomer?: { name?: string | null; company_name?: string | null; customer_type?: string | null; notes?: string | null } | null;
}) {
  const [rows, setRows] = useState<EstimateListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEstimate, setSelectedEstimate] = useState<EstimateForView | null>(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const loadRows = () => {
    fetchContractEstimates(contractId)
      .then((data) => setRows(data as unknown as EstimateListItem[]))
      .catch(() => toast.error("見積一覧の読み込みに失敗"));
  };

  useEffect(() => {
    loadRows();
  }, [contractId]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedEstimate(null);
      return;
    }
    setLoadingEstimate(true);
    fetchEstimate(selectedId)
      .then((est) => setSelectedEstimate(est as unknown as EstimateForView))
      .catch(() => toast.error("見積の読み込みに失敗"))
      .finally(() => setLoadingEstimate(false));
  }, [selectedId]);

  const handleCreated = (id: string) => {
    loadRows();
    setSelectedId(id);
  };

  if (selectedId && selectedEstimate) {
    return (
      <EstimateDetailView
        estimate={selectedEstimate}
        loading={loadingEstimate}
        onBack={() => setSelectedId(null)}
        onEstimateChange={(est) => setSelectedEstimate(est)}
        pdfCustomer={pdfCustomer}
      />
    );
  }

  return (
    <>
      <EstimateListView
        estimateList={rows}
        loadingEstimate={loadingEstimate}
        onSelectEstimate={setSelectedId}
        onOpenCreate={() => setCreateOpen(true)}
        title="見積一覧"
        description="契約前の営業見積を管理（同一顧客の見積を含む）"
        showSource
      />
      <CreateEstimateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        estimateList={rows}
        onCreate={async ({ title, author, sourceId }) => {
          if (sourceId) {
            return copyEstimateForContract(contractId, sourceId, title, author);
          }
          return createEmptyEstimateForContract(contractId, title, author);
        }}
        onCreated={handleCreated}
      />
    </>
  );
}
