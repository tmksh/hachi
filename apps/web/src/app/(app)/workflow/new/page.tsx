"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import { createWorkflowRequest, getWorkflowTypes } from "@/lib/actions/workflow";
import { getProfiles } from "@/lib/actions/profiles";

export default function WorkflowNewPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loadingOpts, setLoadingOpts] = useState(true);
  const [types, setTypes] = useState<{id:string;name:string}[]>([]);
  const [profiles, setProfiles] = useState<{id:string;display_name:string}[]>([]);
  const [typeId, setTypeId] = useState("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [approverId, setApproverId] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => { Promise.all([getWorkflowTypes(), getProfiles()]).then(([t, p]) => { setTypes(t.map(x=>({id:x.id,name:x.name}))); setProfiles(p.map(x=>({id:x.id,display_name:x.display_name}))); }).catch(()=>{}).finally(()=>setLoadingOpts(false)); }, []);

  const handleSave = async () => {
    if (!title.trim() || !typeId) { toast.error("種別と件名を入力してください"); return; }
    setSaving(true);
    try {
      await createWorkflowRequest({ type_id: typeId, title: title.trim(), amount: amount ? Number(amount) : undefined, due_date: dueDate || undefined, approver_ids: approverId ? [approverId] : undefined, payload: description ? { description } : undefined });
      toast.success("申請しました"); router.push("/workflow");
    } catch { toast.error("申請に失敗"); } finally { setSaving(false); }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3"><Link href="/workflow"><Button variant="ghost" size="icon" className="size-8"><ArrowLeft className="size-4" /></Button></Link><h1 className="text-xl font-semibold">新規申請</h1></div>
      <Card><CardHeader className="pb-3"><CardTitle className="text-base">申請情報</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {loadingOpts ? <div className="space-y-4">{Array.from({length:3}).map((_,i)=><Skeleton key={i} className="h-10 w-full" />)}</div> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>種別 *</Label><Select value={typeId} onValueChange={setTypeId}><SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger><SelectContent>{types.map(t=><SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>承認者</Label><Select value={approverId} onValueChange={setApproverId}><SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger><SelectContent>{profiles.map(p=><SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2 sm:col-span-2"><Label>件名 *</Label><Input value={title} onChange={e=>setTitle(e.target.value)} /></div>
              <div className="space-y-2"><Label>金額</Label><Input type="number" value={amount} onChange={e=>setAmount(e.target.value)} /></div>
              <div className="space-y-2"><Label>期限</Label><Input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>説明</Label><Textarea rows={4} value={description} onChange={e=>setDescription(e.target.value)} /></div>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="flex justify-end gap-3"><Link href="/workflow"><Button variant="outline">キャンセル</Button></Link><Button onClick={handleSave} disabled={saving||loadingOpts}><Save className="size-4 mr-1" />{saving?"申請中...":"申請"}</Button></div>
    </div>
  );
}
