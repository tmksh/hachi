import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, CalendarDays, Cloud, Users, AlertCircle, ClipboardList } from "lucide-react";
import { getConstructionReport } from "@/lib/actions/construction-reports";

export default async function ConstructionReportDetailPage({
  params,
}: {
  params: Promise<{ id: string; reportId: string }>;
}) {
  const { id, reportId } = await params;
  const report = await getConstructionReport(reportId);

  if (!report) notFound();

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Link href={`/constructions/${id}`}>
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{report.title}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {format(new Date(report.report_date), "yyyy年M月d日（E）", { locale: ja })}
            {report.author && <span className="ml-2">· {(report.author as { display_name: string }).display_name}</span>}
          </p>
        </div>
      </div>

      {/* 概要バッジ */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          {format(new Date(report.report_date), "yyyy-MM-dd")}
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Cloud className="h-4 w-4" />
          {report.weather}
        </div>
        {report.workers_count != null && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            作業員 {report.workers_count}名
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <ClipboardList className="h-4 w-4" />作業内容
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{report.content}</p>
        </CardContent>
      </Card>

      {report.progress_note && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">進捗状況・特記事項</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{report.progress_note}</p>
          </CardContent>
        </Card>
      )}

      {report.issues && (
        <Card className="border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5 text-amber-700">
              <AlertCircle className="h-4 w-4" />問題・懸念事項
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap leading-relaxed text-amber-900">{report.issues}</p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Link href={`/constructions/${id}`}>
          <Button variant="outline" size="sm">工事詳細に戻る</Button>
        </Link>
      </div>
    </div>
  );
}
