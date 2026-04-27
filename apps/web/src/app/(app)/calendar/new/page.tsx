"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TimeSelect } from "@/components/ui/time-select";
import { ArrowLeft, Save } from "lucide-react";
import { createCalendarEvent } from "@/lib/actions/calendar";

export default function CalendarNewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialDate = searchParams.get("date") ?? "";
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(initialDate);
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState(initialDate);
  const [endTime, setEndTime] = useState("10:00");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");

  const handleSave = async () => {
    if (!title.trim() || !startDate) { toast.error("タイトルと開始日を入力してください"); return; }
    setSaving(true);
    try {
      await createCalendarEvent({ title: title.trim(), description: description || undefined, start_at: `${startDate}T${startTime}:00`, end_at: `${endDate || startDate}T${endTime}:00`, category: (category || undefined) as "sales"|"construction"|"task"|"facility"|"equipment"|undefined, location: location || undefined });
      toast.success("予定を追加しました"); router.push("/calendar");
    } catch { toast.error("追加に失敗"); } finally { setSaving(false); }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3"><Link href="/calendar"><Button variant="ghost" size="icon" className="size-8"><ArrowLeft className="size-4" /></Button></Link><h1 className="text-xl font-semibold">予定追加</h1></div>
      <Card><CardHeader className="pb-3"><CardTitle className="text-base">予定情報</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2"><Label>タイトル *</Label><Input value={title} onChange={e=>setTitle(e.target.value)} /></div>
            <div className="space-y-2"><Label>開始日 *</Label><Input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>開始時刻</Label><TimeSelect value={startTime} onChange={setStartTime} /></div>
            <div className="space-y-2"><Label>終了日</Label><Input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>終了時刻</Label><TimeSelect value={endTime} onChange={setEndTime} /></div>
            <div className="space-y-2"><Label>カテゴリ</Label><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger><SelectContent><SelectItem value="sales">営業</SelectItem><SelectItem value="construction">工事</SelectItem><SelectItem value="task">タスク</SelectItem><SelectItem value="facility">施設</SelectItem><SelectItem value="equipment">機材</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>場所</Label><Input value={location} onChange={e=>setLocation(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>説明</Label><Textarea rows={3} value={description} onChange={e=>setDescription(e.target.value)} /></div>
        </CardContent>
      </Card>
      <div className="flex justify-end gap-3"><Link href="/calendar"><Button variant="outline">キャンセル</Button></Link><Button onClick={handleSave} disabled={saving}><Save className="size-4 mr-1" />{saving?"保存中...":"保存"}</Button></div>
    </div>
  );
}
