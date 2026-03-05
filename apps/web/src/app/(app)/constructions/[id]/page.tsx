"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  User,
  Building2,
  Phone,
  FileText,
  Camera,
  Image,
  Pencil,
} from "lucide-react";

const constructionData = {
  id: "C-001",
  name: "山田邸リノベーション工事",
  site: "東京都世田谷区成城3-12-5",
  client: "山田太郎",
  clientPhone: "03-1234-5678",
  manager: "田中太郎",
  startDate: "2025-10-01",
  endDate: "2026-04-30",
  progress: 75,
  status: "in_progress",
  budget: 32000000,
  actual: 24500000,
  description:
    "築30年の木造2階建て住宅のフルリノベーション工事。キッチン・浴室の全面改装、耐震補強、断熱材入替を含む。",
};

const craftsmen = [
  { name: "木村大工", specialty: "大工", role: "棟梁", status: "active" },
  { name: "斎藤左官", specialty: "左官", role: "職長", status: "active" },
  { name: "中島電気", specialty: "電気工事", role: "担当", status: "active" },
  { name: "小林設備", specialty: "設備工事", role: "担当", status: "pending" },
  { name: "高田塗装", specialty: "塗装", role: "担当", status: "pending" },
];

const phases = [
  { name: "解体工事", start: "2025-10-01", end: "2025-10-31", progress: 100, status: "completed" },
  { name: "基礎補強工事", start: "2025-11-01", end: "2025-11-30", progress: 100, status: "completed" },
  { name: "構造躯体工事", start: "2025-12-01", end: "2026-01-15", progress: 100, status: "completed" },
  { name: "電気・設備工事", start: "2026-01-16", end: "2026-02-28", progress: 80, status: "in_progress" },
  { name: "内装仕上げ工事", start: "2026-03-01", end: "2026-03-31", progress: 30, status: "in_progress" },
  { name: "外装工事", start: "2026-03-15", end: "2026-04-15", progress: 0, status: "preparing" },
  { name: "検査・引渡し", start: "2026-04-16", end: "2026-04-30", progress: 0, status: "preparing" },
];

const dailyReports = [
  {
    id: "R-001",
    date: "2026-03-05",
    author: "田中太郎",
    weather: "晴れ",
    workers: 8,
    summary: "内装ボード貼り2階部分完了。明日から1階リビング着手。",
  },
  {
    id: "R-002",
    date: "2026-03-04",
    author: "田中太郎",
    weather: "曇り",
    workers: 7,
    summary: "電気配線2階部分完了。内装ボード貼り2階寝室着手。",
  },
  {
    id: "R-003",
    date: "2026-03-03",
    author: "田中太郎",
    weather: "晴れ",
    workers: 9,
    summary: "設備配管工事完了。電気配線2階部分着手。資材搬入あり。",
  },
  {
    id: "R-004",
    date: "2026-03-02",
    author: "田中太郎",
    weather: "雨",
    workers: 5,
    summary: "雨天のため外部作業中止。内部設備配管工事を継続。",
  },
];

const photos = [
  { date: "2026-03-05", caption: "2階内装ボード貼り完了", category: "内装" },
  { date: "2026-03-03", caption: "設備配管工事", category: "設備" },
  { date: "2026-02-20", caption: "電気配線作業中", category: "電気" },
  { date: "2026-01-15", caption: "構造躯体完了", category: "構造" },
  { date: "2025-11-30", caption: "基礎補強完了", category: "基礎" },
  { date: "2025-10-31", caption: "解体工事完了", category: "解体" },
];

