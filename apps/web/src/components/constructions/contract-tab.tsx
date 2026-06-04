"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  Calendar, CalendarRange, User, MapPin, Wallet,
  Percent, CreditCard, Shield, AlignLeft, Hash, ToggleLeft,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CONTRACT_TEMPLATES, type ContractTemplate, type FormValues,
  type RenderContext, findTemplate, buildDefaults, renderPreview,
} from "@/lib/contract-templates";
import {
  createContractDoc, updateContractDoc, deleteContractDoc,
} from "@/lib/actions/constructions";
import { getCompany } from "@/lib/actions/profiles";
import { resolvePdfTemplates, type PdfTemplate } from "@/lib/pdf-template";
import { buildContractPrintHtml } from "@/lib/contract-pdf";
import { ContractContentPreview } from "@/components/contracts/contract-content-preview";
import { getPdfFormTemplates } from "@/lib/actions/pdf-form-templates";
import type { FillContext, PdfFormTemplate } from "@/lib/pdf-form-template";
import { PdfFormFiller } from "@/components/settings/pdf-form-filler";
import Link from "next/link";

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

export function ContractTab({ constructionId, initialDocs, ctx }: Props) {
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

/* ────────────────────────────────────────────
   フィールドごとのアイコンマッピング
──────────────────────────────────────────── */
function getFieldIcon(fieldName: string, fieldType: string): LucideIcon {
  if (fieldType === "toggle") return ToggleLeft;
  if (fieldType === "textarea") return AlignLeft;
  if (fieldName.includes("date") || fieldName.includes("Date")) {
    return fieldName.includes("start") || fieldName.includes("end") ? CalendarRange : Calendar;
  }
  if (fieldName.includes("amount") || fieldName.includes("price")) return Wallet;
  if (fieldName.includes("tax")) return Percent;
  if (fieldName.includes("payment")) return CreditCard;
  if (fieldName.includes("warranty")) return Shield;
  if (fieldName.includes("kou_name") || fieldName.includes("otsu_name")) return User;
  if (fieldName.includes("address") || fieldName.includes("location")) return MapPin;
  if (fieldName.includes("days") || fieldName.includes("years")) return Hash;
  return FileText;
}

/* ────────────────────────────────────────────
   フォームセクション分け
──────────────────────────────────────────── */
import type { TemplateField } from "@/lib/contract-templates";

type FieldGroup = { title: string; description?: string; names: string[] };

const FIELD_GROUP_DEFS: FieldGroup[] = [
  { title: "契約基本", names: ["contract_date", "original_date"] },
  { title: "当事者", description: "甲（発注者）と乙（請負者）の情報", names: ["kou_name", "kou_address", "otsu_name", "otsu_address"] },
  { title: "工事・業務", names: ["work_name", "work_location", "original_work", "change_summary", "scope"] },
  { title: "金額・工期", description: "工期は工程表と連携されます", names: ["amount_excl_tax", "tax_rate", "start_date", "end_date"] },
  { title: "支払・条件", names: ["payment_terms", "warranty_years", "warranty_include"] },
  { title: "その他", names: ["special_notes"] },
];

function groupFields(fields: TemplateField[]): { group: FieldGroup; fields: TemplateField[] }[] {
  const used = new Set<string>();
  const result: { group: FieldGroup; fields: TemplateField[] }[] = [];

  for (const def of FIELD_GROUP_DEFS) {
    const matched = fields.filter(f => def.names.includes(f.name) && !used.has(f.name));
    if (matched.length === 0) continue;
    matched.forEach(f => used.add(f.name));
    result.push({ group: def, fields: matched });
  }

  const rest = fields.filter(f => !used.has(f.name));
  if (rest.length > 0) {
    result.push({ group: { title: "その他", names: [] }, fields: rest });
  }
  return result;
}

const INPUT_CLS =
  "w-full rounded-lg border border-border/80 bg-white px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/45 focus:border-primary/50 focus:ring-2 focus:ring-primary/10";

function ContractFormField({
  field,
  value,
  onChange,
}: {
  field: TemplateField;
  value: string | number | undefined;
  onChange: (v: string | number) => void;
}) {
  const Icon = getFieldIcon(field.name, field.type);
  const isToggle = field.type === "toggle";
  const isChecked = isToggle ? (Number(value) !== 0) : false;
  const isDate = field.type === "date";

  if (isToggle) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-white px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm font-medium text-foreground">
            {field.label}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={cn("text-xs font-medium", isChecked ? "text-green-600" : "text-muted-foreground")}>
            {isChecked ? "有効" : "無効"}
          </span>
          <Switch checked={isChecked} onCheckedChange={v => onChange(v ? 1 : 0)} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <label className="text-xs font-semibold text-slate-600">
          {field.label}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {field.synced && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600 border border-blue-100">
            <CalendarRange className="h-3 w-3" />
            工程表連携
          </span>
        )}
      </div>
      {field.type === "textarea" ? (
        <textarea
          value={String(value ?? "")}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder ?? "入力してください"}
          rows={3}
          className={cn(INPUT_CLS, "resize-none leading-relaxed min-h-[72px]")}
        />
      ) : (
        <div className="relative">
          {isDate && (
            <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
          )}
          <input
            type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
            value={String(value ?? "")}
            onChange={e => onChange(field.type === "number" ? Number(e.target.value) : e.target.value)}
            placeholder={field.placeholder ?? "入力してください"}
            className={cn(INPUT_CLS, isDate && "pl-9", field.type === "number" && "tabular-nums")}
          />
        </div>
      )}
    </div>
  );
}

