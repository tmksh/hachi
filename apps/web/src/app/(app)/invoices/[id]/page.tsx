"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Save, Plus, Trash2, Pencil, X, Printer } from "lucide-react";
import { toast } from "sonner";
import { getInvoice, updateInvoice, deleteInvoice, updateInvoiceStatus } from "@/lib/actions/invoices";

type Detail = Awaited<ReturnType<typeof getInvoice>>;
type LineItem = { description: string; quantity: number; unit_price: number };

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:     { label: "下書き",     color: "bg-slate-100 text-slate-700" },
  sent:      { label: "送付済み",   color: "bg-blue-100 text-blue-700" },
  paid:      { label: "入金済み",   color: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "キャンセル", color: "bg-rose-100 text-rose-700" },
};

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // editable fields
  const [recipient, setRecipient] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    getInvoice(id as string)
      .then((d) => {
        setData(d as Detail);
        setRecipient(d.recipient ?? "");
        setInvoiceDate(d.invoice_date ?? "");
        setDueDate(d.due_date ?? "");
        setPaymentTerms(d.payment_terms ?? "");
        setNotes(d.notes ?? "");
        setItems((d.items ?? []).map((it: { description: string; quantity: number | string; unit_price: number | string }) => ({
          description: it.description,
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
        })));
      })
      .catch(() => toast.error("読み込みに失敗"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  const addItem = () => setItems(prev => [...prev, { description: "", quantity: 1, unit_price: 0 }]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, j) => j !== i));
  const updateItem = (i: number, f: keyof LineItem, v: string | number) =>
    setItems(prev => prev.map((it, j) => j === i ? { ...it, [f]: v } : it));

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const tax = Math.floor(subtotal * 0.1);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateInvoice(id as string, {
        recipient: recipient || null,
        invoice_date: invoiceDate || null,
        due_date: dueDate || null,
        payment_terms: paymentTerms || null,
        notes: notes || null,
      }, items.filter(i => i.description.trim()).map(i => ({
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
        amount: i.quantity * i.unit_price,
      })));
      toast.success("更新しました");
      setEditing(false);
      load();
    } catch { toast.error("更新に失敗"); } finally { setSaving(false); }
  };

  const handleStatusChange = async (status: "draft" | "sent" | "paid" | "cancelled") => {
    try { await updateInvoiceStatus(id as string, status); toast.success("ステータスを更新"); load(); }
    catch { toast.error("更新に失敗"); }
  };

  const handleDelete = async () => {
    try {
      await deleteInvoice(id as string);
      toast.success("削除しました");
      router.push("/invoices");
    } catch { toast.error("削除に失敗"); }
  };

  const handlePrint = () => window.print();

  if (loading) return (
    <div className="p-4 md:p-8 space-y-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-48" />
      <Skeleton className="h-64" />
    </div>
  );
  if (!data) return (
    <div className="p-4 md:p-8">
      <Link href="/invoices" className="text-sm text-muted-foreground flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" />戻る
      </Link>
      <p className="mt-4">請求書が見つかりません</p>
    </div>
  );

  return (
    <div className="p-4 md:p-8 space-y-6 print:p-0 print:space-y-3">
      <Link href="/invoices" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground print:hidden">
        <ArrowLeft className="h-4 w-4" />請求書一覧
      </Link>

      {/* ヘッダー */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight tabular-nums">{data.invoice_no ?? "INV-???"}</h1>
            <Badge className={STATUS_CONFIG[data.status]?.color ?? ""}>
              {STATUS_CONFIG[data.status]?.label ?? data.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {data.customer?.name ?? "-"}
            {data.construction?.title && ` / ${data.construction.title}`}
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          {!editing && (
            <Select value={data.status} onValueChange={(v) => handleStatusChange(v as "draft" | "sent" | "paid" | "cancelled")}>
              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
            <Printer className="h-4 w-4" />印刷
          </Button>
          {editing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => { setEditing(false); load(); }}>
                <X className="h-4 w-4 mr-1" />キャンセル
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-1" />{saving ? "保存中..." : "保存"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
                <Pencil className="h-4 w-4" />編集
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)} className="text-destructive gap-1.5">
                <Trash2 className="h-4 w-4" />削除
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 金額サマリー */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "小計",     val: data.subtotal },
          { label: "消費税10%", val: data.tax },
          { label: "合計",     val: data.total, big: true },
        ].map(({ label, val, big }) => (
          <Card key={label} variant="inset">
            <CardContent className="px-4 py-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`tabular-nums ${big ? "text-2xl font-bold text-primary" : "text-lg font-semibold"}`}>
                ¥{val.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 基本情報 */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">基本情報</CardTitle></CardHeader>
        <CardContent>
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>宛名</Label><Input value={recipient} onChange={e => setRecipient(e.target.value)} /></div>
              <div className="space-y-2"><Label>支払条件</Label><Input value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} placeholder="例: 月末締め翌月末払い" /></div>
              <div className="space-y-2"><Label>請求日</Label><Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} /></div>
              <div className="space-y-2"><Label>支払期限</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>備考</Label><Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} /></div>
            </div>
          ) : (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">宛名</dt><dd>{data.recipient ?? "-"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">支払条件</dt><dd>{data.payment_terms ?? "-"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">請求日</dt><dd className="tabular-nums">{data.invoice_date ? format(parseISO(data.invoice_date), "yyyy/MM/dd", { locale: ja }) : "-"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">支払期限</dt><dd className="tabular-nums">{data.due_date ? format(parseISO(data.due_date), "yyyy/MM/dd", { locale: ja }) : "-"}</dd></div>
              {data.notes && <div className="sm:col-span-2 pt-2 border-t"><p className="text-xs text-muted-foreground whitespace-pre-wrap">{data.notes}</p></div>}
            </dl>
          )}
        </CardContent>
      </Card>

      {/* 明細 */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <CardTitle className="text-sm">明細</CardTitle>
          {editing && (
            <Button size="sm" variant="outline" onClick={addItem} className="h-7 text-xs gap-1">
              <Plus className="h-3 w-3" />行追加
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>内容</TableHead>
              <TableHead className="w-20 text-right">数量</TableHead>
              <TableHead className="w-32 text-right">単価</TableHead>
              <TableHead className="w-32 text-right">金額</TableHead>
              {editing && <TableHead className="w-10" />}
            </TableRow></TableHeader>
            <TableBody>
              {(editing ? items : data.items ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={editing ? 5 : 4} className="text-center py-8 text-muted-foreground text-sm">明細なし</TableCell></TableRow>
              ) : editing ? items.map((it, i) => (
                <TableRow key={i}>
                  <TableCell><Input value={it.description} onChange={e => updateItem(i, "description", e.target.value)} /></TableCell>
                  <TableCell><Input type="number" value={it.quantity} onChange={e => updateItem(i, "quantity", Number(e.target.value))} className="text-right" /></TableCell>
                  <TableCell><Input type="number" value={it.unit_price} onChange={e => updateItem(i, "unit_price", Number(e.target.value))} className="text-right" /></TableCell>
                  <TableCell className="text-right tabular-nums">¥{(it.quantity * it.unit_price).toLocaleString()}</TableCell>
                  <TableCell><Button size="icon" variant="ghost" onClick={() => removeItem(i)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              )) : (data.items ?? []).map((it: { id: string; description: string; quantity: number | string; unit_price: number | string; amount: number | string }) => (
                <TableRow key={it.id}>
                  <TableCell>{it.description}</TableCell>
                  <TableCell className="text-right tabular-nums">{it.quantity}</TableCell>
                  <TableCell className="text-right tabular-nums">¥{Number(it.unit_price).toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">¥{Number(it.amount).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {editing && (
            <div className="mt-4 text-right space-y-0.5 text-sm">
              <p>小計: <span className="tabular-nums">¥{subtotal.toLocaleString()}</span></p>
              <p>消費税: <span className="tabular-nums">¥{tax.toLocaleString()}</span></p>
              <p className="text-base font-bold">合計: <span className="tabular-nums">¥{(subtotal + tax).toLocaleString()}</span></p>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>請求書を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>この操作は取り消せません。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">削除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