const documents = [
  { name: "工事請負契約書", type: "PDF", date: "2025-09-15", size: "2.4MB" },
  { name: "設計図面一式", type: "PDF", date: "2025-09-20", size: "15.8MB" },
  { name: "工程表", type: "Excel", date: "2025-09-25", size: "1.2MB" },
  { name: "建築確認申請書", type: "PDF", date: "2025-09-28", size: "3.1MB" },
  { name: "安全管理計画書", type: "PDF", date: "2025-10-01", size: "890KB" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(value);
}

export default function ConstructionDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const data = constructionData;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Back link & Header */}
      <div>
        <Link
          href="/constructions"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          工事一覧に戻る
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight">{data.name}</h1>
              <StatusBadge status={data.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {data.site}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">進捗</p>
              <p className="text-lg font-semibold tabular-nums">{data.progress}%</p>
            </div>
            <div className="w-24">
              <Progress value={data.progress} className="h-2" />
            </div>
            <Link href={`/constructions/${id}/edit`}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Pencil className="h-4 w-4" />
                編集
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">概要</TabsTrigger>
          <TabsTrigger value="schedule">工程表</TabsTrigger>
          <TabsTrigger value="reports">日報</TabsTrigger>
          <TabsTrigger value="photos">写真</TabsTrigger>
          <TabsTrigger value="documents">書類</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">基本情報</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" /> 工事番号
                    </dt>
                    <dd className="font-medium">{id as string}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" /> 顧客
                    </dt>
                    <dd className="font-medium">{data.client}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" /> 連絡先
                    </dt>
                    <dd className="font-medium">{data.clientPhone}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" /> 現場監督
                    </dt>
                    <dd className="font-medium">{data.manager}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" /> 工期
                    </dt>
                    <dd className="font-medium tabular-nums">
                      {data.startDate} ~ {data.endDate}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">{data.description}</p>
                </div>
              </CardContent>
            </Card>

            {/* Budget */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">予算実績</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">予算</p>
                    <p className="text-lg font-semibold tabular-nums">
                      {formatCurrency(data.budget)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">実績</p>
                    <p className="text-lg font-semibold tabular-nums">
                      {formatCurrency(data.actual)}
                    </p>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">消化率</span>
                    <span className="font-medium tabular-nums">
                      {Math.round((data.actual / data.budget) * 100)}%
                    </span>
                  </div>
                  <Progress
                    value={Math.round((data.actual / data.budget) * 100)}
                    className="h-2"
                  />
                </div>
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <p className="text-xs text-muted-foreground">残予算</p>
                  <p className="text-lg font-semibold text-green-700 dark:text-green-400 tabular-nums">
                    {formatCurrency(data.budget - data.actual)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Assigned Craftsmen */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">配置職人</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>氏名</TableHead>
                    <TableHead>専門</TableHead>
                    <TableHead>役割</TableHead>
                    <TableHead>状況</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {craftsmen.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.specialty}</TableCell>
                      <TableCell>{c.role}</TableCell>
                      <TableCell>
                        <StatusBadge
                          status={c.status === "active" ? "approved" : "pending"}
                          label={c.status === "active" ? "稼働中" : "待機中"}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schedule */}
        <TabsContent value="schedule" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">工程表</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {phases.map((phase, i) => (
                  <div
                    key={i}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 rounded-lg border"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{phase.name}</span>
                        <StatusBadge status={phase.status} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                        {phase.start} ~ {phase.end}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 sm:w-48">
                      <Progress value={phase.progress} className="h-2 flex-1" />
                      <span className="text-xs font-medium tabular-nums w-8 text-right">
                        {phase.progress}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Daily Reports */}
        <TabsContent value="reports" className="mt-4">
          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">日報一覧</CardTitle>
              <Link href={`/constructions/${id}/reports/new`}>
                <Button size="sm" className="gap-1.5">
                  <FileText className="h-4 w-4" />
                  日報作成
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dailyReports.map((report, i) => (
                  <div key={i} className="p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => router.push(`/constructions/${id}/reports/${report.id}`)}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium tabular-nums">{report.date}</span>
                        <Badge variant="secondary" className="text-xs">
                          {report.weather}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>作業員: {report.workers}名</span>
                        <span>報告者: {report.author}</span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{report.summary}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Photos */}
        <TabsContent value="photos" className="mt-4">
          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">工事写真</CardTitle>
              <Button size="sm" className="gap-1.5" onClick={() => toast.success("写真をアップロードしました")}>
                <Camera className="h-4 w-4" />
                写真追加
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {photos.map((photo, i) => (
                  <div
                    key={i}
                    className="aspect-video rounded-lg bg-muted flex flex-col items-center justify-center border hover:border-primary/50 transition-colors cursor-pointer"
                  >
                    <Image className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-xs font-medium text-center px-2">{photo.caption}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Badge variant="secondary" className="text-[10px]">{photo.category}</Badge>
                      <span className="text-[10px] text-muted-foreground">{photo.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">書類一覧</CardTitle>
              <Button size="sm" className="gap-1.5" onClick={() => toast.success("書類をアップロードしました")}>
                <FileText className="h-4 w-4" />
                書類追加
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>書類名</TableHead>
                    <TableHead>種別</TableHead>
                    <TableHead>更新日</TableHead>
                    <TableHead>サイズ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc, i) => (
                    <TableRow key={i} className="cursor-pointer hover:bg-accent/50">
                      <TableCell className="font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {doc.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {doc.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">{doc.date}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{doc.size}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
