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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import { createCustomer } from "@/lib/actions/customers";
import { getProfiles } from "@/lib/actions/profiles";
import { getCustomerTagMasters } from "@/lib/actions/deals";
import { Badge } from "@/components/ui/badge";

export default function CrmNewPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [profiles, setProfiles] = useState<{id:string;display_name:string}[]>([]);
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("active");
  const [assignedTo, setAssignedTo] = useState("");
  const [notes, setNotes] = useState("");
  const [tagMasters, setTagMasters] = useState<{ id: string; label: string }[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      getProfiles().then(p => setProfiles(p.map(x => ({id:x.id,display_name:x.display_name})))),
      getCustomerTagMasters().then(setTagMasters),
    ]).catch(() => {});
  }, []);

  const toggleTag = (label: string) => {
    setSelectedTags(prev => prev.includes(label) ? prev.filter(t => t !== label) : [...prev, label]);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("名前を入力してください"); return; }
    setSaving(true);
    try {
      await createCustomer({ name: name.trim(), company_name: companyName || null, email: email || null, phone: phone || null, address: address || null, source: source || null, status, assigned_to: assignedTo || null, budget_min: null, budget_max: null, ai_score: null, tags: selectedTags, notes: notes || null });
      toast.success("顧客を登録しました"); router.push("/crm");
    } catch { toast.error("登録に失敗しました"); } finally { setSaving(false); }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3"><Link href="/crm"><Button variant="ghost" size="icon" className="size-8"><ArrowLeft className="size-4" /></Button></Link><h1 className="text-xl font-semibold">新規顧客登録</h1></div>
      <Card><CardHeader className="pb-3"><CardTitle className="text-base">顧客情報</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>名前 *</Label><Input value={name} onChange={e=>setName(e.target.value)} placeholder="山田太郎" /></div>
            <div className="space-y-2"><Label>会社名</Label><Input value={companyName} onChange={e=>setCompanyName(e.target.value)} placeholder="株式会社○○" /></div>
            <div className="space-y-2"><Label>メール</Label><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} /></div>
            <div className="space-y-2"><Label>電話</Label><Input value={phone} onChange={e=>setPhone(e.target.value)} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>住所</Label><Input value={address} onChange={e=>setAddress(e.target.value)} /></div>
            <div className="space-y-2"><Label>ソース</Label><Input value={source} onChange={e=>setSource(e.target.value)} placeholder="紹介、Web等" /></div>
            <div className="space-y-2"><Label>ステータス</Label><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">アクティブ</SelectItem><SelectItem value="inactive">非アクティブ</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>担当者</Label><Select value={assignedTo} onValueChange={setAssignedTo}><SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger><SelectContent>{profiles.map(p=><SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2 sm:col-span-2">
              <Label>タグ</Label>
              <div className="flex flex-wrap gap-2 min-h-9">
                {tagMasters.length === 0 ? (
                  <p className="text-xs text-muted-foreground">設定画面でタグマスタを登録してください</p>
                ) : tagMasters.map(tag => (
                  <button key={tag.id} type="button" onClick={() => toggleTag(tag.label)}>
                    <Badge variant={selectedTags.includes(tag.label) ? "default" : "outline"}>{tag.label}</Badge>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-2"><Label>備考</Label><Textarea rows={4} value={notes} onChange={e=>setNotes(e.target.value)} /></div>
        </CardContent>
      </Card>
      <div className="flex justify-end gap-3"><Link href="/crm"><Button variant="outline">キャンセル</Button></Link><Button onClick={handleSave} disabled={saving}><Save className="size-4 mr-1" />{saving?"保存中...":"保存"}</Button></div>
    </div>
  );
}
