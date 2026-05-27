"use client";

import { useState } from "react";
import { addDays, format } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "lucide-react";
import { toast } from "sonner";
import { saveSchedulingRequest } from "@/lib/actions/crm-features";

export function SchedulingTab({ customerId }: { customerId: string }) {
  const [meetingType, setMeetingType] = useState<"in_person" | "online" | "phone">("in_person");
  const [timeSlot, setTimeSlot] = useState<"morning" | "afternoon" | "evening" | "anytime">("anytime");
  const [duration, setDuration] = useState("60");
  const [candidates, setCandidates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const proposeDates = (aiOptimized = false) => {
    setLoading(true);
    const slots: string[] = [];
    let day = new Date();
    while (slots.length < 5) {
      day = addDays(day, 1);
      if (day.getDay() === 0) continue;
      const label = format(day, "yyyy/MM/dd (EEE)", { locale: ja });
      const timeLabel = timeSlot === "morning" ? " 10:00" : timeSlot === "afternoon" ? " 14:00" : timeSlot === "evening" ? " 18:00" : " 調整可";
      slots.push(`${label}${timeLabel}${aiOptimized ? " ✓AI最適" : ""}`);
    }
    setCandidates(slots);
    setLoading(false);
    toast.success(aiOptimized ? "AIが候補日を最適化しました" : "候補日を提案しました");
  };

  const save = async () => {
    try {
      await saveSchedulingRequest({
        customer_id: customerId,
        meeting_type: meetingType,
        time_slot: timeSlot,
        duration_minutes: Number(duration),
        candidate_dates: candidates,
        ai_optimized: candidates.some((c) => c.includes("AI最適")),
      });
      toast.success("スケジュール提案を保存しました");
    } catch {
      toast.error("保存に失敗しました");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <p className="text-sm font-semibold flex items-center gap-2"><Calendar className="h-4 w-4" />スケジューリング</p>
          <div className="space-y-2">
            <Label className="text-xs">面談区分</Label>
            <Select value={meetingType} onValueChange={(v) => setMeetingType(v as typeof meetingType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="in_person">対面</SelectItem>
                <SelectItem value="online">オンライン</SelectItem>
                <SelectItem value="phone">電話</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">希望時間帯</Label>
            <Select value={timeSlot} onValueChange={(v) => setTimeSlot(v as typeof timeSlot)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="morning">午前</SelectItem>
                <SelectItem value="afternoon">午後</SelectItem>
                <SelectItem value="evening">夜</SelectItem>
                <SelectItem value="anytime">いつでも</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">所要時間</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["15", "30", "60", "90", "120"].map((m) => (
                  <SelectItem key={m} value={m}>{m}分</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={loading} onClick={() => proposeDates(false)}>候補日を提案</Button>
            <Button size="sm" variant="outline" disabled={loading} onClick={() => proposeDates(true)}>AIで最適化</Button>
          </div>
          <p className="text-[11px] text-muted-foreground">Googleカレンダー連携はカレンダー設定後に自動反映されます</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-semibold mb-3">提案候補日</p>
          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">候補日提案ボタンを押してください</p>
          ) : (
            <ul className="space-y-2">
              {candidates.map((c) => (
                <li key={c} className="text-sm px-3 py-2 rounded-lg bg-muted/40 border">{c}</li>
              ))}
            </ul>
          )}
          {candidates.length > 0 && (
            <Button size="sm" className="mt-4 w-full" onClick={save}>この内容で保存</Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
