"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import { createCraftsman } from "@/lib/actions/craftsmen";
import { CraftsmanMasterFields } from "@/components/craftsmen/craftsman-master-fields";

export default function CraftsmanNewPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [invoiceChannel, setInvoiceChannel] = useState<"email" | "paper">("email");
  const [specialty, setSpecialty] = useState("");
  const [qualifications, setQualifications] = useState<string[]>([]);
  const [rank, setRank] = useState("");
  const [notes, setNotes] = useState("");

  const handleSave = async () => {
    if (!name.trim()) { toast.error("名前を入力してください"); return; }
    setSaving(true);
    try {
      await createCraftsman({
        name: name.trim(),
        company_name: companyName || null,
        phone: phone || null,
        email: email || null,
        invoice_channel: invoiceChannel,
        specialty: specialty || null,
        qualifications,
        rank: (rank || null) as "A" | "B" | "C" | null,
        report_rate: 0,
        active_projects: 0,
        total_projects: 0,
        notes: notes || null,
        skills: [],
        service_areas: [],
        contract_rate: null,
        payment_notes: null,
      });
      toast.success("登録しました");
      await queryClient.invalidateQueries({ queryKey: ["craftsmen"] });
      router.push("/craftsmen");
    } catch { toast.error("登録に失敗"); } finally { setSaving(false); }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3"><Link href="/craftsmen"><Button variant="ghost" size="icon" className="size-8"><ArrowLeft className="size-4" /></Button></Link><h1 className="text-2xl font-semibold tracking-tight text-foreground">新規職人登録</h1></div>
      <Card><CardHeader className="pb-3"><CardTitle className="text-base">職人情報</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>名前 *</Label><Input value={name} onChange={e=>setName(e.target.value)} /></div>
            <div className="space-y-2"><Label>会社名</Label><Input value={companyName} onChange={e=>setCompanyName(e.target.value)} /></div>
            <div className="space-y-2"><Label>電話</Label><Input value={phone} onChange={e=>setPhone(e.target.value)} /></div>
            <div className="space-y-2"><Label>メール</Label><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} /></div>
            <div className="space-y-2 sm:col-span-2">
              <Label>請求書の受領方法</Label>
              <Select value={invoiceChannel} onValueChange={(v) => setInvoiceChannel(v as "email" | "paper")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">メール認証（ログイン不要）</SelectItem>
                  <SelectItem value="paper">紙発注・自社書式（社内でPDF添付）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <CraftsmanMasterFields
              specialty={specialty}
              onSpecialtyChange={setSpecialty}
              qualifications={qualifications}
              onQualificationsChange={setQualifications}
            />
            <div className="space-y-2"><Label>ランク</Label><Select value={rank} onValueChange={setRank}><SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger><SelectContent><SelectItem value="A">A</SelectItem><SelectItem value="B">B</SelectItem><SelectItem value="C">C</SelectItem></SelectContent></Select></div>
          </div>
          <div className="space-y-2"><Label>備考</Label><Textarea rows={4} value={notes} onChange={e=>setNotes(e.target.value)} /></div>
        </CardContent>
      </Card>
      <div className="flex justify-end gap-3"><Link href="/craftsmen"><Button variant="outline">キャンセル</Button></Link><Button onClick={handleSave} disabled={saving}><Save className="size-4 mr-1" />{saving?"保存中...":"保存"}</Button></div>
    </div>
  );
}
