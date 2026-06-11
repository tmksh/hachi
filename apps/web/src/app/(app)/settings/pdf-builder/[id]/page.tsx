"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
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
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  getPdfFormTemplates,
  savePdfFormTemplate,
  getPdfFormTemplateUrl,
} from "@/lib/actions/pdf-form-templates";
import {
  loadPdfDocument,
  PdfPageCanvas,
} from "@/components/settings/pdf-page-canvas";
import {
  BINDING_LABELS,
  BINDINGS_FOR_TYPE,
  FIELD_TYPE_LABELS,
  PDF_FORM_DOC_TYPE_LABELS,
  newFieldDefaults,
  type PdfFieldType,
  type PdfFieldBinding,
  type PdfFormDocType,
  type PdfFormField,
  type PdfFormTemplate,
} from "@/lib/pdf-form-template";

const STORAGE_BUCKET = "documents";

type PaletteItem = {
  label: string;
  type: PdfFieldType;
  binding: PdfFieldBinding;
  icon: React.ElementType;
};

/** 自動入力項目：置くだけでデータソースに紐付く */
const AUTO_PALETTE: PaletteItem[] = [
  { label: "顧客名", type: "text", binding: "customer_name", icon: User },
  { label: "顧客住所", type: "textarea", binding: "customer_address", icon: MapPin },
  { label: "工事名", type: "text", binding: "construction_title", icon: Wrench },
  { label: "工事番号", type: "text", binding: "construction_no", icon: Hash },
  { label: "受注金額（税抜）", type: "number", binding: "order_amount", icon: Wallet },
  { label: "受注金額（税込）", type: "number", binding: "order_amount_tax", icon: Wallet },
  { label: "工期開始", type: "date", binding: "start_date", icon: Calendar },
  { label: "工期終了", type: "date", binding: "end_date", icon: CalendarRange },
  { label: "本日日付", type: "date", binding: "today", icon: CalendarClock },
];

/** 自由項目：手入力・固定文など */
const MANUAL_PALETTE: PaletteItem[] = [
  { label: "テキスト入力", type: "text", binding: "manual", icon: Type },
  { label: "テキストエリア", type: "textarea", binding: "manual", icon: AlignLeft },
  { label: "チェックボックス", type: "checkbox", binding: "manual", icon: CheckSquare },
  { label: "署名", type: "signature", binding: "manual", icon: PenLine },
  { label: "固定テキスト", type: "fixed", binding: "manual", icon: Lock },
];

function uid() {
  return `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export default function PdfBuilderEditPage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNew = id === "new";

  const initDocType = (searchParams.get("type") ?? "contract") as PdfFormDocType;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [name, setName] = useState("新規テンプレート");
  const [docType, setDocType] = useState<PdfFormDocType>(initDocType);
  const [storagePath, setStoragePath] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [fields, setFields] = useState<PdfFormField[]>([]);
  const [pageSizes, setPageSizes] = useState<{ width: number; height: number }[]>([]);

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [activePage, setActivePage] = useState(0); // 0-based
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const pageWrapRef = useRef<HTMLDivElement>(null);
  const [renderSize, setRenderSize] = useState<{ width: number; height: number } | null>(null);
  const [containerWidth, setContainerWidth] = useState(680);

  // ─── 既存テンプレートのロード ───
  useEffect(() => {
    if (isNew) return;
    (async () => {
      try {
        const list = await getPdfFormTemplates();
        const t = list.find((x) => x.id === id);
        if (!t) {
          toast.error("テンプレートが見つかりません");
          router.push("/settings/pdf-builder");
          return;
        }
        setName(t.name);
        setDocType(t.docType ?? "contract");
        setStoragePath(t.storagePath);
        setFileName(t.fileName);
        setFields(t.fields);
        setPageSizes(t.pageSizes);
        const url = await getPdfFormTemplateUrl(t.storagePath);
        if (url) {
          const d = await loadPdfDocument(url);
          setDoc(d);
        }
      } catch {
        toast.error("読み込みに失敗しました");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isNew, router]);

  // ─── コンテナ幅の追従 ───
  useEffect(() => {
    const el = pageWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setContainerWidth(Math.max(320, Math.min(820, w)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [doc]);

  // ─── PDFインポート ───
  const handleFile = async (file: File) => {
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
      const supabase = createClient();
      const path = `pdf-form-templates/${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`;
      const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file);
      if (error) throw error;

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
  const addField = (item: PaletteItem) => {
    const f: PdfFormField = {
      id: uid(),
      ...newFieldDefaults(item.type, activePage),
      label: item.label,
      binding: item.binding,
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
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const tpl: PdfFormTemplate = {
        id: isNew ? `tpl_${Date.now().toString(36)}` : (id as string),
        name: name.trim(),
        docType,
        isActive: false,
        storagePath,
        fileName,
        pageCount: pageSizes.length,
        pageSizes,
        fields,
        createdAt: now,
        updatedAt: now,
      };
      await savePdfFormTemplate(tpl);
      toast.success("保存しました");
      router.push("/settings?tab=pdf_builder");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

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
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
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
        <Button size="sm" onClick={handleSave} disabled={saving || !storagePath}>
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          保存
        </Button>
      </div>

      {/* インポート未済 */}
      {!doc ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <label className="flex w-full max-w-md cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-20 text-center transition-colors hover:border-primary/50 hover:bg-muted/30">
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
        <div className="flex flex-1 overflow-hidden">
          {/* 左：項目パレット */}
          <aside className="w-52 shrink-0 overflow-y-auto border-r p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
              <Sparkles className="h-3 w-3" />自動入力項目
            </div>
            <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
              置くだけでデータが自動で入ります。
            </p>
            <div className="space-y-1.5">
              {AUTO_PALETTE.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    onClick={() => addField(item)}
                    className="flex w-full items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50/40 px-2.5 py-2 text-left text-xs transition-colors hover:bg-emerald-50"
                  >
                    <Icon className="h-3.5 w-3.5 text-emerald-600" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <PenLine className="h-3 w-3" />自由項目
            </div>
            <div className="space-y-1.5">
              {MANUAL_PALETTE.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
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
              項目をクリックして追加し、PDF上でドラッグして配置します。
            </p>
          </aside>

          {/* 中央：PDFプレビュー */}
          <div className="flex flex-1 flex-col overflow-hidden bg-muted/30">
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
                >
                  <PdfPageCanvas
                    doc={doc}
                    pageNumber={activePage + 1}
                    width={renderW}
                    onRendered={setRenderSize}
                    className="pointer-events-none absolute inset-0"
                  />
                  {/* 配置済み項目 */}
                  {pageFields.map((f) => (
                    <div
                      key={f.id}
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
                      </span>
                      {selectedId === f.id && (
                        <span
                          onPointerDown={(e) => onResizePointerDown(e, f)}
                          className="absolute -bottom-1 -right-1 h-3 w-3 cursor-se-resize rounded-sm border border-white bg-primary"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 右：項目設定 */}
          <aside className="w-72 shrink-0 overflow-y-auto border-l p-4">
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => removeField(selectedField.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">ラベル</Label>
                  <Input
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
                        updateField(selectedField.id, { binding: v as PdfFormField["binding"] })
                      }
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BINDINGS_FOR_TYPE[selectedField.type].map((b) => (
                          <SelectItem key={b} value={b}>
                            {BINDING_LABELS[b]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
