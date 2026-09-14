"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PdfFormFillerPanel } from "@/components/settings/pdf-form-filler";
import { pdfMappingIssues } from "@/lib/pdf-form-mapping";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Save,
  Upload,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Type,
  Calendar,
  CalendarRange,
  Hash,
  AlignLeft,
  CheckSquare,
  PenLine,
  Lock,
  Loader2,
  User,
  MapPin,
  Wrench,
  Wallet,
  CalendarClock,
  Sparkles,
  Eye,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { uploadToStorage } from "@/lib/storage-browser";
import { savePdfFormTemplate } from "@/lib/actions/pdf-form-templates";
import {
  loadPdfDocument,
  PdfPageCanvas,
} from "@/components/settings/pdf-page-canvas";
import {
  BINDING_LABELS,
  BINDINGS_FOR_TYPE,
  CUSTOMER_BINDINGS,
  FIELD_TYPE_LABELS,
  PDF_FORM_DOC_TYPE_LABELS,
  bindingDisplayLabel,
  newFieldDefaults,
  changeFieldType,
  changeFieldBinding,
  validatePdfTemplate,
  type FillContext,
  type PdfFieldType,
  type PdfFieldBinding,
  type PdfFormDocType,
  type PdfFormField,
  type PdfFormTemplate,
} from "@/lib/pdf-form-template";
import { slotPlacementForPalette, slotsFromPdfPage, type FormSlot } from "@/lib/pdf-form-snap";


type PaletteItem = {
  label: string;
  type: PdfFieldType;
  binding: PdfFieldBinding;
  bindingKey?: string;
  icon: React.ElementType;
};

/** 案件・日付 */
const PROJECT_PALETTE: PaletteItem[] = [
  { label: "名称", type: "text", binding: "construction_title", icon: Wrench },
  { label: "工事番号", type: "text", binding: "construction_no", icon: Hash },
  { label: "受注金額（税抜）", type: "number", binding: "order_amount", icon: Wallet },
  { label: "受注金額（税込）", type: "number", binding: "order_amount_tax", icon: Wallet },
  { label: "工期開始", type: "date", binding: "start_date", icon: Calendar },
  { label: "工期終了", type: "date", binding: "end_date", icon: CalendarRange },
  { label: "本日日付", type: "date", binding: "today", icon: CalendarClock },
];

const CUSTOMER_PALETTE: PaletteItem[] = [
  { label: "契約者氏名", type: "text", binding: "customer_name", icon: User },
  { label: "会社名", type: "text", binding: "customer_company_name", icon: User },
  { label: "法人/個人", type: "text", binding: "customer_type", icon: User },
  { label: "電話番号", type: "text", binding: "customer_phone", icon: User },
  { label: "メールアドレス", type: "text", binding: "customer_email", icon: User },
  { label: "EIGHT-ID", type: "text", binding: "customer_eight_id", icon: Hash },
  { label: "部門", type: "text", binding: "customer_department", icon: User },
  { label: "年齢", type: "number", binding: "customer_age", icon: Hash },
  { label: "住所", type: "textarea", binding: "customer_address", icon: MapPin },
  { label: "知ったきっかけ", type: "text", binding: "customer_source", icon: User },
  { label: "問い合わせ分類", type: "text", binding: "customer_inquiry_category", icon: User },
  { label: "問い合わせ日", type: "date", binding: "customer_inquiry_date", icon: Calendar },
  { label: "問い合わせ内容", type: "textarea", binding: "customer_inquiry_content", icon: AlignLeft },
  { label: "担当者", type: "text", binding: "customer_assignee", icon: User },
  { label: "予算感（下限）", type: "number", binding: "customer_budget_min", icon: Wallet },
  { label: "予算感（上限）", type: "number", binding: "customer_budget_max", icon: Wallet },
  { label: "見込度", type: "text", binding: "customer_prospect_grade", icon: User },
  { label: "特需", type: "checkbox", binding: "customer_special_demand", icon: User },
  { label: "備考", type: "textarea", binding: "customer_notes", icon: AlignLeft },
];

