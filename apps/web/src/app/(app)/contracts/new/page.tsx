"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import { createContract } from "@/lib/actions/contracts";
import { getCustomers } from "@/lib/actions/customers";
import { getEstimates } from "@/lib/actions/estimates";
import { getProfiles } from "@/lib/actions/profiles";

export default function ContractNewPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loadingOpts, setLoadingOpts] = useState(true);
  const [customers, setCustomers] = useState<{id:string;name:string}[]>([]);
  const [estimates, setEstimates] = useState<{id:string;estimate_no:string;title:string|null}[]>([]);
  const [profiles, setProfiles] = useState<{id:string;display_name:string}[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [contractDate, setContractDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [estimateId, setEstimateId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    Promise.all([getCustomers(), getEstimates(), getProfiles()])
      .then(([c, e, p]) => { setCustomers(c.map(x => ({id:x.id,name:x.name}))); setEstimates(e.map(x => ({id:x.id,estimate_no:x.estimate_no,title:x.title}))); setProfiles(p.map(x => ({id:x.id,display_name:x.display_name}))); })
      .finally(() => setLoadingOpts(false));
  }, []);

  const handleSave = async () => {
    if (!title.trim()) { toast.error("件名を入力してください"); return; }
    setSaving(true);
    try {
      await createContract({ title: title.trim(), customer_id: customerId || undefined, estimate_id: estimateId || undefined, contract_date: contractDate || undefined, start_date: startDate || undefined, end_date: endDate || undefined, amount: amount ? Number(amount) : undefined, assigned_to: assignedTo || undefined, notes: notes || undefined });
      toast.success("契約を登録しました"); router.push("/contracts");
    } catch { toast.error("登録に失敗しました"); } finally { setSaving(false); }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3"><Link href="/contracts"><Button variant="ghost" size="icon" className="size-8"><ArrowLeft className="size-4" /></Button></Link><PageHeader title="新規契約登録" description="新しい契約を登録します" /></div>
      <Card><CardHeader className="pb-3"><CardTitle className="text-base">契約情報</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {loadingOpts ? <div className="space-y-4">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-10 w-full" />)}</div> : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>顧客</Label><Select value={customerId} onValueChange={setCustomerId}><SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger><SelectContent>{customers.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>担当者</Label><Select value={assignedTo} onValueChange={setAssignedTo}><SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger><SelectContent>{profiles.map(p=><SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2 sm:col-span-2"><Label>件名</Label><Input value={title} onChange={e=>setTitle(e.target.value)} placeholder="例: 山田邸リノベーション工事" /></div>
                <div className="space-y-2"><Label>契約金額</Label><Input type="number" value={amount} onChange={e=>setAmount(e.target.value)} /></div>
                <div className="space-y-2"><Label>契約日</Label><Input type="date" value={contractDate} onChange={e=>setContractDate(e.target.value)} /></div>
                <div className="space-y-2"><Label>開始日</Label><Input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} /></div>
                <div className="space-y-2"><Label>終了日</Label><Input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} /></div>
                <div className="space-y-2"><Label>関連見積</Label><Select value={estimateId} onValueChange={setEstimateId}><SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger><SelectContent>{estimates.map(e=><SelectItem key={e.id} value={e.id}>{e.estimate_no} - {e.title ?? "無題"}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <div className="space-y-2"><Label>備考</Label><Textarea rows={4} value={notes} onChange={e=>setNotes(e.target.value)} /></div>
            </>
          )}
        </CardContent>
      </Card>
      <div className="flex justify-end gap-3 pb-6"><Link href="/contracts"><Button variant="outline">キャンセル</Button></Link><Button onClick={handleSave} disabled={saving||loadingOpts}><Save className="size-4 mr-1" />{saving?"保存中...":"保存"}</Button></div>
    </div>
  );
}
