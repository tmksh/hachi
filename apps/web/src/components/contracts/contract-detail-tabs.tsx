"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomerInfoPanel } from "@/components/crm/customer-info-panel";
import { CustomerFilesTab, CUSTOMER_DOCUMENTS_DESCRIPTION } from "@/components/crm/customer-files-tab";
import { CustomerAvatar } from "@/components/shared/customer-avatar";
import { ContractMessagingTab } from "@/components/contracts/contract-messaging-tab";
import { ContractWorkflowTab } from "@/components/contracts/contract-workflow-tab";
import {
  getContractEstimates, sendContractCloudSign,
  createEmptyEstimateForContract, copyEstimateForContract,
} from "@/lib/actions/contract-features";
import { getEstimate } from "@/lib/actions/estimates";
import { Calendar, FileText, RefreshCw, Download, Loader2, RotateCcw, FolderOpen, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { ContractDetail } from "./contract-detail-types";
import { EstimateDetailView, type EstimateForView } from "@/components/estimate/estimate-detail-view";
import { EstimateListView, type EstimateListItem } from "@/components/estimate/estimate-list-view";
import { CreateEstimateDialog } from "@/components/estimate/create-estimate-dialog";
import { StatusSelect } from "@/components/shared/status-select";
import { Label } from "@/components/ui/label";
import { updateContract } from "@/lib/actions/contracts";
import { CONTRACT_TEMPLATES, buildDefaults, renderPreview, mergeDefaults, syncFromContext, resolveCompanyContext, type FormValues, type RenderContext } from "@/lib/contract-templates";
import { ContractDocumentEditorLayout } from "@/components/contracts/contract-document-editor-layout";
import { getCompany } from "@/lib/actions/profiles";
import { resolvePdfTemplates, type PdfTemplate } from "@/lib/pdf-template";
import { buildContractPrintHtml } from "@/lib/contract-pdf";
import { TemplatePicker } from "@/components/contracts/contract-doc-editor-parts";
import { getPdfFormTemplates } from "@/lib/actions/pdf-form-templates";
import type { FillContext, PdfFormTemplate } from "@/lib/pdf-form-template";
import { PdfFormFillerPanel } from "@/components/settings/pdf-form-filler";
import { ContractPdfTemplatePicker } from "@/components/contracts/contract-pdf-template-picker";
import { archiveContractDocumentHtml } from "@/lib/actions/documents";
import {
  buildContractArchiveHtml,
  contractArchiveDocumentName,
} from "@/lib/contract-document-archive";

export function ContractDetailTabs({
  data,
  contractId,
  onRefresh,
}: {
  data: ContractDetail;
  contractId: string;
  onRefresh?: () => void;
}) {
  return (
    <Tabs defaultValue="customer">
      <TabsList className="flex w-full overflow-x-auto h-auto flex-wrap gap-0.5">
        <TabsTrigger value="customer" className="text-xs">顧客情報</TabsTrigger>
        <TabsTrigger value="messaging" className="text-xs">やり取り管理</TabsTrigger>
        <TabsTrigger value="documents" className="text-xs">書類作成</TabsTrigger>
        <TabsTrigger value="workflow" className="text-xs">承認WF</TabsTrigger>
        <TabsTrigger value="esign" className="text-xs">電子契約</TabsTrigger>
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
        <ContractWorkflowTab contractId={contractId} data={data} onRefresh={onRefresh} />
      </TabsContent>
      <TabsContent value="esign" className="mt-4"><EsignTab contractId={contractId} customerEmail={data.customer?.email} /></TabsContent>
      <TabsContent value="files" className="mt-4"><FilesTab contractId={contractId} customerId={data.customer_id} /></TabsContent>
      <TabsContent value="estimates" className="mt-4">
        <EstimatesTab
          contractId={contractId}
          pdfCustomer={data.customer ? { name: data.customer.name, company_name: data.customer.company_name } : null}
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
    getContractEstimates(contractId)
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
  const draft = parseContractDraft(data.notes);
  const [templateId, setTemplateId] = useState(draft?.template_id ?? CONTRACT_TEMPLATES[0]?.id ?? "");
  const tpl = CONTRACT_TEMPLATES.find((t) => t.id === templateId);
  const baseCtx: RenderContext = useMemo(() => ({
    construction: {
      title: data.title,
      start_date: data.start_date ?? null,
      end_date: data.end_date ?? null,
      order_amount: data.amount ?? null,
    },
    customer: data.customer ? {
      name: data.customer.name,
      address: data.customer.address ?? null,
    } : null,
  }), [data]);
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

  const fillCtx: FillContext = useMemo(() => ({
    constructionTitle: data.title ?? null,
    orderAmount: data.amount ?? null,
    startDate: data.start_date ?? null,
    endDate: data.end_date ?? null,
    customerName: data.customer?.name ?? null,
    customerAddress: data.customer?.address ?? null,
  }), [data]);

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
      onRefresh?.();
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }, [contractId, data.notes, onRefresh, templateId]);

  useEffect(() => {
    getPdfFormTemplates().then(setFormTemplates).catch(() => {});
  }, []);

  useEffect(() => {
    getCompany().then((c) => {
      const templates = resolvePdfTemplates((c?.settings as Record<string, unknown> | undefined)?.pdf_templates);
      const pdf = templates.contract ?? templates.estimate ?? null;
      setPdfTemplate(pdf);
      const company = resolveCompanyContext(c, pdf);
      setCompanyCtx(company.name || company.address ? company : null);
      setCompanyReady(true);
    }).catch(() => setCompanyReady(true));
  }, []);

  // 自社情報ロード後：空欄を補完してドラフト保存
  useEffect(() => {
    if (!companyReady || !tpl) return;
    setForm((prev) => {
      const next = mergeDefaults(tpl, renderCtx, prev);
      const changed = JSON.stringify(next) !== JSON.stringify(prev);
      if (changed) void persistDraft(next);
      return next;
    });
  }, [companyReady, companyCtx, tpl, renderCtx, persistDraft]);

  useEffect(() => {
    if (!tpl) return;
    setForm((prev) => mergeDefaults(tpl, renderCtx, prev));
  }, [templateId, tpl, renderCtx]);

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
    const pdf = pdfTemplate ?? resolvePdfTemplates(null).contract;
    const html = buildContractPrintHtml(renderPreview(tpl, form, renderCtx), pdf, tpl.name);
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
      const pdf = pdfTemplate ?? resolvePdfTemplates(null).contract;
      const html = buildContractArchiveHtml(tpl, form, renderCtx, pdf);
      await archiveContractDocumentHtml({
        html,
        name: contractArchiveDocumentName(tpl.name),
        customer_id: data.customer_id,
        contract_id: contractId,
      });
      toast.success("契約書を確定し、ドキュメント一覧に保存しました");
      onRefresh?.();
    } catch {
      toast.error("確定・保存に失敗しました");
    } finally {
      setConfirming(false);
    }
  };

  if (!tpl) {
    return (
      <Card><CardContent className="p-6 text-sm text-muted-foreground">テンプレートが見つかりません。</CardContent></Card>
    );
  }

  return (
    <div className="-mt-2 space-y-3">
      <div className="sticky top-0 z-20 bg-white border border-border rounded-xl px-4 py-2.5 flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        <h2 className="text-sm font-semibold truncate">{tpl.name}</h2>
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">下書き</span>
        {saving
          ? <span className="text-[10px] text-muted-foreground shrink-0 inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />保存中…</span>
          : savedAt && <span className="text-[10px] text-muted-foreground shrink-0">保存済み {savedAt}</span>}

        <div className="ml-auto flex items-center gap-1 shrink-0 flex-wrap justify-end">
          <Button variant="ghost" size="icon" className="h-8 w-8" title="テンプレート変更" onClick={() => setPickerOpen(true)}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="工程表と同期" onClick={handleSyncSchedule}>
            <RotateCcw className="h-4 w-4" />
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
    </div>
  );
}

function EsignTab({ contractId, customerEmail }: { contractId: string; customerEmail?: string | null }) {
  const [email, setEmail] = useState(customerEmail ?? "");
  const [subject, setSubject] = useState("契約書のご確認");
  const [message, setMessage] = useState("お世話になっております。契約書を送付いたします。");

  return (
    <Card><CardContent className="p-4 space-y-3">
      <p className="text-sm text-muted-foreground">クラウドサイン連携（ワークフロー承認後に送信）</p>
      <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="メールアドレス" />
      <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="件名" />
      <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} />
      <Button size="sm" onClick={async () => {
        const res = await sendContractCloudSign(contractId, email, subject, message);
        toast.success(res.message);
      }}>クラウドサインで送信</Button>
    </CardContent></Card>
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
  pdfCustomer?: { name?: string | null; company_name?: string | null } | null;
}) {
  const [rows, setRows] = useState<EstimateListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEstimate, setSelectedEstimate] = useState<EstimateForView | null>(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const loadRows = () => {
    getContractEstimates(contractId)
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
    getEstimate(selectedId)
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
