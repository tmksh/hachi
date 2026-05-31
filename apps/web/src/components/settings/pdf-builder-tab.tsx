"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, FileText, RotateCcw, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { getCompany, updateCompany } from "@/lib/actions/profiles";
import type { Company } from "@/lib/database.types";
import {
  PDF_DOC_TYPES,
  type PdfDocType,
  type PdfTemplate,
  type PdfTemplates,
  DEFAULT_PDF_TEMPLATES,
  resolvePdfTemplates,
} from "@/lib/pdf-template";

const FONT_OPTIONS = [
  { value: "sans-serif", label: "ゴシック体（標準）" },
  { value: "serif", label: "明朝体" },
  { value: "'Hiragino Sans', sans-serif", label: "ヒラギノ角ゴ" },
  { value: "'Yu Gothic', sans-serif", label: "游ゴシック" },
];

const SAMPLE = {
  customer: "サンプル商事 株式会社",
  title: "○○邸 新築工事",
  no: "Q-2026-0001",
  date: new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" }),
  categories: [
    { id: "c1", name: "仮設工事" },
    { id: "c2", name: "基礎工事" },
  ],
  items: [
    { id: "i1", category_id: "c1", name: "仮設足場", quantity: 1, unit: "式", price: 120000, amount: 120000 },
    { id: "i2", category_id: "c1", name: "養生費", quantity: 1, unit: "式", price: 35000, amount: 35000 },
    { id: "i3", category_id: "c2", name: "基礎コンクリート打設", quantity: 25, unit: "m3", price: 18000, amount: 450000 },
  ],
  subtotal: 605000,
  tax: 60500,
  total: 665500,
};

