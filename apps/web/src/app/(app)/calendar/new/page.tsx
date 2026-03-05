"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { CalendarPlus } from "lucide-react";

export default function CalendarNewPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [eventType, setEventType] = useState("");
  const [location, setLocation] = useState("");
  const [participants, setParticipants] = useState("");
  const [memo, setMemo] = useState("");

  const handleSave = () => {
    if (!title) {
      toast.error("タイトルを入力してください");
      return;
    }
    if (!date) {
      toast.error("日付を入力してください");
      return;
    }
    toast.success("予定を追加しました", {
      description: `${title} - ${date}`,
    });
    router.push("/calendar");
  };

  const handleCancel = () => {
    router.push("/calendar");
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="予定追加" description="新しいスケジュールを登録">
        <div className="flex items-center gap-2">
          <CalendarPlus className="h-5 w-5 text-primary" />
        </div>
      </PageHeader>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">予定情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* タイトル */}
          <div className="space-y-2">
            <Label htmlFor="title">タイトル <span className="text-destructive">*</span></Label>
            <Input
              id="title"
              placeholder="予定のタイトルを入力"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* 日付 */}
          <div className="space-y-2">
            <Label htmlFor="date">日付 <span className="text-destructive">*</span></Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* 開始時刻・終了時刻 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">開始時刻</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">終了時刻</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {/* 種別 */}
          <div className="space-y-2">
            <Label>種別</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger>
                <SelectValue placeholder="種別を選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="construction">工事</SelectItem>
                <SelectItem value="deal">商談</SelectItem>
                <SelectItem value="meeting">会議</SelectItem>
                <SelectItem value="deadline">締切</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 場所 */}
          <div className="space-y-2">
            <Label htmlFor="location">場所</Label>
            <Input
              id="location"
              placeholder="場所を入力"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          {/* 参加者 */}
          <div className="space-y-2">
            <Label htmlFor="participants">参加者</Label>
            <Input
              id="participants"
              placeholder="参加者を入力（カンマ区切り）"
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
            />
          </div>

          {/* メモ */}
          <div className="space-y-2">
            <Label htmlFor="memo">メモ</Label>
            <Textarea
              id="memo"
              placeholder="メモを入力"
              rows={4}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </div>

          {/* ボタン */}
          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSave}>保存</Button>
            <Button variant="outline" onClick={handleCancel}>
              キャンセル
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
