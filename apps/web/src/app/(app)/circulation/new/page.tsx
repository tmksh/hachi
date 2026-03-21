"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import { createAnnouncement } from "@/lib/actions/announcements";

export default function CirculationNewPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);
  const [targetType, setTargetType] = useState("all");
  const [dueDate, setDueDate] = useState("");

  const handleSave = async () => {
    if (!title.trim() || !body.trim()) { toast.error("タイトルと本文を入力してください"); return; }
    setSaving(true);
    try {
      await createAnnouncement({ title: title.trim(), body: body.trim(), pinned, is_urgent: isUrgent, target_type: targetType as "all"|"departments"|"individuals", due_date: dueDate || undefined });
      toast.success("投稿しました"); router.push("/circulation");
    } catch { toast.error("投稿に失敗"); } finally { setSaving(false); }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3"><Link href="/circulation"><Button variant="ghost" size="icon" className="size-8"><ArrowLeft className="size-4" /></Button></Link><h1 className="text-xl font-semibold">新規お知らせ</h1></div>
      <Card><CardHeader className="pb-3"><CardTitle className="text-base">内容</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label>タイトル *</Label><Input value={title} onChange={e=>setTitle(e.target.value)} /></div>
          <div className="space-y-2"><Label>本文 *</Label><Textarea rows={8} value={body} onChange={e=>setBody(e.target.value)} /></div>
        </CardContent>
      </Card>
      <Card><CardHeader className="pb-3"><CardTitle className="text-base">設定</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>対象</Label><Select value={targetType} onValueChange={setTargetType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全員</SelectItem><SelectItem value="departments">部署</SelectItem><SelectItem value="individuals">個人</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>期限</Label><Input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} /></div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2"><Switch checked={pinned} onCheckedChange={setPinned} /><Label>ピン留め</Label></div>
            <div className="flex items-center gap-2"><Switch checked={isUrgent} onCheckedChange={setIsUrgent} /><Label>緊急</Label></div>
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end gap-3"><Link href="/circulation"><Button variant="outline">キャンセル</Button></Link><Button onClick={handleSave} disabled={saving}><Save className="size-4 mr-1" />{saving?"投稿中...":"投稿"}</Button></div>
    </div>
  );
}