export function PdfBuilderTab() {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<PdfTemplates>(DEFAULT_PDF_TEMPLATES);
  const [active, setActive] = useState<PdfDocType>("estimate");

  useEffect(() => {
    getCompany()
      .then((c) => {
        setCompany(c);
        const raw = (c.settings as Record<string, unknown> | null)?.pdf_templates;
        setTemplates(resolvePdfTemplates(raw));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const tpl = templates[active];

  const companyInfo = useMemo(() => {
    const s = (company?.settings as Record<string, string>) ?? {};
    return {
      name: company?.name ?? "株式会社 ○○建設",
      postal: s.postal_code ?? "000-0000",
      address: s.address ?? "東京都○○区○○1-2-3",
      tel: s.phone ?? "03-0000-0000",
      invoiceNo: s.invoice_number ?? "",
    };
  }, [company]);

  const update = (patch: Partial<PdfTemplate>) => {
    setTemplates((prev) => ({ ...prev, [active]: { ...prev[active], ...patch } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateCompany({ pdf_templates: templates as unknown as Record<string, unknown> });
      toast.success("PDFテンプレートを保存しました");
    } catch (e) {
      toast.error("保存に失敗しました", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setTemplates((prev) => ({ ...prev, [active]: { ...DEFAULT_PDF_TEMPLATES[active] } }));
    toast.info(`${PDF_DOC_TYPES.find((d) => d.value === active)?.label}を初期テンプレートに戻しました（未保存）`);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            PDFテンプレート編集
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            見積書・契約書・請求書のレイアウトを帳票ごとに編集できます。右側はサンプルデータでのプレビューです。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1" onClick={handleReset}>
            <RotateCcw className="size-4 mr-1" />初期化
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="size-4 mr-1" />
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>

      <Tabs value={active} onValueChange={(v) => setActive(v as PdfDocType)}>
        <TabsList>
          {PDF_DOC_TYPES.map((d) => (
            <TabsTrigger key={d.value} value={d.value} className="px-5">
              {d.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {PDF_DOC_TYPES.map((d) => (
          <TabsContent key={d.value} value={d.value} className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,420px)_1fr] gap-4">
              {/* ── 編集パネル ── */}
              <div className="space-y-4">
                <Editor tpl={tpl} update={update} />
              </div>

              {/* ── ライブプレビュー ── */}
              <Card className="overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-muted-foreground">プレビュー（サンプル）</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-auto rounded-lg border bg-slate-200 p-4 flex justify-center">
                    <DocPreview tpl={tpl} companyInfo={companyInfo} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

/* ─────────────────────────── 編集パネル ─────────────────────────── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Editor({ tpl, update }: { tpl: PdfTemplate; update: (p: Partial<PdfTemplate>) => void }) {
  return (
    <>
      <Section title="基本">
        <div className="space-y-1.5">
          <Label className="text-xs">表題</Label>
          <Input value={tpl.title} onChange={(e) => update({ title: e.target.value })} placeholder="見　積　書" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">アクセントカラー</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={tpl.accentColor}
                onChange={(e) => update({ accentColor: e.target.value })}
                className="h-9 w-10 rounded border cursor-pointer bg-transparent"
              />
              <Input value={tpl.accentColor} onChange={(e) => update({ accentColor: e.target.value })} className="h-9" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">フォント</Label>
            <Select value={tpl.fontFamily} onValueChange={(v) => update({ fontFamily: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">本文サイズ: {tpl.fontSize}px</Label>
          <input
            type="range"
            min={9}
            max={14}
            step={1}
            value={tpl.fontSize}
            onChange={(e) => update({ fontSize: Number(e.target.value) })}
            className="w-full accent-[#0F5132]"
          />
        </div>
      </Section>

      <Section title="発行元（自社）">
        <Row label="発行元情報を表示">
          <Switch checked={tpl.showIssuer} onCheckedChange={(v) => update({ showIssuer: v })} />
        </Row>
        {tpl.showIssuer && (
          <>
            <Row label="会社情報から自動入力">
              <Switch checked={tpl.issuerUseCompany} onCheckedChange={(v) => update({ issuerUseCompany: v })} />
            </Row>
            {!tpl.issuerUseCompany && (
              <div className="space-y-2 rounded-lg border border-dashed p-3">
                <Input value={tpl.issuerName} onChange={(e) => update({ issuerName: e.target.value })} placeholder="会社名" className="h-8 text-xs" />
                <div className="grid grid-cols-2 gap-2">
                  <Input value={tpl.issuerPostal} onChange={(e) => update({ issuerPostal: e.target.value })} placeholder="〒000-0000" className="h-8 text-xs" />
                  <Input value={tpl.issuerTel} onChange={(e) => update({ issuerTel: e.target.value })} placeholder="TEL" className="h-8 text-xs" />
                </div>
                <Input value={tpl.issuerAddress} onChange={(e) => update({ issuerAddress: e.target.value })} placeholder="住所" className="h-8 text-xs" />
                <Input value={tpl.issuerInvoiceNo} onChange={(e) => update({ issuerInvoiceNo: e.target.value })} placeholder="インボイス番号 T-..." className="h-8 text-xs" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">ロゴ画像URL</Label>
              <Input value={tpl.logoUrl} onChange={(e) => update({ logoUrl: e.target.value, showLogo: e.target.value.length > 0 })} placeholder="https://..." className="h-8 text-xs" />
            </div>
          </>
        )}
      </Section>

      <Section title="押印欄">
        <Row label="押印欄を表示">
          <Switch checked={tpl.showSeal} onCheckedChange={(v) => update({ showSeal: v })} />
        </Row>
        {tpl.showSeal && (
          <div className="flex flex-wrap items-center gap-2">
            {tpl.sealColumns.map((s, idx) => (
              <span key={s.id} className="inline-flex items-center gap-1 rounded-md border bg-muted/40 pl-2 pr-1 py-1 text-xs">
                <input
                  value={s.label}
                  onChange={(e) => {
                    const next = [...tpl.sealColumns];
                    next[idx] = { ...s, label: e.target.value };
                    update({ sealColumns: next });
                  }}
                  className="w-12 bg-transparent outline-none"
                />
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => update({ sealColumns: tpl.sealColumns.filter((x) => x.id !== s.id) })}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => update({ sealColumns: [...tpl.sealColumns, { id: `s${Date.now()}`, label: "印" }] })}
            >
              <Plus className="h-3 w-3" />追加
            </Button>
          </div>
        )}
      </Section>

      <Section title="明細表">
        {([
          ["quantity", "数量"],
          ["unit", "単位"],
          ["unitPrice", "単価"],
          ["amount", "金額"],
        ] as const).map(([key, label]) => (
          <Row key={key} label={`${label}列を表示`}>
            <Switch
              checked={tpl.columns[key]}
              onCheckedChange={(v) => update({ columns: { ...tpl.columns, [key]: v } })}
            />
          </Row>
        ))}
        <div className="space-y-1.5">
          <Label className="text-xs">最低行数（空行で埋める）: {tpl.minRows}</Label>
          <input
            type="range"
            min={0}
            max={20}
            step={1}
            value={tpl.minRows}
            onChange={(e) => update({ minRows: Number(e.target.value) })}
            className="w-full accent-[#0F5132]"
          />
        </div>
      </Section>

      <Section title="期限・振込・備考">
        <Row label="期限を表示">
          <Switch checked={tpl.showValidity} onCheckedChange={(v) => update({ showValidity: v })} />
        </Row>
        {tpl.showValidity && (
          <div className="grid grid-cols-2 gap-2">
            <Input value={tpl.validityLabel} onChange={(e) => update({ validityLabel: e.target.value })} placeholder="有効期限" className="h-8 text-xs" />
            <Input value={tpl.validityText} onChange={(e) => update({ validityText: e.target.value })} placeholder="発行日より30日間" className="h-8 text-xs" />
          </div>
        )}
        <Row label="振込先を表示">
          <Switch checked={tpl.showBank} onCheckedChange={(v) => update({ showBank: v })} />
        </Row>
        {tpl.showBank && (
          <Textarea value={tpl.bankInfo} onChange={(e) => update({ bankInfo: e.target.value })} rows={2} placeholder="○○銀行 ○○支店 普通 0000000" className="text-xs" />
        )}
        <Row label="備考欄を表示">
          <Switch checked={tpl.showNotes} onCheckedChange={(v) => update({ showNotes: v })} />
        </Row>
        {tpl.showNotes && (
          <div className="space-y-2">
            <Input value={tpl.notesLabel} onChange={(e) => update({ notesLabel: e.target.value })} placeholder="備考" className="h-8 text-xs" />
            <Textarea value={tpl.notesDefault} onChange={(e) => update({ notesDefault: e.target.value })} rows={2} placeholder="初期表示する備考文" className="text-xs" />
          </div>
        )}
        <div className="space-y-1.5">
          <Label className="text-xs">フッター文言</Label>
          <Input value={tpl.footerText} onChange={(e) => update({ footerText: e.target.value })} placeholder="ご不明な点はお問い合わせください" className="h-8 text-xs" />
        </div>
      </Section>
    </>
  );
}

/* ─────────────────────────── プレビュー ─────────────────────────── */
function DocPreview({
  tpl,
  companyInfo,
}: {
  tpl: PdfTemplate;
  companyInfo: { name: string; postal: string; address: string; tel: string; invoiceNo: string };
}) {
  const issuer = tpl.issuerUseCompany
    ? companyInfo
    : {
        name: tpl.issuerName || "—",
        postal: tpl.issuerPostal,
        address: tpl.issuerAddress,
        tel: tpl.issuerTel,
        invoiceNo: tpl.issuerInvoiceNo,
      };

  const colCount =
    1 + Number(tpl.columns.quantity) + Number(tpl.columns.unit) + Number(tpl.columns.unitPrice) + Number(tpl.columns.amount);

  const cell = { border: `1px solid ${tpl.accentColor}33`, padding: "4px 8px" } as const;

  return (
    <div
      className="bg-white shadow-lg text-slate-900"
      style={{
        width: "595px",
        minHeight: "842px",
        padding: "44px 48px",
        fontSize: `${tpl.fontSize}px`,
        lineHeight: 1.5,
        fontFamily: tpl.fontFamily,
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        {/* タイトル */}
        <div style={{ textAlign: "center", paddingBottom: "6px", borderBottom: `2px solid ${tpl.accentColor}` }}>
          <h1 style={{ fontSize: "20px", fontWeight: "bold", letterSpacing: "0.2em", color: tpl.accentColor }}>
            {tpl.title || "　"}
          </h1>
        </div>

        {/* 宛名 / 発行元 */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: `${tpl.fontSize + 2}px`, fontWeight: "bold", borderBottom: `1px solid ${tpl.accentColor}`, paddingBottom: "4px", marginBottom: "6px" }}>
              {SAMPLE.customer} 御中
            </p>
            <p style={{ color: "#475569" }}>件名: {SAMPLE.title}</p>
            <div
              style={{
                marginTop: "12px",
                border: `1px solid ${tpl.accentColor}55`,
                padding: "6px 12px",
                background: `${tpl.accentColor}0d`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontWeight: 600 }}>金額（税込）</span>
              <span style={{ fontSize: "15px", fontWeight: "bold" }}>¥{SAMPLE.total.toLocaleString()}</span>
            </div>
          </div>

          <div style={{ textAlign: "right", color: "#475569", minWidth: "190px" }}>
            <p>発行日: {SAMPLE.date}</p>
            <p>番号: {SAMPLE.no}</p>
            {tpl.showValidity && <p>{tpl.validityLabel}: {tpl.validityText}</p>}
            {tpl.showIssuer && (
              <div style={{ marginTop: "10px" }}>
                {tpl.showLogo && tpl.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={tpl.logoUrl} alt="logo" style={{ maxHeight: "32px", marginLeft: "auto", marginBottom: "4px" }} />
                ) : null}
                <p style={{ fontWeight: "bold", color: "#0f172a" }}>{issuer.name}</p>
                {issuer.postal && <p>〒{issuer.postal}</p>}
                {issuer.address && <p>{issuer.address}</p>}
                {issuer.tel && <p>TEL: {issuer.tel}</p>}
                {issuer.invoiceNo && <p>登録番号: {issuer.invoiceNo}</p>}
                {tpl.showSeal && tpl.sealColumns.length > 0 && (
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", marginTop: "8px" }}>
                    {tpl.sealColumns.map((s) => (
                      <div
                        key={s.id}
                        style={{
                          border: "1px solid #cbd5e1",
                          width: "40px",
                          height: "40px",
                          display: "flex",
                          alignItems: "flex-end",
                          justifyContent: "center",
                          paddingBottom: "2px",
                          fontSize: "9px",
                          color: "#94a3b8",
                        }}
                      >
                        {s.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 明細表 */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: `${tpl.fontSize - 1}px` }}>
          <thead>
            <tr style={{ background: `${tpl.accentColor}1a` }}>
              <th style={{ ...cell, textAlign: "left" }}>品名</th>
              {tpl.columns.quantity && <th style={{ ...cell, textAlign: "right", width: "48px" }}>数量</th>}
              {tpl.columns.unit && <th style={{ ...cell, textAlign: "center", width: "40px" }}>単位</th>}
              {tpl.columns.unitPrice && <th style={{ ...cell, textAlign: "right", width: "90px" }}>単価</th>}
              {tpl.columns.amount && <th style={{ ...cell, textAlign: "right", width: "90px" }}>金額</th>}
            </tr>
          </thead>
          <tbody>
            {SAMPLE.categories.flatMap((cat) => [
              <tr key={`cat-${cat.id}`} style={{ background: "#f8fafc" }}>
                <td colSpan={colCount} style={{ ...cell, fontWeight: 600, color: "#334155" }}>{cat.name}</td>
              </tr>,
              ...SAMPLE.items
                .filter((i) => i.category_id === cat.id)
                .map((item) => (
                  <tr key={item.id}>
                    <td style={cell}>{item.name}</td>
                    {tpl.columns.quantity && <td style={{ ...cell, textAlign: "right" }}>{item.quantity}</td>}
                    {tpl.columns.unit && <td style={{ ...cell, textAlign: "center" }}>{item.unit}</td>}
                    {tpl.columns.unitPrice && <td style={{ ...cell, textAlign: "right" }}>¥{item.price.toLocaleString()}</td>}
                    {tpl.columns.amount && <td style={{ ...cell, textAlign: "right" }}>¥{item.amount.toLocaleString()}</td>}
                  </tr>
                )),
            ])}
            {Array.from({ length: Math.max(0, tpl.minRows - SAMPLE.items.length) }).map((_, i) => (
              <tr key={`empty-${i}`}>
                <td colSpan={colCount} style={{ ...cell, padding: "9px" }}>&nbsp;</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={colCount - 1} style={{ ...cell, textAlign: "right" }}>小計</td>
              <td style={{ ...cell, textAlign: "right" }}>¥{SAMPLE.subtotal.toLocaleString()}</td>
            </tr>
            <tr>
              <td colSpan={colCount - 1} style={{ ...cell, textAlign: "right" }}>消費税（10%）</td>
              <td style={{ ...cell, textAlign: "right" }}>¥{SAMPLE.tax.toLocaleString()}</td>
            </tr>
            <tr style={{ background: `${tpl.accentColor}1a`, fontWeight: "bold" }}>
              <td colSpan={colCount - 1} style={{ ...cell, textAlign: "right" }}>合計（税込）</td>
              <td style={{ ...cell, textAlign: "right" }}>¥{SAMPLE.total.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>

        {/* 振込先 */}
        {tpl.showBank && (
          <div style={{ border: `1px solid ${tpl.accentColor}55`, padding: "8px 10px" }}>
            <p style={{ fontWeight: 600, marginBottom: "4px", color: tpl.accentColor }}>お振込先</p>
            <p style={{ color: "#334155", whiteSpace: "pre-wrap" }}>{tpl.bankInfo || "　"}</p>
          </div>
        )}

        {/* 備考 */}
        {tpl.showNotes && (
          <div style={{ border: "1px solid #cbd5e1", padding: "8px 10px" }}>
            <p style={{ fontWeight: 600, marginBottom: "4px", color: "#475569" }}>{tpl.notesLabel}</p>
            <p style={{ color: "#334155", whiteSpace: "pre-wrap" }}>{tpl.notesDefault || "　"}</p>
          </div>
        )}

        {/* フッター */}
        {tpl.footerText && (
          <p style={{ textAlign: "center", color: "#94a3b8", fontSize: `${tpl.fontSize - 2}px`, marginTop: "auto", paddingTop: "12px" }}>
            {tpl.footerText}
          </p>
        )}
      </div>
    </div>
  );
}
