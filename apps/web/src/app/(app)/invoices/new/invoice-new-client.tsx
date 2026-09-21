"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IntegerInput } from "@/components/ui/integer-input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react";
import { createInvoice } from "@/lib/actions/invoices";

type LineItem = { description: string; quantity: number; unit_price: number };

export function InvoiceNewClient({
  initialCustomers,
  initialConstructions,
}: {
  initialCustomers: { id: string; name: string }[];
  initialConstructions: { id: string; title: string }[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState(initialCustomers);
  const [constructions, setConstructions] = useState(initialConstructions);
  const [customerId, setCustomerId] = useState("");
  const [constructionId, setConstructionId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ description: "", quantity: 1, unit_price: 0 }]);

  useEffect(() => {
    setCustomers(initialCustomers);
    setConstructions(initialConstructions);
  }, [initialCustomers, initialConstructions]);

  const addItem = () => setItems([...items, { description: "", quantity: 1, unit_price: 0 }]);
  const removeItem = (i: number) => setItems(items.filter((_,j) => j !== i));
  const updateItem = (i: number, f: keyof LineItem, v: string|number) => setItems(items.map((item, j) => j === i ? { ...item, [f]: v } : item));
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const tax = Math.floor(subtotal * 0.1);

  const handleSave = async () => {
    setSaving(true);
    try {
      await createInvoice({ customer_id: customerId || undefined, construction_id: constructionId || undefined, recipient: recipient || undefined, invoice_date: invoiceDate || undefined, due_date: dueDate || undefined }, items.filter(i => i.description.trim()).map(i => ({ description: i.description, quantity: i.quantity, unit_price: i.unit_price, amount: i.quantity * i.unit_price })));
      toast.success("請求書を作成しました");
      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      router.push("/invoices");
    } catch { toast.error("作成に失敗"); } finally { setSaving(false); }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3"><Link href="/invoices"><Button variant="ghost" size="icon" className="size-8"><ArrowLeft className="size-4" /></Button></Link><h1 className="text-2xl font-semibold tracking-tight text-foreground">請求書作成</h1></div>
      <Card><CardHeader className="pb-3"><CardTitle className="text-base">基本情報</CardTitle></CardHeader>
        <CardContent><div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2"><Label>顧客</Label><Select value={customerId} onValueChange={setCustomerId}><SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger><SelectContent>{customers.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>工事</Label><Select value={constructionId} onValueChange={setConstructionId}><SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger><SelectContent>{constructions.map(c=><SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>宛名</Label><Input value={recipient} onChange={e=>setRecipient(e.target.value)} /></div>
          <div className="space-y-2"><Label>請求日</Label><Input type="date" value={invoiceDate} onChange={e=>setInvoiceDate(e.target.value)} /></div>
          <div className="space-y-2"><Label>支払期限</Label><Input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} /></div>
        </div></CardContent>
      </Card>
      <Card><CardHeader className="pb-3 flex-row items-center justify-between"><CardTitle className="text-base">明細</CardTitle><Button size="sm" variant="outline" onClick={addItem}><Plus className="h-4 w-4 mr-1" />行追加</Button></CardHeader>
        <CardContent><Table><TableHeader><TableRow><TableHead>内容</TableHead><TableHead className="w-20">数量</TableHead><TableHead className="w-28">単価</TableHead><TableHead className="w-28 text-right">金額</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
          <TableBody>{items.map((item, i) => (
            <TableRow key={i}>
              <TableCell><Input value={item.description} onChange={e=>updateItem(i,"description",e.target.value)} /></TableCell>
              <TableCell>
                <IntegerInput
                  className="text-right tabular-nums"
                  value={item.quantity}
                  onValueChange={(v) => updateItem(i, "quantity", v)}
                />
              </TableCell>
              <TableCell>
                <IntegerInput
                  className="text-right tabular-nums"
                  value={item.unit_price}
                  onValueChange={(v) => updateItem(i, "unit_price", v)}
                />
              </TableCell>
              <TableCell className="text-right tabular-nums">¥{(item.quantity*item.unit_price).toLocaleString()}</TableCell>
              <TableCell><Button size="icon" variant="ghost" onClick={()=>removeItem(i)} disabled={items.length<=1}><Trash2 className="h-4 w-4" /></Button></TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
        <div className="mt-4 text-right space-y-1"><p className="text-sm">小計: ¥{subtotal.toLocaleString()}</p><p className="text-sm">消費税: ¥{tax.toLocaleString()}</p><p className="text-lg font-bold">合計: ¥{(subtotal+tax).toLocaleString()}</p></div>
        </CardContent>
      </Card>
      <div className="flex justify-end gap-3"><Button variant="outline" onClick={()=>router.back()}>キャンセル</Button><Button onClick={handleSave} disabled={saving}><Save className="size-4 mr-1" />{saving?"保存中...":"保存"}</Button></div>
    </div>
  );
}