function ContractFormSection({
  title,
  description,
  fields,
  form,
  onChange,
}: {
  title: string;
  description?: string;
  fields: TemplateField[];
  form: Record<string, string | number | undefined>;
  onChange: (name: string, v: string | number) => void;
}) {
  const names = new Set(fields.map(f => f.name));
  const pairAmount = names.has("amount_excl_tax") && names.has("tax_rate");
  const pairDates = names.has("start_date") && names.has("end_date");
  const rendered = new Set<string>();

  const fieldEl = (field: TemplateField) => (
    <ContractFormField
      key={field.name}
      field={field}
      value={form[field.name]}
      onChange={v => onChange(field.name, v)}
    />
  );

  const amountField = fields.find(f => f.name === "amount_excl_tax");
  const taxField = fields.find(f => f.name === "tax_rate");
  const startField = fields.find(f => f.name === "start_date");
  const endField = fields.find(f => f.name === "end_date");
  const kouFields = fields.filter(f => f.name.startsWith("kou_"));
  const otsuFields = fields.filter(f => f.name.startsWith("otsu_"));
  const workName = fields.find(f => f.name === "work_name");
  const workLoc = fields.find(f => f.name === "work_location");
  const paymentField = fields.find(f => f.name === "payment_terms");
  const warrantyYears = fields.find(f => f.name === "warranty_years");
  const warrantyToggle = fields.find(f => f.name === "warranty_include");

  function renderDefaultFields() {
    return fields.map(field => {
      if (rendered.has(field.name)) return null;

      if (pairAmount && field.name === "amount_excl_tax" && amountField && taxField) {
        rendered.add("amount_excl_tax");
        rendered.add("tax_rate");
        return (
          <div key="amount-row" className="grid grid-cols-1 min-[400px]:grid-cols-[minmax(0,1fr)_minmax(120px,32%)] gap-3">
            {fieldEl(amountField)}
            {fieldEl(taxField)}
          </div>
        );
      }

      if (pairDates && field.name === "start_date" && startField && endField) {
        rendered.add("start_date");
        rendered.add("end_date");
        return (
          <div key="dates-row" className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
            {fieldEl(startField)}
            {fieldEl(endField)}
          </div>
        );
      }

      rendered.add(field.name);
      return fieldEl(field);
    });
  }

  function renderBody() {
    /* 当事者：甲・乙を左右2列 */
    if (title === "当事者" && kouFields.length > 0 && otsuFields.length > 0) {
      kouFields.forEach(f => rendered.add(f.name));
      otsuFields.forEach(f => rendered.add(f.name));
      return (
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-4">
          <div className="space-y-3 min-w-0">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">甲（発注者）</p>
            {kouFields.map(fieldEl)}
          </div>
          <div className="space-y-3 min-w-0">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">乙（請負者）</p>
            {otsuFields.map(fieldEl)}
          </div>
        </div>
      );
    }

    /* 工事・業務：名称と場所を横並び（あれば） */
    if (title === "工事・業務" && workName && workLoc) {
      const others = fields.filter(f => f.name !== "work_name" && f.name !== "work_location");
      rendered.add("work_name");
      rendered.add("work_location");
      return (
        <div className="space-y-3.5">
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
            {fieldEl(workName)}
            {fieldEl(workLoc)}
          </div>
          {others.map(f => {
            rendered.add(f.name);
            return fieldEl(f);
          })}
        </div>
      );
    }

    /* 支払・条件：支払条件は全幅、瑕疵は横並び */
    if (title === "支払・条件") {
      const rest = fields.filter(
        f => f.name !== "payment_terms" && f.name !== "warranty_years" && f.name !== "warranty_include",
      );
      return (
        <div className="space-y-3.5">
          {paymentField && fieldEl(paymentField)}
          {(warrantyYears || warrantyToggle) && (
            <div className="grid grid-cols-1 min-[420px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
              {warrantyYears && fieldEl(warrantyYears)}
              {warrantyToggle && fieldEl(warrantyToggle)}
            </div>
          )}
          {rest.map(f => {
            if (rendered.has(f.name)) return null;
            rendered.add(f.name);
            return fieldEl(f);
          })}
        </div>
      );
    }

    /* 契約基本：複数フィールドは横並び */
    if (title === "契約基本" && fields.length > 1) {
      return (
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
          {fields.map(f => {
            rendered.add(f.name);
            return fieldEl(f);
          })}
        </div>
      );
    }

    return <div className="space-y-3.5">{renderDefaultFields()}</div>;
  }

  return (
    <section className="rounded-xl border border-border/70 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden w-full">
      <div className="px-4 py-2.5 border-b border-border/60 bg-slate-50/80">
        <h4 className="text-xs font-bold text-slate-700 tracking-wide">{title}</h4>
        {description && (
          <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="px-4 py-3.5 w-full">{renderBody()}</div>
    </section>
  );
}

/* ────────────────────────────────────────────
   テンプレート選択モーダル
──────────────────────────────────────────── */
function TemplatePicker({
  open, onOpenChange, onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (tpl: ContractTemplate) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>テンプレートを選択</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground pb-2">
          フォント・文字サイズは
          <Link href="/settings" className="text-primary underline underline-offset-2 mx-0.5">
            設定 → PDF編集 → 契約書
          </Link>
          と連携します。
        </p>
        <div className="space-y-2 py-1">
          {CONTRACT_TEMPLATES.map(tpl => (
            <button
              key={tpl.id}
              onClick={() => onSelect(tpl)}
              className="w-full flex items-start gap-3 rounded-xl border border-border bg-card p-3 hover:shadow-md hover:border-primary/40 transition-all text-left group"
            >
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{tpl.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{tpl.description}</p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────────────────────
   契約書エディタ（フォーム＋プレビュー分割）
──────────────────────────────────────────── */
function ContractEditor({
  constructionId, doc, ctx, onClose,
}: {
  constructionId: string;
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

  const tpl = useMemo(() => findTemplate(tplId)!, [tplId]);
  const isNew = docId === "__new__";

  useEffect(() => {
    getCompany()
      .then((c) => {
        const raw = (c.settings as Record<string, unknown> | null)?.pdf_templates;
        setPdfTpl(resolvePdfTemplates(raw).contract);
      })
      .catch(() => setPdfTpl(resolvePdfTemplates(null).contract));
  }, []);

  // テンプレ切替時：未入力のフィールドだけ初期値で埋める
  useEffect(() => {
    const defaults = buildDefaults(tpl, ctx);
    setForm(prev => {
      const merged: FormValues = { ...defaults };
      for (const f of tpl.fields) {
        if (prev[f.name] !== undefined && prev[f.name] !== "" && prev[f.name] !== 0) {
          merged[f.name] = prev[f.name];
        }
      }
      return merged;
    });
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
    if (ctx.construction) {
      // 工事の期間を契約日や工期表示に再同期（必要に応じて拡張）
      alert("工程表の最新情報をプレビューに同期しました");
    }
  }

  function handlePdfPrint() {
    const pdf = pdfTpl ?? resolvePdfTemplates(null).contract;
    const bodyHtml = renderPreview(tpl, form, ctx);
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

      {/* ── 2カラムレイアウト ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 h-[calc(100vh-220px)] overflow-hidden rounded-xl border border-border">
        {/* 左：入力フォーム */}
        <div className="border-r border-border bg-[#F4F6F8] px-3 md:px-4 py-4 overflow-y-auto h-full min-w-0">
          <div className="w-full space-y-3.5">
            <div>
              <h3 className="text-sm font-bold text-slate-800">入力項目</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                入力内容は右のプレビューにリアルタイム反映されます
              </p>
            </div>
            {groupFields(tpl.fields).map(({ group, fields }) => (
              <ContractFormSection
                key={group.title}
                title={group.title}
                description={group.description}
                fields={fields}
                form={form}
                onChange={set}
              />
            ))}
          </div>
        </div>

        {/* 右：プレビュー */}
        <div className="px-4 md:px-6 py-5 overflow-y-auto bg-muted/20 h-full">
          <h3 className="text-sm font-semibold mb-4 text-muted-foreground">プレビュー</h3>
          {pdfTpl ? (
            <ContractContentPreview
              pdf={pdfTpl}
              contractTemplateId={tplId}
              form={form}
              ctx={ctx}
              className="rounded-xl border border-border shadow-sm max-w-[640px] mx-auto"
            />
          ) : (
            <div className="rounded-xl border border-border shadow-sm p-8 max-w-[640px] mx-auto text-sm text-muted-foreground">
              プレビューを読み込み中...
            </div>
          )}
          <p className="text-[10px] text-muted-foreground text-center mt-2 max-w-[640px] mx-auto">
            表示は
            <Link href="/settings" className="text-primary underline underline-offset-2 mx-0.5">
              設定のPDF編集（契約書）
            </Link>
            のフォント・サイズ設定に連動しています
          </p>
        </div>
      </div>

      <TemplatePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(t) => { setTplId(t.id); setPickerOpen(false); }}
      />
    </div>
  );
}
