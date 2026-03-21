"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import { getContract, updateContract } from "@/lib/actions/contracts";
import { getCustomers } from "@/lib/actions/customers";
import { getEstimates } from "@/lib/actions/estimates";
import { getProfiles } from "@/lib/actions/profiles";

const STATUS_OPTIONS = [
  { value: "preparing", label: "準備中" },{ value: "contracted", label: "契約済" },{ value: "executing", label: "実行中" },{ value: "completed", label: "完了" },{ value: "cancelled", label: "キャンセル" },
] as const;

export default function ContractEditPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<{id:string;name:string}[]>([]);
  const [estimates, setEstimates] = useState<{id:string;estimate_no:string;title:string|null}[]>([]);
  const [profiles, setProfiles] = useState<{id:string;display_name:string}[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("preparing");
  const [amount, setAmount] = useState("");
  const [contractDate, setContractDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [estimateId, setEstimateId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!id) return;
    Promise.all([getContract(id as string), getCustomers(), getEstimates(), getProfiles()])
      .then(([contract, c, e, p]) => {
        setCustomers(c.map(x => ({id:x.id,name:x.name}))); setEstimates(e.map(x => ({id:x.id,estimate_no:x.estimate_no,title:x.title}))); setProfiles(p.map(x => ({id:x.id,display_name:x.display_name})));
        setCustomerId(contract.customer_id ?? ""); setTitle(contract.title); setStatus(contract.status); setAmount(contract.amount ? String(contract.amount) : ""); setContractDate(contract.contract_date ?? ""); setStartDate(contract.start_date ?? ""); setEndDate(contract.end_date ?? ""); setEstimateId(contract.estimate_id ?? ""); setAssignedTo(contract.assigned_to ?? ""); setNotes(contract.notes ?? "");
      }).catch(() => toast.error("取得に失敗")).finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!title.trim()) { toast.error("件名を入力してください"); return; }
    setSaving(true);
    try {
      await updateContract(id as string, { title: title.trim(), customer_id: customerId || null, estimate_id: estimateId || null, status: status as "preparing"|"contracted"|"executing"|"completed"|"cancelled", contract_date: contractDate || null, start_date: startDate || null, end_date: endDate || null, amount: amount ? Number(amount) : 0, assigned_to: assignedTo || null, notes: notes || null });
      toast.success("更新しました"); router.push(`/contracts/${id}`);
    } catch { toast.error("更新に失敗"); } finally { setSaving(false); }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3"><Link href={`/contracts/${id}`}><Button variant="ghost" size="icon" className="size-8"><ArrowLeft className="size-4" /></Button></Link><h1 className="text-xl font-semibold">契約編集</h1></div>
      <Card><CardHeader className="pb-3"><CardTitle className="text-base">契約情報</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {loading ? <div className="space-y-4">{Array.from({length:6}).map((_,i)=><Skeleton key={i} className="h-10 w-full" />)}</div> : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>顧客</Label><Select value={customerId} onValueChange={setCustomerId}><SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger><SelectContent>{customers.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>ステータス</Label><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUS_OPTIONS.map(s=><SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2 sm:col-span-2"><Label>件名</Label><Input value={title} onChange={e=>setTitle(e.target.value)} /></div>
                <div className="space-y-2"><Label>契約金額</Label><Input type="number" value={amount} onChange={e=>setAmount(e.target.value)} /></div>
                <div className="space-y-2"><Label>契約日</Label><Input type="date" value={contractDate} onChange={e=>setContractDate(e.target.value)} /></div>
                <div className="space-y-2"><Label>開始日</Label><Input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} /></div>
                <div className="space-y-2"><Label>終了日</Label><Input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} /></div>
                <div className="space-y-2"><Label>担当者</Label><Select value={assignedTo} onValueChange={setAssignedTo}><SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger><SelectContent>{profiles.map(p=><SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>関連見積</Label><Select value={estimateId} onValueChange={setEstimateId}><SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger><SelectContent>{estimates.map(e=><SelectItem key={e.id} value={e.id}>{e.estimate_no}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <div className="space-y-2"><Label>備考</Label><Textarea rows={4} value={notes} onChange={e=>setNotes(e.target.value)} /></div>
            </>
          )}
        </CardContent>
      </Card>
      <div className="flex justify-end gap-3 pb-6"><Link href={`/contracts/${id}`}><Button variant="outline">キャンセル</Button></Link><Button onClick={handleSave} disabled={saving||loading}><Save className="size-4 mr-1" />{saving?"保存中...":"保存"}</Button></div>
    </div>
  );
}
