"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { createConstructionReport } from "@/lib/actions/construction-reports";

const WEATHER_OPTIONS = ["晴れ", "曇り", "雨", "雪", "晴れ時々曇り", "曇り時々雨"];

export default function ConstructionReportNewPage() {
  const { id } = useParams();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [reportDate, setReportDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [title, setTitle] = useState("");
  const [weather, setWeather] = useState("晴れ");
  const [content, setContent] = useState("");
  const [workersCount, setWorkersCount] = useState("");
  const [progressNote, setProgressNote] = useState("");
  const [issues, setIssues] = useState("");

  const handleSave = async () => {
    if (!title.trim()) { toast.error("件名を入力してください"); return; }
    if (!content.trim()) { toast.error("作業内容を入力してください"); return; }

    setSaving(true);
    try {
      const report = await createConstructionReport(id as string, {
        report_date: reportDate,
        title: title.trim(),
        weather,
        content: content.trim(),
        workers_count: workersCount ? Number(workersCount) : null,
        progress_note: progressNote.trim() || null,
        issues: issues.trim() || null,
      });
      toast.success("日報を保存しました");
      router.push(`/constructions/${id}/reports/${report.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Link href={`/constructions/${id}`}>
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">日報作成</h1>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">基本情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>日付 <span className="text-red-500">*</span></Label>
              <Input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>件名 <span className="text-red-500">*</span></Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="例: 基礎工事・配筋検査" autoFocus />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>天候</Label>
              <Select value={weather} onValueChange={setWeather}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WEATHER_OPTIONS.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>作業員数（人）</Label>
              <Input
                type="number"
                min={0}
                value={workersCount}
                onChange={e => setWorkersCount(e.target.value)}
                placeholder="例: 5"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>作業内容 <span className="text-red-500">*</span></Label>
            <Textarea
              rows={5}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="本日の作業内容を詳しく記入..."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">進捗・課題</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>進捗状況・特記事項</Label>
            <Textarea
              rows={3}
              value={progressNote}
              onChange={e => setProgressNote(e.target.value)}
              placeholder="工程の進捗や気づいた点など..."
            />
          </div>
          <div className="space-y-2">
            <Label>問題・懸念事項</Label>
            <Textarea
              rows={3}
              value={issues}
              onChange={e => setIssues(e.target.value)}
              placeholder="問題点や今後の課題があれば..."
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Link href={`/constructions/${id}`}>
          <Button variant="outline">キャンセル</Button>
        </Link>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Save className="size-4 mr-1" />}
          保存
        </Button>
      </div>
    </div>
  );
}
