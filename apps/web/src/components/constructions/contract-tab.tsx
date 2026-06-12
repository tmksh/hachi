"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Plus, FileText, Pencil, Trash2, ChevronRight, Loader2,
  X, Download, RefreshCw, CheckCircle2, RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CONTRACT_TEMPLATES, type ContractTemplate, type FormValues,
  type RenderContext, findTemplate, buildDefaults, renderPreview,
  mergeDefaults, syncFromContext, resolveCompanyContext,
} from "@/lib/contract-templates";
import {
  createContractDoc, updateContractDoc, deleteContractDoc,
} from "@/lib/actions/constructions";
import { getCompany } from "@/lib/actions/profiles";
import { resolvePdfTemplates, type PdfTemplate } from "@/lib/pdf-template";
import { buildContractPrintHtml } from "@/lib/contract-pdf";
import { archiveContractDocumentHtml } from "@/lib/actions/documents";
import {
  buildContractArchiveHtml,
  contractArchiveDocumentName,
} from "@/lib/contract-document-archive";
import { TemplatePicker } from "@/components/contracts/contract-doc-editor-parts";
import { ContractDocumentEditorLayout } from "@/components/contracts/contract-document-editor-layout";
import { getPdfFormTemplates } from "@/lib/actions/pdf-form-templates";
import type { FillContext, PdfFormTemplate } from "@/lib/pdf-form-template";
import { PdfFormFiller } from "@/components/settings/pdf-form-filler";

type ContractDoc = {
  id: string;
  contract_no: string;
  title: string;
  status: string;
  amount: number;
  contract_date: string | null;
  template_id: string | null;
  form: Record<string, string | number> | null;
  created_at: string;
  updated_at: string;
};

interface Props {
  constructionId: string;
  customerId?: string | null;
  initialDocs: ContractDoc[];
  ctx: RenderContext;
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  preparing:  { label: "下書き",   cls: "bg-amber-100 text-amber-700"   },
  contracted: { label: "確定済み", cls: "bg-green-100 text-green-700"   },
  executing:  { label: "実行中",   cls: "bg-blue-100 text-blue-700"     },
  completed:  { label: "完了",     cls: "bg-slate-200 text-slate-700"   },
  cancelled:  { label: "キャンセル", cls: "bg-red-100 text-red-600"     },
};

