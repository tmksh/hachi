"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Calendar, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  proposeSchedulingCandidates,
  saveSchedulingRequest,
  type SchedulingCandidate,
} from "@/lib/actions/crm-features";

const FIELD_SELECT = "w-full min-w-0 h-9";

export function SchedulingTab({ customerId }: { customerId: string }) {
  const [meetingType, setMeetingType] = useState<"in_person" | "online" | "phone">("in_person");
  const [timeSlot, setTimeSlot] = useState<"morning" | "afternoon" | "evening" | "anytime">("anytime");
  const [duration, setDuration] = useState("60");
  const [candidates, setCandidates] = useState<SchedulingCandidate[]>([]);
  const [aiOptimized, setAiOptimized] = useState(false);
  const [calendarLinked, setCalendarLinked] = useState(false);
  const [loadingMode, setLoadingMode] = useState<"basic" | "ai" | null>(null);
  const [saving, setSaving] = useState(false);

  const proposeDates = async (optimized: boolean) => {
    setLoadingMode(optimized ? "ai" : "basic");
    try {
      const result = await proposeSchedulingCandidates({
        meeting_type: meetingType,
        time_slot: timeSlot,
        duration_minutes: Number(duration),
        ai_optimized: optimized,
      });
      setCandidates(result.candidates);
      setAiOptimized(result.usedAi);
      setCalendarLinked(result.calendarLinked);
      if (result.candidates.length === 0) {
        toast.error("空きのある候補日が見つかりませんでした");
        return;
      }
      toast.success(
        optimized
          ? "カレンダー空きを基準に候補日を最適化しました"
          : "候補日を提案しました",
      );
    } catch {
      toast.error("候補日の提案に失敗しました");
    } finally {
      setLoadingMode(null);
    }
  };

  const save = async () => {
    if (candidates.length === 0) return;
    setSaving(true);
    try {
      await saveSchedulingRequest({
        customer_id: customerId,
        meeting_type: meetingType,
        time_slot: timeSlot,
        duration_minutes: Number(duration),
        candidate_dates: candidates.map((c) => c.displayLabel + (c.note ? `（${c.note}）` : "")),
        ai_optimized: aiOptimized,
      });
      toast.success("スケジュール提案を保存しました");
    } catch {
      toast.error("保存に失敗しました。DBマイグレーション（00037）が未適用の可能性があります");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
      <Card variant="inset" className="py-0 overflow-hidden flex flex-col min-h-[360px]">
        <CardHeader className="pb-2 pt-4 px-4 border-b border-border/40 shrink-0">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#0F5132] shrink-0" />
            スケジューリング
          </CardTitle>
          <CardDescription className="text-xs mt-1">
            面談条件を選び、候補日を提案
          </CardDescription>
        </CardHeader>

        <CardContent className="px-4 py-4 flex flex-col flex-1 gap-0 p-0">
          <div className="px-4 pt-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">面談区分</Label>
              <Select value={meetingType} onValueChange={(v) => setMeetingType(v as typeof meetingType)}>
                <SelectTrigger className={FIELD_SELECT}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_person">対面</SelectItem>
                  <SelectItem value="online">オンライン</SelectItem>
                  <SelectItem value="phone">電話</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">希望時間帯</Label>
              <Select value={timeSlot} onValueChange={(v) => setTimeSlot(v as typeof timeSlot)}>
                <SelectTrigger className={FIELD_SELECT}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">午前</SelectItem>
                  <SelectItem value="afternoon">午後</SelectItem>
                  <SelectItem value="evening">夜</SelectItem>
                  <SelectItem value="anytime">いつでも</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">所要時間</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className={FIELD_SELECT}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["15", "30", "60", "90", "120"].map((m) => (
                    <SelectItem key={m} value={m}>{m}分</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-border/40 pt-4">
            <Button
              className="h-9 w-full"
              disabled={loadingMode !== null}
              onClick={() => proposeDates(false)}
            >
              {loadingMode === "basic" ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              候補日を提案
            </Button>
            <Button
              variant="outline"
              className="h-9 w-full gap-1.5"
              disabled={loadingMode !== null}
              onClick={() => proposeDates(true)}
            >
              {loadingMode === "ai" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              AIで最適化
            </Button>
          </div>

          <div className="mt-auto px-4 pb-4 pt-3 border-t border-border/40 space-y-2">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {calendarLinked
                ? "Googleカレンダーとアプリ内予定を参照して空き時間から提案します。"
                : "アプリ内カレンダーの予定を参照します。Google連携はカレンダー画面から設定できます。"}
            </p>
            <div className="rounded-md border border-amber-200/80 bg-amber-50/70 px-2.5 py-2 text-[11px] text-amber-950 leading-relaxed">
              <div className="flex gap-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <p>
                  AI最適化は現時点ではルールベースです。本格的な AI 判断は外部 API 連携後に対応予定です。
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card variant="inset" className="py-0 overflow-hidden flex flex-col min-h-[360px]">
        <CardHeader className="pb-2 pt-4 px-4 border-b border-border/40 shrink-0">
          <CardTitle className="text-sm font-semibold">提案候補日</CardTitle>
          <CardDescription className="text-xs mt-1">
            {candidates.length > 0
              ? `${candidates.length}件${aiOptimized ? "（最適化済み）" : ""}`
              : "左の条件で候補日を生成"}
          </CardDescription>
        </CardHeader>

        <CardContent className="px-4 py-4 flex flex-col flex-1">
          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground flex-1 flex items-center justify-center text-center py-8">
              「候補日を提案」または「AIで最適化」を押してください
            </p>
          ) : (
            <ul className="space-y-2 flex-1">
              {candidates.map((c, i) => (
                <li key={c.id} className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="text-xs font-semibold text-[#0F5132] tabular-nums shrink-0">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{c.displayLabel}</p>
                      {c.note && <p className="text-[11px] text-muted-foreground mt-0.5">{c.note}</p>}
                      {c.aiScore != null && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">適合度 {c.aiScore}</p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {candidates.length > 0 && (
            <Button className="mt-4 w-full h-9 shrink-0" disabled={saving} onClick={save}>
              {saving ? "保存中..." : "この内容で保存"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
