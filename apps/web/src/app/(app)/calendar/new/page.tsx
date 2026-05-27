"use client";

import { useState, Suspense } from "react";
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
import { createCalendarEvent, updateCalendarEvent } from "@/lib/actions/calendar";
import { createGoogleCalendarEvent } from "@/lib/google-calendar";

async function getGoogleToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/google-token");
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

function CalendarNewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialDate = searchParams.get("date") ?? "";
  const initialTime = searchParams.get("time") ?? "";
  const initialEndTime = searchParams.get("endTime") ?? "";

  const computeEndTime = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return "10:00";
    const total = (h * 60 + m + 60) % (24 * 60);
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  };

  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(initialDate);
  const [startTime, setStartTime] = useState(initialTime || "09:00");
  const [endDate, setEndDate] = useState(initialDate);
  const [endTime, setEndTime] = useState(
    initialEndTime || (initialTime ? computeEndTime(initialTime) : "10:00")
  );
  const [allDay, setAllDay] = useState(false);
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");

  const handleSave = async () => {
    if (!title.trim() || !startDate) {
      toast.error("タイトルと開始日を入力してください");
      return;
    }
    setSaving(true);
    try {
      const start_at = allDay ? `${startDate}T00:00:00` : `${startDate}T${startTime}:00`;
      const end_at = allDay ? `${endDate || startDate}T00:00:00` : `${endDate || startDate}T${endTime}:00`;

      // ローカル DB に保存
      const localEvent = await createCalendarEvent({
        title: title.trim(),
        description: description || undefined,
        start_at,
        end_at,
        all_day: allDay,
        category: (category || undefined) as "sales" | "construction" | "task" | "facility" | "equipment" | undefined,
        location: location || undefined,
      });

      // Google Calendar にも保存（連携済みの場合）
      const token = await getGoogleToken();
      if (token) {
        const googleEventId = await createGoogleCalendarEvent(token, {
          title: title.trim(),
          description: description || null,
          location: location || null,
          start_at,
          end_at,
          all_day: allDay,
        });
        if (googleEventId) {
          // google_event_id をローカルに保存
          await updateCalendarEvent(localEvent.id, {
            google_event_id: googleEventId,
          } as Parameters<typeof updateCalendarEvent>[1]);
        }
      }

      toast.success("予定を追加しました");
      router.push("/calendar");
    } catch {
      toast.error("追加に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/calendar">
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">予定追加</h1>
      </div>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">予定情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label>タイトル *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="all-day"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="all-day" className="cursor-pointer">終日</Label>
            </div>
            <div className="space-y-2">
              <Label>開始日 *</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            {!allDay && (
              <div className="space-y-2">
                <Label>開始時刻</Label>
                <TimeSelect value={startTime} onChange={setStartTime} />
              </div>
            )}
            <div className="space-y-2">
              <Label>終了日</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            {!allDay && (
              <div className="space-y-2">
                <Label>終了時刻</Label>
                <TimeSelect value={endTime} onChange={setEndTime} />
              </div>
            )}
            <div className="space-y-2">
              <Label>カテゴリ</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">営業</SelectItem>
                  <SelectItem value="construction">工事</SelectItem>
                  <SelectItem value="task">タスク</SelectItem>
                  <SelectItem value="facility">施設</SelectItem>
                  <SelectItem value="equipment">機材</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>場所</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>説明</Label>
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end gap-3">
        <Link href="/calendar">
          <Button variant="outline">キャンセル</Button>
        </Link>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="size-4 mr-1" />
          {saving ? "保存中..." : "保存"}
        </Button>
      </div>
    </div>
  );
}

export default function CalendarNewPage() {
  return (
    <Suspense fallback={<div className="p-4 md:p-8 text-sm text-muted-foreground">読み込み中...</div>}>
      <CalendarNewPageContent />
    </Suspense>
  );
}