export function ContractTab({ constructionId, customerId, initialDocs, ctx }: Props) {
  const [docs, setDocs] = useState<ContractDoc[]>(initialDocs);
  const [picker, setPicker] = useState(false);
  const [editing, setEditing] = useState<ContractDoc | null>(null);

  // PDFフォームテンプレート（管理者がPDFビルダーで作成したもの）
  const [formTemplates, setFormTemplates] = useState<PdfFormTemplate[]>([]);
  const [formPicker, setFormPicker] = useState(false);
  const [fillerTpl, setFillerTpl] = useState<PdfFormTemplate | null>(null);

  useEffect(() => {
    getPdfFormTemplates().then(setFormTemplates).catch(() => {});
  }, []);

  const fillCtx: FillContext = useMemo(() => ({
    constructionTitle: ctx.construction?.title ?? null,
    orderAmount: ctx.construction?.order_amount ?? null,
    startDate: ctx.construction?.start_date ?? null,
    endDate: ctx.construction?.end_date ?? null,
    customerName: ctx.customer?.name ?? null,
    customerAddress: ctx.customer?.address ?? null,
  }), [ctx]);

  function handleSelectTemplate(tpl: ContractTemplate) {
    setPicker(false);
    const draft: ContractDoc = {
      id: "__new__",
      contract_no: "（新規）",
      title: tpl.name,
      status: "preparing",
      amount: 0,
      contract_date: null,
      template_id: tpl.id,
      form: buildDefaults(tpl, ctx),
      created_at: "", updated_at: "",
    };
    setEditing(draft);
  }

  function handleClose(savedDoc?: ContractDoc, deletedId?: string) {
    if (deletedId) setDocs(prev => prev.filter(d => d.id !== deletedId));
    else if (savedDoc) {
      setDocs(prev => {
        const i = prev.findIndex(d => d.id === savedDoc.id);
        if (i === -1) return [savedDoc, ...prev];
        const next = [...prev];
        next[i] = savedDoc;
        return next;
      });
    }
    setEditing(null);
  }

  if (editing) {
    return (
      <ContractEditor
        constructionId={constructionId}
        customerId={customerId}
        doc={editing}
        ctx={ctx}
        onClose={handleClose}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">契約書</span>
          <span className="text-muted-foreground">{docs.length}</span>
        </div>
        <div className="flex items-center gap-2">
          {formTemplates.length > 0 && (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setFormPicker(true)}>
              <Download className="h-3.5 w-3.5" />PDFフォームで出力
            </Button>
          )}
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => setPicker(true)}>
            <Plus className="h-3.5 w-3.5" />契約書を作成する
          </Button>
        </div>
      </div>

      {docs.length === 0 ? (
        <div className="py-14 text-center text-sm text-muted-foreground rounded-xl border border-dashed border-border">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>契約書がまだありません</p>
          <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => setPicker(true)}>
            <Plus className="h-4 w-4" />契約書を作成
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => {
            const st = STATUS_LABELS[doc.status] ?? STATUS_LABELS.preparing;
            const tpl = doc.template_id ? findTemplate(doc.template_id) : null;
            return (
              <button
                key={doc.id}
                onClick={() => setEditing(doc)}
                className="w-full flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:shadow-md hover:border-primary/40 transition-all text-left group"
              >
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Pencil className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{tpl?.name ?? doc.title}</p>
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0", st.cls)}>{st.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {ctx.construction?.title ?? "—"} ・ ¥{doc.amount.toLocaleString()}
                    {doc.contract_date ? ` ・ 契約日 ${doc.contract_date}` : ""}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      <TemplatePicker open={picker} onOpenChange={setPicker} onSelect={handleSelectTemplate} />

      {/* PDFフォームテンプレート選択 */}
      <Dialog open={formPicker} onOpenChange={setFormPicker}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>PDFフォームテンプレートを選択</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {formTemplates.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setFormPicker(false);
                  setFillerTpl(t);
                }}
                className="flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.pageCount}ページ ・ {t.fields.length}項目</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <PdfFormFiller
        open={!!fillerTpl}
        onOpenChange={(o) => !o && setFillerTpl(null)}
        template={fillerTpl}
        ctx={fillCtx}
      />
    </div>
  );
}

function ContractEditor({
  constructionId, customerId, doc, ctx, onClose,
}: {
  constructionId: string;
  customerId?: string | null;
  doc: ContractDoc;
  ctx: RenderContext;
  onClose: (saved?: ContractDoc, deletedId?: string) => void;
}) {
  const [tplId, setTplId] = useState<string>(doc.template_id ?? "construction_contract");
  const [form, setForm]   = useState<FormValues>(() => doc.form ?? buildDefaults(findTemplate(tplId)!, ctx));
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [status, setStatus] = useState(doc.status);
  const [docId, setDocId] = useState(doc.id);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pdfTpl, setPdfTpl] = useState<PdfTemplate | null>(null);
  const [companyCtx, setCompanyCtx] = useState<RenderContext["company"]>(null);

  const tpl = useMemo(() => findTemplate(tplId)!, [tplId]);
  const renderCtx: RenderContext = useMemo(
    () => ({ ...ctx, company: companyCtx }),
    [ctx, companyCtx],
  );
  const isNew = docId === "__new__";

  useEffect(() => {
    getCompany()
      .then((c) => {
        const raw = (c.settings as Record<string, unknown> | null)?.pdf_templates;
        const pdf = resolvePdfTemplates(raw).contract;
        setPdfTpl(pdf);
        const company = resolveCompanyContext(c, pdf);
        setCompanyCtx(company.name || company.address ? company : null);
      })
      .catch(() => setPdfTpl(resolvePdfTemplates(null).contract));
  }, []);

  useEffect(() => {
    if (!companyCtx) return;
    setForm((prev) => mergeDefaults(tpl, renderCtx, prev));
  }, [companyCtx, tpl, renderCtx]);

  useEffect(() => {
    setForm((prev) => mergeDefaults(tpl, renderCtx, prev));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tplId]);

  function set(name: string, value: string | number) {
    setForm(prev => ({ ...prev, [name]: value }));
  }

  async function save(newStatus?: string) {
    setSaving(true);
    try {
      if (isNew) {
        const created = await createContractDoc({
          construction_id: constructionId,
          template_id: tplId,
          title: tpl.name,
          form,
        });
        setDocId(created.id);
        if (newStatus) {
          await updateContractDoc({ id: created.id, construction_id: constructionId, template_id: tplId, form, status: newStatus });
          setStatus(newStatus);
        }
        const saved: ContractDoc = {
          id: created.id,
          contract_no: created.contract_no,
          title: tpl.name,
          status: newStatus ?? created.status,
          amount: created.amount,
          contract_date: created.contract_date,
          template_id: tplId,
          form,
          created_at: created.created_at,
          updated_at: created.updated_at,
        };
        setSavedAt(new Date().toLocaleTimeString().slice(0, 5));
        return saved;
      } else {
        await updateContractDoc({ id: docId, construction_id: constructionId, template_id: tplId, form, status: newStatus });
        if (newStatus) setStatus(newStatus);
        const updated: ContractDoc = {
          ...doc,
          id: docId,
          template_id: tplId,
          status: newStatus ?? status,
          form,
          amount: (Number(form.amount_excl_tax) || 0) + Math.floor((Number(form.amount_excl_tax) || 0) * (Number(form.tax_rate) || 10) / 100),
          contract_date: (form.contract_date as string) || null,
          title: tpl.name,
        };
        setSavedAt(new Date().toLocaleTimeString().slice(0, 5));
        return updated;
      }
    } catch (e) {
      console.error(e);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirm() {
    setConfirming(true);
    const saved = await save("contracted");
    if (saved && customerId) {
      try {
        const pdf = pdfTpl ?? resolvePdfTemplates(null).contract;
        const html = buildContractArchiveHtml(tpl, form, renderCtx, pdf);
        await archiveContractDocumentHtml({
          html,
          name: contractArchiveDocumentName(tpl.name),
          customer_id: customerId,
          construction_id: constructionId,
          contract_id: saved.id,
        });
        toast.success("契約書を確定し、ドキュメント一覧に保存しました");
      } catch (e) {
        console.error(e);
        toast.error("確定しましたが、ドキュメント一覧への保存に失敗しました");
      }
    } else if (saved) {
      toast.success("契約書を確定しました");
    }
    setConfirming(false);
    if (saved) onClose(saved);
  }

  async function handleSaveOnly() {
    const saved = await save();
    if (saved) onClose(saved);
  }

  async function executeDelete() {
    setDeleteOpen(false);
    if (isNew) {
      onClose();
      return;
    }
    setDeleting(true);
    try {
      await deleteContractDoc(docId, constructionId);
      toast.success("契約書を削除しました");
      onClose(undefined, docId);
    } catch (e) {
      console.error(e);
      toast.error("削除に失敗しました", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setDeleting(false);
    }
  }

  function handleSyncSchedule() {
    const next = syncFromContext(form, renderCtx);
    if (JSON.stringify(next) === JSON.stringify(form)) {
      toast.info("反映できる新しい情報はありません");
      return;
    }
    setForm(next);
    if (!isNew) void save();
    toast.success("顧客・工事・工程表の情報を反映しました");
  }

  function handlePdfPrint() {
    const pdf = pdfTpl ?? resolvePdfTemplates(null).contract;
    const bodyHtml = renderPreview(tpl, form, renderCtx);
    const win = window.open("", "_blank", "width=900,height=1200");
    if (!win) return;
    win.document.write(buildContractPrintHtml(bodyHtml, pdf, tpl.name));
    win.document.close();
    setTimeout(() => win.print(), 300);
  }

  const st = STATUS_LABELS[status] ?? STATUS_LABELS.preparing;

  return (
    <div className="-mt-2">
      {/* ── ツールバー ── */}
      <div className="sticky top-0 z-20 bg-white border border-border rounded-xl px-4 py-2.5 flex items-center gap-2 mb-3">
        <button onClick={() => onClose()} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 shrink-0">
          <X className="h-4 w-4" />戻る
        </button>
        <div className="h-5 w-px bg-border mx-1 shrink-0" />
        <h2 className="text-sm font-semibold truncate">{tpl.name}</h2>
        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0", st.cls)}>{st.label}</span>
        {savedAt && <span className="text-[10px] text-muted-foreground shrink-0">保存済み {savedAt}</span>}

        <div className="ml-auto flex items-center gap-1 shrink-0">
          {/* アイコンのみのサブアクション群 */}
          <Button variant="ghost" size="icon" className="h-8 w-8" title="テンプレート変更" onClick={() => setPickerOpen(true)}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="工程表と同期" onClick={handleSyncSchedule}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="PDF出力" onClick={handlePdfPrint}>
            <Download className="h-4 w-4" />
          </Button>
          <div className="w-px h-5 bg-border mx-0.5" />
          {!isNew && (
            <Button variant="ghost" size="sm" className="h-8 text-xs px-2.5" onClick={handleSaveOnly} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}保存
            </Button>
          )}
          <Button size="sm" className="h-8 text-xs px-3 gap-1.5 bg-green-600 hover:bg-green-700" onClick={handleConfirm} disabled={confirming}>
            {confirming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            確定する
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
            title="削除"
            onClick={() => setDeleteOpen(true)}
            disabled={deleting}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isNew ? "下書きを破棄しますか？" : "契約書を削除しますか？"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isNew
                ? "保存していない契約書の入力内容は失われます。"
                : "この操作は取り消せません。契約書データが完全に削除されます。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => void executeDelete()}
            >
              {isNew ? "破棄する" : "削除する"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ContractDocumentEditorLayout
        templateId={tplId}
        form={form}
        renderCtx={renderCtx}
        pdfTemplate={pdfTpl}
        onFieldChange={set}
      />

      <TemplatePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(t) => { setTplId(t.id); setPickerOpen(false); }}
      />
    </div>
  );
}
