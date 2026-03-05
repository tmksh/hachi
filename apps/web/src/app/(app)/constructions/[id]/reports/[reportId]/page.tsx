"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

const reportData = {
  id: "R-001",
  date: "2026-03-05",
  author: "田中太郎",
  weather: "晴れ",
  workers: 8,
  content:
    "内装ボード貼り2階部分完了。石膏ボードの搬入・取り付け作業を実施。2階寝室・廊下・洗面所の壁面ボード貼りが全て完了。明日から1階リビング部分に着手予定。電気配線の最終確認も併せて実施した。",
  safetyChecks: [
    { item: "朝礼・KY活動実施", checked: true },
    { item: "安全帯・ヘルメット着用確認", checked: true },
    { item: "足場・仮設設備点検", checked: true },
    { item: "重機・工具の始業前点検", checked: true },
    { item: "作業区域の整理整頓", checked: true },
    { item: "火気使用箇所の確認", checked: false },
  ],
  notes: "明日の資材搬入予定：1階リビング用石膏ボード 40枚",
};

export default function ReportDetailPage() {
  const { id, reportId } = useParams();

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/constructions/${id}`}>
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <PageHeader
          title={`日報 - ${reportData.date}`}
          description={`報告者: ${reportData.author}`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Basic Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">基本情報</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">日報番号</dt>
                <dd className="font-medium">{reportId as string}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">日付</dt>
                <dd className="font-medium tabular-nums">{reportData.date}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">天候</dt>
                <dd>
                  <Badge variant="secondary">{reportData.weather}</Badge>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">作業員数</dt>
                <dd className="font-medium">{reportData.workers}名</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">報告者</dt>
                <dd className="font-medium">{reportData.author}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Work Content */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">作業内容</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{reportData.content}</p>
          </CardContent>
        </Card>
      </div>

      {/* Safety Checklist */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">安全確認チェックリスト</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {reportData.safetyChecks.map((check) => (
              <div
                key={check.item}
                className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
                  check.checked
                    ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                    : "bg-muted/50 text-muted-foreground"
                }`}
              >
                <CheckCircle2
                  className={`h-4 w-4 ${
                    check.checked ? "text-green-600" : "text-muted-foreground/50"
                  }`}
                />
                {check.item}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {reportData.notes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">備考</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{reportData.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
