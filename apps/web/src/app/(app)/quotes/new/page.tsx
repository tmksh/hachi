"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react";
import { createEstimate } from "@/lib/actions/estimates";
import { getCustomers } from "@/lib/actions/customers";

type LineItem = { name: string; quantity: number; unit: string; selling_price: number };

function QuoteNewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<{id:string;name:string}[]>([]);
  const [customerId, setCustomerId] = useState(searchParams.get("customer_id") ?? "");
  const [title, setTitle] = useState(searchParams.get("title") ? `${searchParams.get("title")} 見積書` : "");
  const [notes, setNotes] = useState("");
  const initValue = searchParams.get("value");
  const [items, setItems] = useState<LineItem[]>([{
    name: searchParams.get("title") ? `${searchParams.get("title")} 一式` : "",
    quantity: 1,
    unit: "式",
    selling_price: initValue ? Number(initValue) : 0,
  }]);

  useEffect(() => { getCustomers().then(c => setCustomers(c.map(x => ({id:x.id,name:x.name})))).catch(() => {}); }, []);

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
      await createEstimate({ title: title.trim(), customer_id: customerId || undefined, notes: notes || undefined }, estimateItems);
      toast.success("見積を作成しました"); router.push("/quotes");
    } catch { toast.error("作成に失敗"); } finally { setSaving(false); }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3"><Link href="/quotes"><Button variant="ghost" size="icon" className="size-8"><ArrowLeft className="size-4" /></Button></Link><h1 className="text-xl font-semibold">新規見積作成</h1></div>
      <Card><CardHeader className="pb-3"><CardTitle className="text-base">基本情報</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>件名 *</Label><Input value={title} onChange={e=>setTitle(e.target.value)} placeholder="○○邸リノベーション工事" /></div>
            <div className="space-y-2"><Label>顧客</Label><Select value={customerId} onValueChange={setCustomerId}><SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger><SelectContent>{customers.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="space-y-2"><Label>備考</Label><Textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} /></div>
        </CardContent>
      </Card>
      <Card><CardHeader className="pb-3 flex-row items-center justify-between"><CardTitle className="text-base">明細</CardTitle><Button size="sm" variant="outline" onClick={addItem}><Plus className="h-4 w-4 mr-1" />行追加</Button></CardHeader>
        <CardContent><div className="overflow-x-auto">
          <Table><TableHeader><TableRow><TableHead>品名</TableHead><TableHead className="w-20">数量</TableHead><TableHead className="w-20">単位</TableHead><TableHead className="w-28">単価</TableHead><TableHead className="w-28 text-right">金額</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
            <TableBody>
              {items.map((item, i) => (
                <TableRow key={i}>
                  <TableCell><Input value={item.name} onChange={e=>updateItem(i,"name",e.target.value)} placeholder="品名" /></TableCell>
                  <TableCell><Input type="number" value={item.quantity} onChange={e=>updateItem(i,"quantity",Number(e.target.value))} /></TableCell>
                  <TableCell><Input value={item.unit} onChange={e=>updateItem(i,"unit",e.target.value)} /></TableCell>
                  <TableCell><Input type="number" value={item.selling_price} onChange={e=>updateItem(i,"selling_price",Number(e.target.value))} /></TableCell>
                  <TableCell className="text-right tabular-nums font-medium">¥{(item.quantity * item.selling_price).toLocaleString()}</TableCell>
                  <TableCell><Button size="icon" variant="ghost" onClick={()=>removeItem(i)} disabled={items.length<=1}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4 text-right space-y-1">
          <p className="text-sm">小計: <span className="font-semibold tabular-nums">¥{subtotal.toLocaleString()}</span></p>
          <p className="text-sm">消費税(10%): <span className="font-semibold tabular-nums">¥{tax.toLocaleString()}</span></p>
          <p className="text-lg font-bold">合計: <span className="tabular-nums">¥{(subtotal + tax).toLocaleString()}</span></p>
        </div>
        </CardContent>
      </Card>
      <div className="flex justify-end gap-3 pb-6"><Link href="/quotes"><Button variant="outline">キャンセル</Button></Link><Button onClick={handleSave} disabled={saving}><Save className="size-4 mr-1" />{saving?"保存中...":"保存"}</Button></div>
    </div>
  );
}

export default function QuoteNewPage() {
  return (
    <Suspense fallback={<div className="p-4 md:p-6 text-sm text-muted-foreground">読み込み中...</div>}>
      <QuoteNewPageContent />
    </Suspense>
  );
}