/** 自由項目：手入力・固定文など */
const MANUAL_PALETTE: PaletteItem[] = [
  { label: "数値", type: "number", binding: "manual", icon: Hash },
  { label: "日付", type: "date", binding: "manual", icon: Calendar },
  { label: "テキスト入力", type: "text", binding: "manual", icon: Type },
  { label: "テキストエリア", type: "textarea", binding: "manual", icon: AlignLeft },
  { label: "チェックボックス", type: "checkbox", binding: "manual", icon: CheckSquare },
  { label: "署名", type: "signature", binding: "manual", icon: PenLine },
  { label: "固定テキスト", type: "fixed", binding: "manual", icon: Lock },
];

const PALETTE_MIME = "application/x-pdf-field";
const PREVIEW_CONTEXT: FillContext = {
  recordId: "template-preview",
  constructionTitle: "サンプル邸 改修工事", constructionNo: "CST-0021", orderAmount: 12000000,
  startDate: "2026-09-25", endDate: "2027-03-24",
  customer: { name: "山田 太郎", company_name: "サンプル株式会社", address: "東京都千代田区1-2-3", phone: "03-1234-5678", email: "sample@example.com" },
};

function startPaletteDrag(e: React.DragEvent, item: PaletteItem) {
  e.dataTransfer.setData(PALETTE_MIME, JSON.stringify({ label: item.label, type: item.type, binding: item.binding, bindingKey: item.bindingKey }));
  e.dataTransfer.effectAllowed = "copy";
}

