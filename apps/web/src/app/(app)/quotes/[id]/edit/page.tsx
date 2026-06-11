"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react";
import { getEstimate, updateEstimate } from "@/lib/actions/estimates";
import { getCustomers } from "@/lib/actions/customers";

type LineItem = { name: string; quantity: number; unit: string; selling_price: number };

export default function QuoteEditPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<{id:string;name:string}[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("draft");
  const [items, setItems] = useState<LineItem[]>([]);

  useEffect(() => {
    if (!id) return;
    Promise.all([getEstimate(id as string), getCustomers({ limit: 100 })])
      .then(([est, customerResult]) => {
        const c = customerResult.customers;
        setCustomers(c.map(x => ({id:x.id,name:x.name})));
        setCustomerId(est.customer_id ?? ""); setTitle(est.title ?? ""); setNotes(est.notes ?? ""); setStatus(est.status ?? "draft");
        setItems(est.items.length > 0 ? est.items.map(i => ({ name: i.name, quantity: i.quantity, unit: i.unit ?? "式", selling_price: i.selling_price })) : [
          { name: "仮設工事", quantity: 1, unit: "式", selling_price: 300000 },
          { name: "基礎工事", quantity: 1, unit: "式", selling_price: 800000 },
          { name: "木工事", quantity: 1, unit: "式", selling_price: 1500000 },
          { name: "屋根・板金工事", quantity: 1, unit: "式", selling_price: 400000 },
          { name: "外壁工事", quantity: 1, unit: "式", selling_price: 600000 },
          { name: "内装工事", quantity: 1, unit: "式", selling_price: 700000 },
          { name: "電気設備工事", quantity: 1, unit: "式", selling_price: 350000 },
          { name: "給排水衛生工事", quantity: 1, unit: "式", selling_price: 450000 },
          { name: "諸経費", quantity: 1, unit: "式", selling_price: 200000 },
        ]);
      }).catch(() => toast.error("取得に失敗")).finally(() => setLoading(false));
  }, [id]);

  const addItem = () => setItems([...items, { name: "", quantity: 1, unit: "式", selling_price: 0 }]);
  const removeItem = (i: number) => setItems(items.filter((_, j) => j !== i));
  const updateItem = (i: number, field: keyof LineItem, value: string | number) => setItems(items.map((item, j) => j === i ? { ...item, [field]: value } : item));
  const subtotal = items.reduce((s, item) => s + item.quantity * item.selling_price, 0);
  const tax = Math.floor(subtotal * 0.1);

  const handleSave = async () => {
    if (!title.trim()) { toast.error("件名を入力してください"); return; }
    setSaving(true);
    try {
      const estimateItems = items.filter(i => i.name.trim()).map(item => ({
        name: item.name, description: null, specification: null, quantity: item.quantity, unit: item.unit,
        cost_price: 0, cost_amount: 0, selling_price: item.selling_price, selling_amount: item.quantity * item.selling_price,
        gross_profit: item.quantity * item.selling_price, gross_profit_rate: 100, sort_order: 0, notes: null, category_id: null,
      }));
      await updateEstimate(id as string, { title: title.trim(), customer_id: customerId || undefined, notes: notes || undefined, status: status as "draft" | "sent" | "accepted" | "rejected" }, estimateItems);
      toast.success("更新しました"); router.push(`/quotes/${id}`);
    } catch { toast.error("更新に失敗"); } finally { setSaving(false); }
  };

  if (loading) return <div className="p-4 md:p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96" /></div>;

  return (
    <div className="p-4 md:p-8 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Link href={`/quotes/${id}`}><Button variant="ghost" size="icon" className="size-8"><ArrowLeft className="size-4" /></Button></Link><h1 className="text-xl font-semibold tracking-tight">見積編集</h1></div>
        <div className="flex gap-2"><Link href={`/quotes/${id}`}><Button variant="outline" size="sm">キャンセル</Button></Link><Button size="sm" onClick={handleSave} disabled={saving}><Save className="size-4 mr-1" />{saving?"保存中...":"保存"}</Button></div>
      </div>

      <Card><CardContent className="pt-4 pb-4">
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,480px)_auto_auto] gap-3 items-end">
          <div className="space-y-1"><Label className="text-xs">件名 *</Label><Input value={title} onChange={e=>setTitle(e.target.value)} className="h-9" /></div>
          <div className="space-y-1"><Label className="text-xs">顧客</Label><Select value={customerId} onValueChange={setCustomerId}><SelectTrigger className="h-9 w-48"><SelectValue placeholder="選択" /></SelectTrigger><SelectContent>{customers.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label className="text-xs">ステータス</Label><Select value={status} onValueChange={setStatus}><SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">下書き</SelectItem><SelectItem value="sent">送付済み</SelectItem><SelectItem value="accepted">受理</SelectItem><SelectItem value="rejected">却下</SelectItem></SelectContent></Select></div>
        </div>
        <div className="mt-3 space-y-1"><Label className="text-xs">備考</Label><Textarea rows={2} value={notes} onChange={e=>setNotes(e.target.value)} className="text-sm" /></div>
      </CardContent></Card>

      <Card><CardHeader className="py-3 px-5 flex-row items-center justify-between border-b border-border/40"><CardTitle className="text-sm font-semibold">明細</CardTitle><Button size="sm" variant="outline" className="h-7 text-xs" onClick={addItem}><Plus className="h-3.5 w-3.5 mr-1" />行追加</Button></CardHeader>
        <CardContent className="p-0"><div className="overflow-x-auto">
          <Table><TableHeader><TableRow className="text-xs"><TableHead className="pl-5">品名</TableHead><TableHead className="w-20">数量</TableHead><TableHead className="w-20">単位</TableHead><TableHead className="w-28">単価</TableHead><TableHead className="w-28 text-right">金額</TableHead><TableHead className="w-10 pr-3"></TableHead></TableRow></TableHeader>
            <TableBody>{items.map((item, i) => (
              <TableRow key={i} className="[&>td]:py-1.5">
                <TableCell className="pl-5"><Input value={item.name} onChange={e=>updateItem(i,"name",e.target.value)} className="h-8 text-sm" /></TableCell>
                <TableCell><Input type="number" value={item.quantity} onChange={e=>updateItem(i,"quantity",Number(e.target.value))} className="h-8 text-sm" /></TableCell>
                <TableCell><Input value={item.unit} onChange={e=>updateItem(i,"unit",e.target.value)} className="h-8 text-sm" /></TableCell>
                <TableCell><Input type="number" value={item.selling_price} onChange={e=>updateItem(i,"selling_price",Number(e.target.value))} className="h-8 text-sm" /></TableCell>
                <TableCell className="text-right tabular-nums text-sm font-medium">¥{(item.quantity * item.selling_price).toLocaleString()}</TableCell>
                <TableCell className="pr-3"><Button size="icon" variant="ghost" className="h-7 w-7" onClick={()=>removeItem(i)} disabled={items.length<=1}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </div>
        <div className="flex justify-end gap-6 px-5 py-3 border-t border-border/40 text-sm">
          <span className="text-muted-foreground">小計 <span className="font-medium text-foreground tabular-nums">¥{subtotal.toLocaleString()}</span></span>
          <span className="text-muted-foreground">消費税 <span className="font-medium text-foreground tabular-nums">¥{tax.toLocaleString()}</span></span>
          <span className="font-semibold tabular-nums">合計 ¥{(subtotal+tax).toLocaleString()}</span>
        </div>
        </CardContent>
      </Card>
    </div>
  );
}
