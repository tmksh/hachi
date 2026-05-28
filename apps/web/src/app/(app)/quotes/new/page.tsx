"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Plus, Trash2, ChevronDown, ChevronRight, FileDown } from "lucide-react";
import { createEstimate, getEstimate, type CreateEstimateCategoryInput } from "@/lib/actions/estimates";
import { getCustomers } from "@/lib/actions/customers";
import { SelectCustomerDialog } from "@/components/quotes/select-customer-dialog";
import { EstimatePdfPreviewDialog, type EstimatePdfPreviewData } from "@/components/estimate/estimate-pdf-preview-dialog";

type DetailItem = { id: string; name: string; quantity: number; unit: string; selling_price: number };
type CategoryGroup = { id: string; name: string; items: DetailItem[]; collapsed: boolean };

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function newDetailItem(): DetailItem {
  return { id: uid(), name: "", quantity: 1, unit: "式", selling_price: 0 };
}

function newCategory(name = "本体工事"): CategoryGroup {
  return { id: uid(), name, items: [newDetailItem()], collapsed: false };
}

function mapEstimateToCategories(estimate: Awaited<ReturnType<typeof getEstimate>>): CategoryGroup[] {
  const categories = estimate.categories ?? [];
  const items = estimate.items ?? [];

  if (categories.length > 0) {
    return categories.map((cat) => ({
      id: uid(),
      name: cat.name,
      collapsed: false,
      items: items
        .filter((item) => item.category_id === cat.id)
        .map((item) => ({
          id: uid(),
          name: item.name,
          quantity: Number(item.quantity) || 1,
          unit: item.unit ?? "式",
          selling_price: Number(item.selling_price) || 0,
        })),
    })).map((cat) => ({ ...cat, items: cat.items.length > 0 ? cat.items : [newDetailItem()] }));
  }

  if (items.length > 0) {
    return [{
      id: uid(),
      name: "本体工事",
      collapsed: false,
      items: items.map((item) => ({
        id: uid(),
        name: item.name,
        quantity: Number(item.quantity) || 1,
        unit: item.unit ?? "式",
        selling_price: Number(item.selling_price) || 0,
      })),
    }];
  }

  return [newCategory()];
}

function QuoteNewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preCustomerId = searchParams.get("customer_id") ?? "";
  const copyFromId = searchParams.get("copy_from") ?? "";
  const dealTitle = searchParams.get("title");
  const dealValue = searchParams.get("value");

  const [saving, setSaving] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [loadingSource, setLoadingSource] = useState(!!copyFromId);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [customerId, setCustomerId] = useState(preCustomerId);
  const [copyCustomerOpen, setCopyCustomerOpen] = useState(!!copyFromId && !preCustomerId);

  const [title, setTitle] = useState(dealTitle ? `${dealTitle} 見積書` : "");
  const [notes, setNotes] = useState("");
  const [categories, setCategories] = useState<CategoryGroup[]>(() => {
    if (dealTitle) {
      return [{
        id: uid(),
        name: "本体工事",
        collapsed: false,
        items: [{
          id: uid(),
          name: `${dealTitle} 一式`,
          quantity: 1,
          unit: "式",
          selling_price: dealValue ? Number(dealValue) : 0,
        }],
      }];
    }
    return [newCategory()];
  });

  useEffect(() => {
    getCustomers()
      .then((rows) => setCustomers(rows.map((c) => ({ id: c.id, name: c.name }))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!copyFromId) return;
    setLoadingSource(true);
    getEstimate(copyFromId)
      .then((estimate) => {
        setTitle(estimate.title ? `${estimate.title}（コピー）` : "見積（コピー）");
        setNotes(estimate.notes ?? "");
        setCategories(mapEstimateToCategories(estimate));
      })
      .catch(() => toast.error("コピー元の見積を読み込めませんでした"))
      .finally(() => setLoadingSource(false));
  }, [copyFromId]);

  useEffect(() => {
    if (!copyFromId && !preCustomerId) {
      router.replace("/quotes");
    }
  }, [copyFromId, preCustomerId, router]);

  useEffect(() => {
    if (copyFromId && !preCustomerId) setCopyCustomerOpen(true);
  }, [copyFromId, preCustomerId]);

  const customerName = customers.find((c) => c.id === customerId)?.name ?? "—";

  const subtotal = categories.reduce(
    (sum, cat) => sum + cat.items.reduce((s, item) => s + item.quantity * item.selling_price, 0),
    0,
  );
  const tax = Math.floor(subtotal * 0.1);
  const total = subtotal + tax;

  const pdfPreviewData: EstimatePdfPreviewData = {
    estimate_no: "下書き",
    title: title.trim() || null,
    customer_name: customerName !== "—" ? customerName : null,
    notes: notes || null,
    subtotal,
    tax,
    total,
    categories: categories.map((cat) => ({ id: cat.id, name: cat.name.trim() || "明細" })),
    items: categories.flatMap((cat) =>
      cat.items.map((item) => ({
        id: item.id,
        category_id: cat.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        selling_price: item.selling_price,
        selling_amount: item.quantity * item.selling_price,
      })),
    ),
  };

  const updateCategoryName = (catId: string, name: string) => {
    setCategories((prev) => prev.map((cat) => (cat.id === catId ? { ...cat, name } : cat)));
  };

  const toggleCategory = (catId: string) => {
    setCategories((prev) => prev.map((cat) => (cat.id === catId ? { ...cat, collapsed: !cat.collapsed } : cat)));
  };

  const addCategory = () => setCategories((prev) => [...prev, newCategory("新規大項目")]);

  const removeCategory = (catId: string) => {
    setCategories((prev) => (prev.length <= 1 ? prev : prev.filter((cat) => cat.id !== catId)));
  };

  const addItem = (catId: string) => {
    setCategories((prev) =>
      prev.map((cat) => (cat.id === catId ? { ...cat, items: [...cat.items, newDetailItem()] } : cat)),
    );
  };

  const removeItem = (catId: string, itemId: string) => {
    setCategories((prev) =>
      prev.map((cat) => {
        if (cat.id !== catId) return cat;
        if (cat.items.length <= 1) return cat;
        return { ...cat, items: cat.items.filter((item) => item.id !== itemId) };
      }),
    );
  };

  const updateItem = (catId: string, itemId: string, patch: Partial<DetailItem>) => {
    setCategories((prev) =>
      prev.map((cat) =>
        cat.id === catId
          ? { ...cat, items: cat.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)) }
          : cat,
      ),
    );
  };

  const handleSave = async () => {
    if (!customerId) {
      toast.error("顧客を選択してください");
      return;
    }
    if (!title.trim()) {
      toast.error("件名を入力してください");
      return;
    }

    const payload: CreateEstimateCategoryInput[] = categories.map((cat) => ({
      name: cat.name.trim() || "明細",
      items: cat.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        selling_price: item.selling_price,
      })),
    }));

    setSaving(true);
    try {
      const created = await createEstimate(
        { title: title.trim(), customer_id: customerId, notes: notes || undefined },
        payload,
      );
      toast.success(copyFromId ? "見積をコピーして作成しました" : "見積を作成しました");
      router.push(`/quotes/${created.id}`);
    } catch {
      toast.error("作成に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (copyFromId && !customerId) {
    return (
      <>
        <div className="p-4 md:p-6 space-y-4 max-w-lg">
          <div className="flex items-center gap-3">
            <Link href={`/quotes/${copyFromId}`}>
              <Button variant="ghost" size="icon" className="size-8">
                <ArrowLeft className="size-4" />
              </Button>
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">見積書をコピー</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            コピー先の顧客を選んでください。選択後、見積内容を編集して保存できます。
          </p>
          {loadingSource ? (
            <p className="text-sm text-muted-foreground">見積内容を読み込み中...</p>
          ) : (
            <Button onClick={() => setCopyCustomerOpen(true)}>顧客を選択</Button>
          )}
        </div>
        <SelectCustomerDialog
          open={copyCustomerOpen}
          onOpenChange={setCopyCustomerOpen}
          title="見積書をコピー"
          description="コピー先の顧客を選んでください"
          onSelect={setCustomerId}
        />
      </>
    );
  }

  if (!customerId && !copyFromId) {
    return <div className="p-4 md:p-6 text-sm text-muted-foreground">読み込み中...</div>;
  }

  const backHref = copyFromId ? `/quotes/${copyFromId}` : `/quotes?customer=${customerId}`;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Link href={backHref}>
            <Button variant="ghost" size="icon" className="size-8 shrink-0">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {copyFromId ? "見積書をコピー" : "新規見積作成"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5 truncate">顧客: {customerName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" onClick={() => setPdfOpen(true)} disabled={loadingSource}>
            <FileDown className="size-4 mr-1" />
            PDFプレビュー
          </Button>
          <Link href={backHref}>
            <Button variant="outline">キャンセル</Button>
          </Link>
          <Button onClick={() => void handleSave()} disabled={saving || loadingSource}>
            <Save className="size-4 mr-1" />
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>

      <EstimatePdfPreviewDialog open={pdfOpen} onOpenChange={setPdfOpen} data={pdfPreviewData} />

      <Card variant="inset" className="overflow-hidden">
        <CardContent className="p-0">
          <div className="px-5 py-4 border-b border-border/60 bg-muted/20">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">基本情報</p>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-4">
              <div className="space-y-2">
                <Label>件名 *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例: キッチンリフォーム見積" />
              </div>
              <div className="space-y-2">
                <Label>顧客</Label>
                <div className="h-9 px-3 flex items-center rounded-md border bg-muted/30 text-sm">
                  {customerName}
                </div>
              </div>
            </div>
            <div className="space-y-2 mt-4">
              <Label>備考</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="特記事項があれば入力" />
            </div>
          </div>

          <div className="px-5 py-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">明細</p>
              <Button size="sm" variant="outline" onClick={addCategory}>
                <Plus className="h-4 w-4 mr-1" />大項目を追加
              </Button>
            </div>

            <div className="space-y-3">
              {categories.map((cat) => {
                return (
                  <div key={cat.id} className="rounded-lg border border-border/70 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-100/80 border-b border-border/50">
                      <button
                        type="button"
                        onClick={() => toggleCategory(cat.id)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {cat.collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                      <Input
                        value={cat.name}
                        onChange={(e) => updateCategoryName(cat.id, e.target.value)}
                        className="h-8 max-w-xs bg-white font-medium"
                        placeholder="大項目名"
                      />
                      <div className="ml-auto flex items-center gap-1">
                        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => addItem(cat.id)}>
                          <Plus className="h-3.5 w-3.5 mr-1" />詳細追加
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removeCategory(cat.id)}
                          disabled={categories.length <= 1}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {!cat.collapsed && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/30 text-xs text-muted-foreground">
                            <tr>
                              <th className="text-left px-3 py-2 font-medium">詳細項目</th>
                              <th className="text-right px-3 py-2 font-medium w-24">数量</th>
                              <th className="text-center px-3 py-2 font-medium w-20">単位</th>
                              <th className="text-right px-3 py-2 font-medium w-32">単価</th>
                              <th className="text-right px-3 py-2 font-medium w-32">金額</th>
                              <th className="w-10" />
                            </tr>
                          </thead>
                          <tbody>
                            {cat.items.map((item) => (
                              <tr key={item.id} className="border-t border-border/40">
                                <td className="px-3 py-2">
                                  <Input
                                    value={item.name}
                                    onChange={(e) => updateItem(cat.id, item.id, { name: e.target.value })}
                                    placeholder="詳細項目名"
                                    className="h-8"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <Input
                                    type="number"
                                    min={0}
                                    value={item.quantity}
                                    onChange={(e) => updateItem(cat.id, item.id, { quantity: Number(e.target.value) || 0 })}
                                    className="h-8 text-right"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <Input
                                    value={item.unit}
                                    onChange={(e) => updateItem(cat.id, item.id, { unit: e.target.value })}
                                    className="h-8 text-center"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <Input
                                    type="number"
                                    min={0}
                                    value={item.selling_price}
                                    onChange={(e) => updateItem(cat.id, item.id, { selling_price: Number(e.target.value) || 0 })}
                                    className="h-8 text-right tabular-nums"
                                  />
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums font-medium">
                                  ¥{(item.quantity * item.selling_price).toLocaleString()}
                                </td>
                                <td className="px-2 py-2">
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => removeItem(cat.id, item.id)}
                                    disabled={cat.items.length <= 1}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-5 pt-4 border-t border-border/60 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <p className="text-xs text-muted-foreground">大項目ごとに詳細項目を入力してください</p>
              <div className="text-right space-y-1">
                <p className="text-sm text-muted-foreground">
                  小計: <span className="font-semibold text-foreground tabular-nums">¥{subtotal.toLocaleString()}</span>
                </p>
                <p className="text-lg font-bold tabular-nums">
                  合計（税込）: ¥{total.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function QuoteNewPage() {
  return (
    <Suspense fallback={<div className="p-4 md:p-8 text-sm text-muted-foreground">読み込み中...</div>}>
      <QuoteNewPageContent />
    </Suspense>
  );
}