function uid() {
  return `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function PaletteButtons({ items, onAdd }: { items: PaletteItem[]; onAdd: (item: PaletteItem) => void }) {
  return (
    <div className="space-y-1.5">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={`${item.binding}:${item.bindingKey ?? item.label}`}
            draggable
            onDragStart={(e) => startPaletteDrag(e, item)}
            onClick={() => onAdd(item)}
            className="flex w-full items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50/40 px-2.5 py-2 text-left text-xs transition-colors hover:bg-emerald-50"
          >
            <Icon className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function PdfBuilderEditClient({
  id,
  initDocType,
  initialTemplate,
  initialPdfUrl,
  customFieldKeys = [],
  onSaveTemplate,
  previewContext = PREVIEW_CONTEXT,
}: {
  id: string;
  initDocType: PdfFormDocType;
  initialTemplate: PdfFormTemplate | null;
  initialPdfUrl: string | null;
  customFieldKeys?: string[];
  onSaveTemplate?: (template: PdfFormTemplate) => Promise<void>;
  previewContext?: FillContext;
}) {
  const router = useRouter();
  const isNew = id === "new";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [name, setName] = useState(initialTemplate?.name ?? "新規テンプレート");
  const [docType, setDocType] = useState<PdfFormDocType>(initialTemplate?.docType ?? initDocType);
  const [storagePath, setStoragePath] = useState<string>(initialTemplate?.storagePath ?? "");
  const [fileName, setFileName] = useState<string>(initialTemplate?.fileName ?? "");
  const [fields, setFields] = useState<PdfFormField[]>(initialTemplate?.fields ?? []);
  const [pageSizes, setPageSizes] = useState<{ width: number; height: number }[]>(initialTemplate?.pageSizes ?? []);

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [activePage, setActivePage] = useState(0); // 0-based
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const pageWrapRef = useRef<HTMLDivElement>(null);
  const [renderSize, setRenderSize] = useState<{ width: number; height: number } | null>(null);
  const [containerWidth, setContainerWidth] = useState(680);
  const [analyzing, setAnalyzing] = useState(false);
  const [allPageSlots, setAllPageSlots] = useState<FormSlot[][]>([]);
  const pageSlots = allPageSlots[activePage] ?? [];
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pdfSource, setPdfSource] = useState<string | null>(initialPdfUrl);
  const localPdfUrlRef = useRef<string | null>(null);
  const issues = pdfMappingIssues(fields, allPageSlots);
  const draftTemplate: PdfFormTemplate = {
    id: isNew ? "new" : id, name: name.trim(), docType,
    isActive: initialTemplate?.isActive ?? false,
    storagePath, fileName, pageCount: pageSizes.length, pageSizes, fields,
    createdAt: initialTemplate?.createdAt ?? "", updatedAt: initialTemplate?.updatedAt ?? "",
  };
  const configurationIssues = validatePdfTemplate(draftTemplate);
  useEffect(() => () => {
    if (localPdfUrlRef.current) URL.revokeObjectURL(localPdfUrlRef.current);
  }, []);

  // ─── サーバーから受け取った PDF をクライアントで描画 ───
  useEffect(() => {
    if (isNew) return;
    if (!initialTemplate) {
      toast.error("テンプレートが見つかりません");
      router.push("/settings/pdf-builder");
      return;
    }
    if (!initialPdfUrl) return;
    let cancelled = false;
    setLoading(true);
    loadPdfDocument(initialPdfUrl)
      .then((d) => { if (!cancelled) setDoc(d); })
      .catch(() => { if (!cancelled) toast.error("読み込みに失敗しました"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, isNew, initialTemplate, initialPdfUrl, router]);

  // ─── コンテナ幅の追従 ───
  useEffect(() => {
    const el = pageWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setContainerWidth(Math.max(160, Math.min(820, w)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [doc]);

  // ─── PDFインポート ───
  const handleFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("PDFは10MB以下にしてください");
      return;
    }
    if (file.type !== "application/pdf") {
      toast.error("PDFファイルを選択してください");
      return;
    }
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const d = await loadPdfDocument(buf.slice(0));
      const sizes: { width: number; height: number }[] = [];
      for (let i = 1; i <= d.numPages; i++) {
        const page = await d.getPage(i);
        const vp = page.getViewport({ scale: 1 });
        sizes.push({ width: vp.width, height: vp.height });
      }
      // アップロード
      const path = `pdf-form-templates/${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`;
      if (!onSaveTemplate) await uploadToStorage("documents", path, file);
      if (localPdfUrlRef.current) URL.revokeObjectURL(localPdfUrlRef.current);
      localPdfUrlRef.current = URL.createObjectURL(file);
      setPdfSource(localPdfUrlRef.current);
      setDoc(d);
      setPageSizes(sizes);
      setStoragePath(path);
      setFileName(file.name);
      setActivePage(0);
      if (name === "新規テンプレート") {
        setName(file.name.replace(/\.pdf$/i, ""));
      }
    } catch (e: unknown) {
      toast.error(`インポート失敗: ${e instanceof Error ? e.message : "不明なエラー"}`);
    } finally {
      setUploading(false);
    }
  };

  // ─── 項目の追加 ───
  const addField = (item: Omit<PaletteItem, "icon">, point?: { x: number; y: number }) => {
    const taken = fields.filter((f) => f.page === activePage).map((f) => ({
      x: f.xPct, y: f.yPct, w: f.wPct, h: f.hPct,
    }));
    const slot = slotPlacementForPalette(item.binding, item.type, item.label, pageSlots, taken);
    const defaults = newFieldDefaults(item.type, activePage);
    const f: PdfFormField = {
      id: uid(),
      ...defaults,
      label: item.label,
      binding: item.binding,
      bindingKey: item.bindingKey,
      ...(slot && !point ? { xPct: slot.x, yPct: slot.y, wPct: slot.w, hPct: slot.h } : { yPct: 0.1 + (fields.filter((f) => f.page === activePage).length % 15) * 0.04 }),
      ...(point ? { xPct: Math.max(0, Math.min(1 - defaults.wPct, point.x)), yPct: Math.max(0, Math.min(1 - defaults.hPct, point.y)) } : {}),
    };
    setFields((prev) => [...prev, f]);
    setSelectedId(f.id);
  };

  const updateField = (fid: string, patch: Partial<PdfFormField>) => {
    setFields((prev) => prev.map((f) => (f.id === fid ? { ...f, ...patch } : f)));
  };

  const removeField = (fid: string) => {
    setFields((prev) => prev.filter((f) => f.id !== fid));
    if (selectedId === fid) setSelectedId(null);
  };

  // ─── ドラッグ移動 ───
  const dragState = useRef<{ fid: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeState = useRef<{ fid: string; startX: number; startY: number; origW: number; origH: number } | null>(null);

  const onFieldPointerDown = (e: React.PointerEvent, f: PdfFormField) => {
    e.stopPropagation();
    setSelectedId(f.id);
    dragState.current = { fid: f.id, startX: e.clientX, startY: e.clientY, origX: f.xPct, origY: f.yPct };
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragEnd);
  };

  const onDragMove = useCallback((e: PointerEvent) => {
    const st = dragState.current;
    const size = renderSizeRef.current;
    if (!st || !size) return;
    const dx = (e.clientX - st.startX) / size.width;
    const dy = (e.clientY - st.startY) / size.height;
    setFields((prev) =>
      prev.map((f) =>
        f.id === st.fid
          ? {
              ...f,
              xPct: Math.max(0, Math.min(1 - f.wPct, st.origX + dx)),
              yPct: Math.max(0, Math.min(1 - f.hPct, st.origY + dy)),
            }
          : f,
      ),
    );
  }, []);

  const onDragEnd = useCallback(() => {
    dragState.current = null;
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", onDragEnd);
  }, [onDragMove]);

  const onResizePointerDown = (e: React.PointerEvent, f: PdfFormField) => {
    e.stopPropagation();
    resizeState.current = { fid: f.id, startX: e.clientX, startY: e.clientY, origW: f.wPct, origH: f.hPct };
    window.addEventListener("pointermove", onResizeMove);
    window.addEventListener("pointerup", onResizeEnd);
  };

  const onResizeMove = useCallback((e: PointerEvent) => {
    const st = resizeState.current;
    const size = renderSizeRef.current;
    if (!st || !size) return;
    const dw = (e.clientX - st.startX) / size.width;
    const dh = (e.clientY - st.startY) / size.height;
    setFields((prev) =>
      prev.map((f) =>
        f.id === st.fid
          ? {
              ...f,
              wPct: Math.max(0.03, Math.min(1 - f.xPct, st.origW + dw)),
              hPct: Math.max(0.015, Math.min(1 - f.yPct, st.origH + dh)),
            }
          : f,
      ),
    );
  }, []);

  const onResizeEnd = useCallback(() => {
    resizeState.current = null;
    window.removeEventListener("pointermove", onResizeMove);
    window.removeEventListener("pointerup", onResizeEnd);
  }, [onResizeMove]);

  // renderSize を ref で参照（リスナー内で最新値が必要）
  const renderSizeRef = useRef(renderSize);
  useEffect(() => {
    renderSizeRef.current = renderSize;
  }, [renderSize]);

  // ─── 保存 ───
  const handleSave = async () => {
    if (!storagePath) {
      toast.error("先にPDFをインポートしてください");
      return;
    }
    if (!name.trim()) {
      toast.error("テンプレート名を入力してください");
      return;
    }
    const issue = [...configurationIssues, ...issues][0];
    if (issue) {
      setSelectedId(issue.fieldId);
      setActivePage(fields.find((f) => f.id === issue.fieldId)?.page ?? 0);
      toast.error(issue.message);
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const tpl: PdfFormTemplate = {
        id: isNew ? `tpl_${Date.now().toString(36)}` : (id as string),
        name: name.trim(),
        docType,
        isActive: initialTemplate?.isActive ?? false,
        storagePath,
        fileName,
        pageCount: pageSizes.length,
        pageSizes,
        fields,
        createdAt: now,
        updatedAt: now,
      };
      if (onSaveTemplate) await onSaveTemplate(tpl);
      else await savePdfFormTemplate(tpl);
      toast.success("保存しました");
      if (!onSaveTemplate) router.push("/settings?tab=pdf_builder");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    setAnalyzing(true);
    setAllPageSlots([]);
    Promise.all(Array.from({ length: doc.numPages }, async (_, p) => {
      const page = await doc.getPage(p + 1);
      const viewport = page.getViewport({ scale: 1 });
      return { size: { width: viewport.width, height: viewport.height }, slots: await slotsFromPdfPage(page) };
    })).then((pages) => {
      if (!cancelled) {
        setPageSizes(pages.map((page) => page.size));
        setAllPageSlots(pages.map((page) => page.slots));
      }
    }).catch(() => {
      if (!cancelled) toast.error("PDFの項目確認に失敗しました。PDFを開き直してください。");
    }).finally(() => { if (!cancelled) setAnalyzing(false); });
    return () => { cancelled = true; };
  }, [doc]);

  const selectedField = useMemo(() => fields.find((f) => f.id === selectedId) ?? null, [fields, selectedId]);
  const pageFields = useMemo(() => fields.filter((f) => f.page === activePage), [fields, activePage]);
  const aspect = pageSizes[activePage] ? pageSizes[activePage].height / pageSizes[activePage].width : 1.414;
  const renderW = containerWidth;
  const renderH = renderW * aspect;

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-h-[600px] flex-col">
      {/* ヘッダー */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push("/settings?tab=pdf_builder")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 w-56 text-sm font-medium"
            placeholder="テンプレート名"
          />
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value as PdfFormDocType)}
            className="h-8 rounded-md border-0 bg-muted/60 px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {Object.entries(PDF_FORM_DOC_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}</select>
        </div>
        <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" variant="outline" disabled={!doc || analyzing} onClick={() => setPreviewOpen(true)}><Eye className="mr-1 h-4 w-4" />入力プレビュー</Button>
        <Button size="sm" onClick={handleSave} disabled={saving || loading || analyzing || !doc || !storagePath}>
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          保存
        </Button>
        </div>
      </div>
      {issues.length > 0 && <div role="alert" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
        {issues.map((issue) => <div key={issue.fieldId} className="flex flex-wrap items-center gap-2"><span>{issue.message}</span>{(issue.suggestedBinding || issue.suggestedSlot) && <Button size="sm" variant="outline" onClick={() => {
          const f = fields.find((f) => f.id === issue.fieldId);
          if (!f) return;
          if (issue.suggestedBinding) updateField(f.id, changeFieldBinding(f, issue.suggestedBinding));
          else if (issue.suggestedSlot) {
            const slot = issue.suggestedSlot;
            updateField(f.id, { xPct: slot.x, yPct: slot.y, wPct: slot.w, hPct: slot.h });
          }
          setSelectedId(f.id); setActivePage(f.page);
        }}>{issue.suggestedBinding ? `${BINDING_LABELS[issue.suggestedBinding]}と連携する` : "金額の欄へ移動"}</Button>}<Button size="sm" variant="ghost" onClick={() => { setSelectedId(issue.fieldId); setActivePage(fields.find((f) => f.id === issue.fieldId)?.page ?? 0); }}>項目を確認</Button></div>)}
      </div>}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="flex max-h-[94vh] w-[96vw] max-w-[1200px] flex-col overflow-hidden sm:max-w-[1200px]">
          <DialogHeader><DialogTitle>入力プレビュー</DialogTitle><DialogDescription>確認用のサンプル情報です。入力内容・表示形式・必須項目・編集可否を確認できます。</DialogDescription></DialogHeader>
          <PdfFormFillerPanel template={draftTemplate} ctx={previewContext} pdfSource={pdfSource ?? undefined} className="min-h-0 overflow-auto" />
        </DialogContent>
      </Dialog>

      {/* インポート未済 */}
      {!doc ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <label onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file && !uploading) void handleFile(file); }} className="flex w-full max-w-md cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-20 text-center transition-colors hover:border-primary/50 hover:bg-muted/30">
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Upload className="h-5 w-5 text-muted-foreground" />
              </span>
            )}
            <div className="text-sm font-medium">PDFをインポートする</div>
            <div className="text-xs text-muted-foreground">
              クリックまたはPDFファイルをドラッグ&ドロップ
            </div>
            <div className="text-[11px] text-muted-foreground/70">対応形式: PDF（最大10MB）</div>
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
          </label>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 overflow-x-auto">
          {/* 左：項目パレット */}
          <aside className="w-44 lg:w-52 shrink-0 overflow-y-auto border-r p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
              <Sparkles className="h-3 w-3" />案件
            </div>
            <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
              置くだけでデータが自動で入ります。
            </p>
            <PaletteButtons items={PROJECT_PALETTE} onAdd={addField} />

            <div className="mt-4 mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
              <User className="h-3 w-3" />顧客情報
            </div>
            <PaletteButtons items={CUSTOMER_PALETTE} onAdd={addField} />

            <div className="mt-4 mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
              その他項目
            </div>
            <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
              顧客画面で追加した項目です。
            </p>
            <PaletteButtons
              items={[
                ...customFieldKeys.map((key) => ({
                  label: key,
                  type: "text" as const,
                  binding: "customer_custom" as const,
                  bindingKey: key,
                  icon: Type,
                })),
                {
                  label: "項目名を指定",
                  type: "text" as const,
                  binding: "customer_custom" as const,
                  icon: Type,
                },
              ]}
              onAdd={addField}
            />

            <div className="mt-4 mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <PenLine className="h-3 w-3" />自由項目
            </div>
            <div className="space-y-1.5">
              {MANUAL_PALETTE.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    draggable
                    onDragStart={(e) => startPaletteDrag(e, item)}
                    onClick={() => addField(item)}
                    className="flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition-colors hover:bg-muted"
                  >
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              項目をPDF上へドラッグして配置します。クリックで追加した項目も移動できます。
            </p>
            <div className="mt-4 border-t pt-3">
              <p className="mb-2 text-xs font-semibold">配置済み項目（{fields.length}）</p>
              {fields.map((f) => <button key={f.id} onClick={() => { setActivePage(f.page); setSelectedId(f.id); }} className={`mb-1 w-full rounded border px-2 py-2 text-left text-xs ${selectedId === f.id ? "border-primary bg-primary/10" : "border-transparent hover:bg-muted"}`}>
                <span className="block truncate">{f.label}{f.required ? " *" : ""}</span>
                <span className="block truncate text-[10px] text-muted-foreground">P{f.page + 1} · {bindingDisplayLabel(f)}</span>
              </button>)}
            </div>
          </aside>

          {/* 中央：PDFプレビュー */}
          <div className="flex min-w-[250px] flex-1 flex-col overflow-hidden bg-muted/30">
            {/* ページナビ */}
            <div className="flex items-center justify-center gap-3 border-b bg-background py-1.5 text-sm">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={activePage === 0}
                onClick={() => setActivePage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="tabular-nums">
                {activePage + 1} / {pageSizes.length} ページ
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={activePage >= pageSizes.length - 1}
                onClick={() => setActivePage((p) => Math.min(pageSizes.length - 1, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              <div ref={pageWrapRef} className="mx-auto" style={{ maxWidth: 820 }}>
                <div
                  className="relative mx-auto bg-white shadow"
                  style={{ width: renderW, height: renderH }}
                  onPointerDown={() => setSelectedId(null)}
                  data-testid="pdf-builder-page"
                  onDragOver={(e) => { if (e.dataTransfer.types.includes(PALETTE_MIME)) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } }}
                  onDrop={(e) => {
                    e.preventDefault();
                    try {
                      const item = JSON.parse(e.dataTransfer.getData(PALETTE_MIME)) as Omit<PaletteItem, "icon">;
                      if (!FIELD_TYPE_LABELS[item.type] || !BINDINGS_FOR_TYPE[item.type].includes(item.binding)) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      addField(item, { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height });
                    } catch { /* 外部のドラッグデータは項目として扱わない */ }
                  }}
                >
                  <PdfPageCanvas
                    doc={doc}
                    pageNumber={activePage + 1}
                    width={renderW}
                    onRendered={setRenderSize}
                    className="pointer-events-none absolute inset-0 h-full w-full"
                  />
                  {/* 配置済み項目 */}
                  {pageFields.map((f) => (
                    <div
                      key={f.id}
                      data-field-id={f.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`配置項目 ${f.label}`}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedId(f.id); } }}
                      onPointerDown={(e) => onFieldPointerDown(e, f)}
                      className={`absolute box-border cursor-move select-none overflow-hidden rounded-sm border text-[10px] ${
                        selectedId === f.id
                          ? "border-primary bg-primary/10"
                          : "border-primary/40 bg-primary/5"
                      }`}
                      style={{
                        left: f.xPct * renderW,
                        top: f.yPct * renderH,
                        width: f.wPct * renderW,
                        height: f.hPct * renderH,
                      }}
                    >
                      <span className="pointer-events-none absolute left-0.5 top-0.5 max-w-full truncate rounded bg-primary/80 px-1 text-[9px] leading-tight text-white">
                        {f.label}
                        {f.binding !== "manual" && f.type !== "fixed" ? ` · ${bindingDisplayLabel(f)}` : ""}
                      </span>
                      {selectedId === f.id && (
                        <span
                          onPointerDown={(e) => onResizePointerDown(e, f)}
                          className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize rounded-sm border border-white bg-primary"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 右：項目設定 */}
          <aside className="w-60 lg:w-72 shrink-0 overflow-y-auto border-l p-4">
            {!selectedField ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-xs text-muted-foreground">
                項目を選択すると
                <br />
                設定が表示されます
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">{FIELD_TYPE_LABELS[selectedField.type]}</div>
                  <div className="flex gap-1">
                  <Button variant="ghost" size="icon" aria-label="項目を複製" className="h-7 w-7" onClick={() => {
                    const copy = { ...selectedField, id: uid(), xPct: Math.min(1 - selectedField.wPct, selectedField.xPct + 0.02), yPct: Math.min(1 - selectedField.hPct, selectedField.yPct + 0.04) };
                    setFields((prev) => [...prev, copy]); setSelectedId(copy.id);
                  }}><Copy className="h-3.5 w-3.5" /></Button>
                  <Button
                    aria-label="項目を削除"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => removeField(selectedField.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">項目の種類</Label>
                  <Select value={selectedField.type} onValueChange={(value) => updateField(selectedField.id, changeFieldType(selectedField, value as PdfFieldType))}>
                    <SelectTrigger aria-label="項目の種類" className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(FIELD_TYPE_LABELS).map(([type, label]) => <SelectItem key={type} value={type}>{label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">項目名</Label>
                  <Input
                    aria-label="項目名"
                    value={selectedField.label}
                    onChange={(e) => updateField(selectedField.id, { label: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>

                {selectedField.type === "fixed" ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs">固定テキスト</Label>
                    <Textarea
                      value={selectedField.text ?? ""}
                      onChange={(e) => updateField(selectedField.id, { text: e.target.value })}
                      className="min-h-16 text-sm"
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-xs">データ連携</Label>
                    <Select
                      value={selectedField.binding}
                      onValueChange={(v) =>
                        updateField(selectedField.id, changeFieldBinding(selectedField, v as PdfFieldBinding))
                      }
                    >
                      <SelectTrigger aria-label="データ連携" className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>手入力</SelectLabel>
                          <SelectItem value="manual">{BINDING_LABELS.manual}</SelectItem>
                        </SelectGroup>
                        {BINDINGS_FOR_TYPE[selectedField.type].some((b) => !b.startsWith("customer_") && b !== "manual") && (
                          <SelectGroup>
                            <SelectLabel>案件</SelectLabel>
                            {BINDINGS_FOR_TYPE[selectedField.type]
                              .filter((b) => !b.startsWith("customer_") && b !== "manual")
                              .map((b) => (
                                <SelectItem key={b} value={b}>{BINDING_LABELS[b]}</SelectItem>
                              ))}
                          </SelectGroup>
                        )}
                        {BINDINGS_FOR_TYPE[selectedField.type].some((b) => CUSTOMER_BINDINGS.includes(b)) && (
                          <SelectGroup>
                            <SelectLabel>顧客情報</SelectLabel>
                            {BINDINGS_FOR_TYPE[selectedField.type]
                              .filter((b) => CUSTOMER_BINDINGS.includes(b))
                              .map((b) => (
                                <SelectItem key={b} value={b}>{BINDING_LABELS[b]}</SelectItem>
                              ))}
                          </SelectGroup>
                        )}
                      </SelectContent>
                    </Select>
                    {selectedField.binding === "customer_custom" && (
                      <div className="space-y-1.5 pt-1">
                        <Label className="text-xs">項目名</Label>
                        {customFieldKeys.length > 0 && (
                          <Select
                            value={selectedField.bindingKey && customFieldKeys.includes(selectedField.bindingKey)
                              ? selectedField.bindingKey
                              : "_other"}
                            onValueChange={(v) => {
                              if (v === "_other") {
                                updateField(selectedField.id, { bindingKey: selectedField.bindingKey ?? "" });
                                return;
                              }
                              updateField(selectedField.id, { bindingKey: v, label: selectedField.label === "項目名を指定" || selectedField.label === "顧客のその他項目" ? v : selectedField.label });
                            }}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="顧客で使っている項目" />
                            </SelectTrigger>
                            <SelectContent>
                              {customFieldKeys.map((key) => (
                                <SelectItem key={key} value={key}>{key}</SelectItem>
                              ))}
                              <SelectItem value="_other">直接入力</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        <Input
                          value={selectedField.bindingKey ?? ""}
                          onChange={(e) => updateField(selectedField.id, { bindingKey: e.target.value })}
                          placeholder="顧客のその他項目名"
                          className="h-8 text-sm"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          顧客情報の「その他項目」の項目名と一致させます。
                        </p>
                      </div>
                    )}
                    {selectedField.binding === "manual" && (
                      <p className="text-[11px] text-muted-foreground">
                        差し込み時に手入力する項目です。既定値を下に入力できます。
                      </p>
                    )}
                  </div>
                )}

                {selectedField.binding === "manual" && selectedField.type !== "fixed" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">既定値（任意）</Label>
                    <Input
                      value={selectedField.text ?? ""}
                      onChange={(e) => updateField(selectedField.id, { text: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                )}

                {selectedField.type !== "fixed" && <div className="space-y-3 border-t pt-3">
                  <div className="flex items-center justify-between"><Label className="text-xs" htmlFor="field-required">必須入力</Label><Switch id="field-required" checked={selectedField.required ?? false} onCheckedChange={(required) => updateField(selectedField.id, { required })} /></div>
                  <div className="flex items-center justify-between"><Label className="text-xs" htmlFor="field-editable">利用者による編集</Label><Switch id="field-editable" checked={selectedField.editable !== false} onCheckedChange={(editable) => updateField(selectedField.id, { editable })} /></div>
                  <div className="space-y-1.5"><Label className="text-xs" htmlFor="field-placeholder">入力のヒント</Label><Input id="field-placeholder" value={selectedField.placeholder ?? ""} onChange={(e) => updateField(selectedField.id, { placeholder: e.target.value })} className="h-8 text-sm" /></div>
                </div>}
                {selectedField.type === "number" && <div className="space-y-1.5">
                  <Label className="text-xs">数値の表示形式</Label>
                  <Select value={selectedField.numberFormat ?? (["order_amount", "order_amount_tax", "customer_budget_min", "customer_budget_max"].includes(selectedField.binding) ? "currency" : "plain")} onValueChange={(v) => updateField(selectedField.id, { numberFormat: v as PdfFormField["numberFormat"] })}>
                    <SelectTrigger aria-label="数値の表示形式"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="plain">数値（12000）</SelectItem><SelectItem value="grouped">桁区切り（12,000）</SelectItem><SelectItem value="currency">円（¥12,000）</SelectItem></SelectContent>
                  </Select>
                </div>}
                {selectedField.type === "date" && <div className="space-y-1.5">
                  <Label className="text-xs">日付の表示形式</Label>
                  <Select value={selectedField.dateFormat ?? "slash"} onValueChange={(v) => updateField(selectedField.id, { dateFormat: v as PdfFormField["dateFormat"] })}>
                    <SelectTrigger aria-label="日付の表示形式"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="slash">2026/09/25</SelectItem><SelectItem value="iso">2026-09-25</SelectItem><SelectItem value="japanese">2026年9月25日</SelectItem></SelectContent>
                  </Select>
                </div>}
                {configurationIssues.filter((issue) => issue.fieldId === selectedField.id).map((issue) => <p role="alert" key={issue.message} className="text-xs text-destructive">{issue.message}</p>)}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">文字サイズ</Label>
                    <Input
                      type="number"
                      min={6}
                      max={48}
                      value={selectedField.fontSize}
                      onChange={(e) => updateField(selectedField.id, { fontSize: Number(e.target.value) || 12 })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">文字色</Label>
                    <input
                      type="color"
                      value={selectedField.color}
                      onChange={(e) => updateField(selectedField.id, { color: e.target.value })}
                      className="h-8 w-full cursor-pointer rounded-md border"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">配置</Label>
                  <Select
                    value={selectedField.align}
                    onValueChange={(v) => updateField(selectedField.id, { align: v as PdfFormField["align"] })}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">左寄せ</SelectItem>
                      <SelectItem value="center">中央</SelectItem>
                      <SelectItem value="right">右寄せ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
