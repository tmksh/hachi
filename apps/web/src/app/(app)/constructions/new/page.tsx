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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import { createConstruction } from "@/lib/actions/constructions";
import { getCustomers } from "@/lib/actions/customers";
import { getContracts } from "@/lib/actions/contracts";
import { getProfiles } from "@/lib/actions/profiles";

function ConstructionNewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<{id:string;name:string}[]>([]);
  const [contracts, setContracts] = useState<{id:string;contract_no:string;title:string}[]>([]);
  const [profiles, setProfiles] = useState<{id:string;display_name:string}[]>([]);
  const [title, setTitle] = useState(searchParams.get("title") ?? "");
  const [customerId, setCustomerId] = useState(searchParams.get("customer_id") ?? "");
  const [contractId, setContractId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [orderAmount, setOrderAmount] = useState(searchParams.get("order_amount") ?? "");
  const [budgetCost, setBudgetCost] = useState("");

  useEffect(() => {
    Promise.all([getCustomers(), getContracts(), getProfiles()])
      .then(([c, co, p]) => { setCustomers(c.map(x=>({id:x.id,name:x.name}))); setContracts(co.map(x=>({id:x.id,contract_no:x.contract_no,title:x.title}))); setProfiles(p.map(x=>({id:x.id,display_name:x.display_name}))); })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!title.trim()) { toast.error("工事名を入力してください"); return; }
    setSaving(true);
    try {
      await createConstruction({ title: title.trim(), customer_id: customerId || undefined, contract_id: contractId || undefined, assigned_to: assignedTo || undefined, start_date: startDate || undefined, end_date: endDate || undefined, order_amount: orderAmount ? Number(orderAmount) : undefined, budget_cost: budgetCost ? Number(budgetCost) : undefined });
      toast.success("登録しました"); router.push("/constructions");
    } catch { toast.error("登録に失敗"); } finally { setSaving(false); }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3"><Link href="/constructions"><Button variant="ghost" size="icon" className="size-8"><ArrowLeft className="size-4" /></Button></Link><h1 className="text-xl font-semibold">新規工事登録</h1></div>
      <Card><CardHeader className="pb-3"><CardTitle className="text-base">工事情報</CardTitle></CardHeader>
        <CardContent className="space-y-4"><div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2"><Label>工事名 *</Label><Input value={title} onChange={e=>setTitle(e.target.value)} /></div>
          <div className="space-y-2"><Label>顧客</Label><Select value={customerId} onValueChange={setCustomerId}><SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger><SelectContent>{customers.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>契約</Label><Select value={contractId} onValueChange={setContractId}><SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger><SelectContent>{contracts.map(c=><SelectItem key={c.id} value={c.id}>{c.contract_no}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>担当者</Label><Select value={assignedTo} onValueChange={setAssignedTo}><SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger><SelectContent>{profiles.map(p=><SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>受注額</Label><Input type="number" value={orderAmount} onChange={e=>setOrderAmount(e.target.value)} /></div>
          <div className="space-y-2"><Label>着工日</Label><Input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} /></div>
          <div className="space-y-2"><Label>竣工日</Label><Input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} /></div>
          <div className="space-y-2"><Label>予算原価</Label><Input type="number" value={budgetCost} onChange={e=>setBudgetCost(e.target.value)} /></div>
        </div></CardContent>
      </Card>
      <div className="flex justify-end gap-3"><Link href="/constructions"><Button variant="outline">キャンセル</Button></Link><Button onClick={handleSave} disabled={saving}><Save className="size-4 mr-1" />{saving?"保存中...":"保存"}</Button></div>
    </div>
  );
}

export default function ConstructionNewPage() {
  return (
    <Suspense fallback={<div className="p-4 md:p-6 text-sm text-muted-foreground">読み込み中...</div>}>
      <ConstructionNewPageContent />
    </Suspense>
  );
}
