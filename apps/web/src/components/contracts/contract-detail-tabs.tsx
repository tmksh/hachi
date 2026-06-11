"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomerEntryForm } from "@/components/crm/customer-entry-form";
import { ContractMessagingTab } from "@/components/contracts/contract-messaging-tab";
import {
  getContractDocuments,
  getContractEstimates, submitContractWorkflow, sendContractCloudSign,
  createEmptyEstimateForContract, copyEstimateForContract,
} from "@/lib/actions/contract-features";
import { getEstimate } from "@/lib/actions/estimates";
import { Calendar, FileText, Plus } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getPdfFormTemplates } from "@/lib/actions/pdf-form-templates";
import type { FillContext, PdfFormTemplate } from "@/lib/pdf-form-template";
import { PdfFormFiller } from "@/components/settings/pdf-form-filler";
import { ContractPdfTemplatePicker } from "@/components/contracts/contract-pdf-template-picker";
import { StatusBadge } from "@/components/shared/status-badge";
import { toast } from "sonner";
import type { ContractDetail } from "./contract-detail-types";
import { EstimateDetailView, type EstimateForView } from "@/components/estimate/estimate-detail-view";
import { EstimateListView, type EstimateListItem } from "@/components/estimate/estimate-list-view";
import { CreateEstimateDialog } from "@/components/estimate/create-estimate-dialog";
import { StatusSelect } from "@/components/shared/status-select";
import { Label } from "@/components/ui/label";
import { updateContract } from "@/lib/actions/contracts";

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
        <TabsTrigger value="files" className="text-xs">ドキュメント</TabsTrigger>
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
      <TabsContent value="workflow" className="mt-4"><WorkflowTab contractId={contractId} title={data.title} /></TabsContent>
      <TabsContent value="esign" className="mt-4"><EsignTab contractId={contractId} customerEmail={data.customer?.email} /></TabsContent>
      <TabsContent value="files" className="mt-4"><FilesTab contractId={contractId} /></TabsContent>
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
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-base font-medium text-primary">{data.customer.name.charAt(0)}</span>
                </div>
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
        <CustomerEntryForm mode="edit" customerId={data.customer_id} />
      ) : (
        <p className="text-sm text-muted-foreground">顧客が紐づいていません</p>
      )}
    </div>
  );
}

function DocumentsTab({
  contractId: _contractId,
  data,
}: {
  contractId: string;
  data: ContractDetail;
  onRefresh?: () => void;
}) {
  const [picker, setPicker] = useState(false);
  const [formTemplates, setFormTemplates] = useState<PdfFormTemplate[]>([]);
  const [fillerTpl, setFillerTpl] = useState<PdfFormTemplate | null>(null);

  useEffect(() => {
    getPdfFormTemplates().then(setFormTemplates).catch(() => {});
  }, []);

  const fillCtx: FillContext = useMemo(() => ({
    constructionTitle: data.title ?? null,
    orderAmount: data.amount ?? null,
    startDate: data.start_date ?? null,
    endDate: data.end_date ?? null,
    customerName: data.customer?.name ?? null,
    customerAddress: null,
  }), [data]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">契約書</span>
          <span className="text-muted-foreground">1</span>
        </div>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setPicker(true)}>
          <Plus className="h-3.5 w-3.5" />契約書を作成する
        </Button>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <FileText className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">{data.title}</p>
            <StatusBadge status={data.status} className="text-[10px] px-2 py-0.5 shrink-0" />
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            ¥{(data.amount ?? 0).toLocaleString()}
            {data.contract_date ? ` ・ 契約日 ${data.contract_date}` : ""}
          </p>
        </div>
      </div>

      <ContractPdfTemplatePicker
        open={picker}
        onOpenChange={setPicker}
        onSelectForm={(tpl) => setFillerTpl(tpl)}
        formTemplates={formTemplates}
      />

      <PdfFormFiller
        open={!!fillerTpl}
        onOpenChange={(o) => !o && setFillerTpl(null)}
        template={fillerTpl}
        ctx={fillCtx}
      />
    </div>
  );
}

function WorkflowTab({ contractId, title }: { contractId: string; title: string }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      const req = await submitContractWorkflow(contractId, title);
      toast.success(`申請しました（${req.id.slice(0, 8)}…）`);
      setConfirmOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "申請に失敗");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Card><CardContent className="p-4 space-y-3">
        <p className="text-sm">最新契約書の内容でワークフロー申請を行います</p>
        <Button size="sm" onClick={() => setConfirmOpen(true)}>承認ワークフローに申請</Button>
        <Link href="/workflow" className="text-xs text-primary hover:underline block">ワークフロー履歴を見る →</Link>
      </CardContent></Card>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>社内承認を取りますか？</AlertDialogTitle>
            <AlertDialogDescription>
              契約書の内容を確定し、社内承認ワークフロー（営業部長 / 工事課長 / 取締役 等）に申請します。よろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>キャンセル</AlertDialogCancel>
            <AlertDialogAction disabled={submitting} onClick={(e) => { e.preventDefault(); void submit(); }}>
              {submitting ? "申請中..." : "申請する"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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

function FilesTab({ contractId }: { contractId: string }) {
  const [docs, setDocs] = useState<Awaited<ReturnType<typeof getContractDocuments>>>([]);
  useEffect(() => { getContractDocuments(contractId).then(setDocs).catch(() => {}); }, [contractId]);
  return (
    <div className="space-y-2">
      {docs.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">ドキュメントなし</p> : docs.map((d) => (
        <div key={d.id} className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm">
          <span>{d.name}</span>
          <span className="text-xs text-muted-foreground">{format(new Date(d.created_at), "yyyy/MM/dd", { locale: ja })}</span>
        </div>
      ))}
    </div>
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
