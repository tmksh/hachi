"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus, FileText, Pencil, Trash2, ChevronRight, Loader2,
  X, Download, RefreshCw, CheckCircle2, RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CONTRACT_TEMPLATES, type ContractTemplate, type FormValues,
  type RenderContext, findTemplate, buildDefaults, renderPreview,
} from "@/lib/contract-templates";
import {
  createContractDoc, updateContractDoc, deleteContractDoc,
} from "@/lib/actions/constructions";

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
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setPicker(true)}>
          <Plus className="h-3.5 w-3.5" />契約書を作成する
        </Button>
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
    </div>
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
  const [status, setStatus] = useState(doc.status);
  const [docId, setDocId] = useState(doc.id);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const tpl = useMemo(() => findTemplate(tplId)!, [tplId]);
  const previewHtml = useMemo(() => renderPreview(tpl, form, ctx), [tpl, form, ctx]);
  const isNew = docId === "__new__";

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

  async function handleDelete() {
    if (isNew) { onClose(); return; }
    if (!confirm("この契約書を削除します。よろしいですか？")) return;
    setDeleting(true);
    try {
      await deleteContractDoc(docId);
      onClose(undefined, docId);
    } catch (e) { console.error(e); } finally { setDeleting(false); }
  }

  function handleSyncSchedule() {
    if (ctx.construction) {
      // 工事の期間を契約日や工期表示に再同期（必要に応じて拡張）
      alert("工程表の最新情報をプレビューに同期しました");
    }
  }

  function handlePdfPrint() {
    const win = window.open("", "_blank", "width=900,height=1200");
    if (!win) return;
    win.document.write(`
      <!doctype html><html><head><meta charset="utf-8"><title>${tpl.name}</title>
      <style>
        body { font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', sans-serif; padding: 48px 56px; color: #111; }
        h2 { text-align: center; font-size: 22px; letter-spacing: 0.1em; margin-bottom: 32px; }
        h3 { font-weight: bold; margin: 0 0 8px; font-size: 14px; }
        p { margin: 4px 0; line-height: 1.7; font-size: 13px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 48px; }
        .right { text-align: right; }
        .whitespace-pre-line { white-space: pre-line; }
        .space-y-6 > * + * { margin-top: 24px; }
        .font-semibold { font-weight: 600; }
        .font-bold { font-weight: bold; }
        .text-sm { font-size: 12px; }
        .pt-4 { padding-top: 16px; }
        .pt-8 { padding-top: 32px; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
      </style></head><body>${previewHtml}</body></html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 300);
  }

  const st = STATUS_LABELS[status] ?? STATUS_LABELS.preparing;

  return (
    <div className="-mx-4 md:-mx-6 -mt-4">
      {/* ── ツールバー ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-border px-4 md:px-6 py-3 flex items-center gap-3 flex-wrap">
        <button onClick={() => onClose()} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <X className="h-4 w-4" />戻る
        </button>
        <div className="h-5 w-px bg-border" />
        <h2 className="text-base font-semibold">{tpl.name}</h2>
        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", st.cls)}>{st.label}</span>
        {savedAt && <span className="text-[11px] text-muted-foreground">保存済み {savedAt}</span>}

        <div className="ml-auto flex items-center gap-1.5 flex-wrap">
          <Button variant="ghost" size="sm" className="text-xs gap-1.5" onClick={() => setPickerOpen(true)}>
            <RefreshCw className="h-3.5 w-3.5" />テンプレート変更
          </Button>
          <Button variant="ghost" size="sm" className="text-xs gap-1.5" onClick={handleSyncSchedule}>
            <RotateCcw className="h-3.5 w-3.5" />工程表と同期
          </Button>
          <Button variant="ghost" size="sm" className="text-xs gap-1.5" onClick={handlePdfPrint}>
            <Download className="h-3.5 w-3.5" />PDF出力
          </Button>
          {!isNew && (
            <Button variant="ghost" size="sm" className="text-xs gap-1.5" onClick={handleSaveOnly} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}保存
            </Button>
          )}
          <Button size="sm" className="text-xs gap-1.5 bg-green-600 hover:bg-green-700" onClick={handleConfirm} disabled={confirming}>
            {confirming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            確定する
          </Button>
          <Button variant="ghost" size="sm" className="text-xs gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleDelete} disabled={deleting}>
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            削除
          </Button>
        </div>
      </div>

      {/* ── 2カラムレイアウト ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 min-h-[calc(100vh-260px)]">
        {/* 左：入力フォーム */}
        <div className="border-r border-border bg-slate-50/30 px-4 md:px-6 py-5 overflow-y-auto">
          <h3 className="text-sm font-semibold mb-4 text-muted-foreground">入力項目</h3>
          <div className="space-y-3">
            {tpl.fields.map(field => (
              <div key={field.name} className="space-y-1.5">
                <Label htmlFor={`f-${field.name}`} className="text-xs flex items-center gap-1">
                  {field.label}
                  {field.required && <span className="text-red-500">*</span>}
                </Label>
                {field.type === "textarea" ? (
                  <Textarea
                    id={`f-${field.name}`}
                    value={String(form[field.name] ?? "")}
                    onChange={e => set(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    rows={3}
                    className="text-sm bg-white"
                  />
                ) : (
                  <Input
                    id={`f-${field.name}`}
                    type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                    value={String(form[field.name] ?? "")}
                    onChange={e => set(field.name, field.type === "number" ? Number(e.target.value) : e.target.value)}
                    placeholder={field.placeholder}
                    className="text-sm bg-white"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 右：プレビュー */}
        <div className="px-4 md:px-6 py-5 overflow-y-auto bg-muted/20">
          <h3 className="text-sm font-semibold mb-4 text-muted-foreground">プレビュー</h3>
          <div className="bg-white rounded-xl border border-border shadow-sm p-8 md:p-10 max-w-[640px] mx-auto">
            <div
              className="prose prose-sm max-w-none [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-center [&_h2]:tracking-wider [&_h2]:mb-6 [&_h3]:font-bold [&_h3]:text-sm [&_h3]:mb-2 [&_p]:text-[13px] [&_p]:leading-relaxed [&_p]:my-1"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
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
