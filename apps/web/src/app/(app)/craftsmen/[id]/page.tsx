"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  ArrowLeft,
  Star,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Award,
  Briefcase,
  Edit,
} from "lucide-react";

const craftsmanData = {
  id: "W-001",
  name: "木村正男",
  specialty: "大工",
  subSpecialties: ["木造建築", "リノベーション", "耐震補強"],
  rating: 4.8,
  experience: 25,
  phone: "090-1234-5678",
  email: "kimura@example.com",
  area: "東京都・神奈川県",
  address: "東京都大田区南馬込3-15-7",
  availability: "available",
  certifications: ["一級建築大工技能士", "二級建築施工管理技士", "足場の組立て等作業主任者"],
  bio: "木造建築を専門とし、25年以上の経験を持つ熟練大工。リノベーションや耐震補強にも精通。丁寧な仕事と正確な工期管理に定評がある。",
  dailyRate: 28000,
  projects: 156,
};

const pastProjects = [
  {
    name: "山田邸リノベーション工事",
    period: "2025-10 ~ 現在",
    role: "棟梁",
    rating: 5.0,
    status: "in_progress",
  },
  {
    name: "鈴木マンション大規模修繕",
    period: "2025-06 ~ 2026-02",
    role: "棟梁",
    rating: 4.8,
    status: "completed",
  },
  {
    name: "田中邸増築工事",
    period: "2025-03 ~ 2025-05",
    role: "棟梁",
    rating: 4.9,
    status: "completed",
  },
  {
    name: "佐藤ビル内装改修",
    period: "2024-10 ~ 2025-02",
    role: "職長",
    rating: 4.7,
    status: "completed",
  },
  {
    name: "中村邸新築工事",
    period: "2024-04 ~ 2024-09",
    role: "棟梁",
    rating: 4.8,
    status: "completed",
  },
  {
    name: "小林商店改装工事",
    period: "2024-01 ~ 2024-03",
    role: "職長",
    rating: 4.6,
    status: "completed",
  },
];

const schedule = [
  { date: "2026-03-05", project: "山田邸リノベーション工事", task: "内装ボード貼り", status: "confirmed" },
  { date: "2026-03-06", project: "山田邸リノベーション工事", task: "内装ボード貼り", status: "confirmed" },
  { date: "2026-03-07", project: "山田邸リノベーション工事", task: "建具取付", status: "confirmed" },
  { date: "2026-03-10", project: "山田邸リノベーション工事", task: "建具取付", status: "tentative" },
  { date: "2026-03-11", project: "山田邸リノベーション工事", task: "造作家具", status: "tentative" },
  { date: "2026-03-12", project: "-", task: "-", status: "available" },
  { date: "2026-03-13", project: "-", task: "-", status: "available" },
];

const evaluations = [
  {
    project: "鈴木マンション大規模修繕",
    evaluator: "伊藤美咲",
    date: "2026-02-28",
    rating: 4.8,
    quality: 5,
    punctuality: 5,
    communication: 4,
    comment: "非常に丁寧な仕事で、工期も予定通り完了しました。コミュニケーションも良好です。",
  },
  {
    project: "田中邸増築工事",
    evaluator: "高橋健太",
    date: "2025-05-30",
    rating: 4.9,
    quality: 5,
    punctuality: 5,
    communication: 5,
    comment: "品質、スケジュール管理ともに素晴らしい。お客様からの評価も非常に高かった。",
  },
  {
    project: "佐藤ビル内装改修",
    evaluator: "鈴木一郎",
    date: "2025-02-15",
    rating: 4.7,
    quality: 5,
    punctuality: 4,
    communication: 5,
    comment: "仕上がりの品質は最高レベル。一部工程で遅れがあったが、リカバリーも迅速だった。",
  },
];

function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) {
  const iconSize = size === "lg" ? "h-5 w-5" : "h-3.5 w-3.5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${iconSize} ${
            star <= Math.round(rating)
              ? "fill-yellow-400 text-yellow-400"
              : "text-muted-foreground/30"
          }`}
        />
      ))}
      <span className={`font-medium ml-1 tabular-nums ${size === "lg" ? "text-base" : "text-xs"}`}>
        {rating}
      </span>
    </div>
  );
}

const scheduleStatusMap: Record<string, { label: string; color: string }> = {
  confirmed: { label: "確定", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  tentative: { label: "仮", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  available: { label: "空き", color: "bg-muted text-muted-foreground" },
};

export default function CraftsmanDetailPage() {
  const { id } = useParams();
  const data = craftsmanData;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Back link */}
      <Link
        href="/craftsmen"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        職人一覧に戻る
      </Link>

      {/* Profile Header */}
      <Card>
        <CardContent className="py-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-2xl font-semibold text-primary">{data.name.charAt(0)}</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-semibold">{data.name}</h1>
                <Badge variant="secondary">{data.specialty}</Badge>
                <Badge className="border-0 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  対応可
                </Badge>
              </div>
              <div className="mt-1">
                <StarRating rating={data.rating} size="lg" />
              </div>
              <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> {data.phone}
                </span>
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" /> {data.email}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {data.area}
                </span>
              </div>
            </div>
            <Link href={`/craftsmen/${id}/edit`}>
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
                <Edit className="h-4 w-4" />
                編集
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">プロフィール</TabsTrigger>
          <TabsTrigger value="projects">実績</TabsTrigger>
          <TabsTrigger value="schedule">スケジュール</TabsTrigger>
          <TabsTrigger value="evaluations">評価</TabsTrigger>
        </TabsList>

        {/* Profile */}
        <TabsContent value="profile" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">基本情報</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">職人ID</dt>
                    <dd className="font-medium">{id as string}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">専門分野</dt>
                    <dd className="font-medium">{data.specialty}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">経験年数</dt>
                    <dd className="font-medium">{data.experience}年</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">日当</dt>
                    <dd className="font-medium tabular-nums">
                      {new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(
                        data.dailyRate
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">累計実績</dt>
                    <dd className="font-medium">{data.projects}件</dd>
                  </div>
                  <div className="flex justify-between items-start">
                    <dt className="text-muted-foreground">住所</dt>
                    <dd className="font-medium text-right max-w-[200px]">{data.address}</dd>
                  </div>
                </dl>
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-muted-foreground mb-1">得意分野</p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.subSpecialties.map((s, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t">
                  <p className="text-sm text-muted-foreground">{data.bio}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                  <Award className="h-4 w-4" />
                  保有資格
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.certifications.map((cert, i) => (
                    <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
                      <Award className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm font-medium">{cert}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Past Projects */}
        <TabsContent value="projects" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                <Briefcase className="h-4 w-4" />
                工事実績一覧
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>工事名</TableHead>
                    <TableHead>期間</TableHead>
                    <TableHead>役割</TableHead>
                    <TableHead>評価</TableHead>
                    <TableHead>ステータス</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pastProjects.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-sm tabular-nums">{p.period}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {p.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <StarRating rating={p.rating} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={p.status} />
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
              <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                今後のスケジュール
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>日付</TableHead>
                    <TableHead>現場</TableHead>
                    <TableHead>作業内容</TableHead>
                    <TableHead>状況</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedule.map((s, i) => {
                    const st = scheduleStatusMap[s.status];
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium tabular-nums">{s.date}</TableCell>
                        <TableCell className="text-sm">
                          {s.project === "-" ? (
                            <span className="text-muted-foreground">-</span>
                          ) : (
                            s.project
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {s.task === "-" ? (
                            <span className="text-muted-foreground">-</span>
                          ) : (
                            s.task
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs border-0 ${st.color}`}>{st.label}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Evaluations */}
        <TabsContent value="evaluations" className="mt-4">
          <div className="space-y-4">
            {evaluations.map((ev, i) => (
              <Card key={i}>
                <CardContent className="py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                    <div>
                      <p className="font-medium text-sm">{ev.project}</p>
                      <p className="text-xs text-muted-foreground">
                        評価者: {ev.evaluator} | {ev.date}
                      </p>
                    </div>
                    <StarRating rating={ev.rating} />
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="text-center p-2 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">品質</p>
                      <p className="text-sm font-semibold tabular-nums">{ev.quality}/5</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">工期遵守</p>
                      <p className="text-sm font-semibold tabular-nums">{ev.punctuality}/5</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">連携</p>
                      <p className="text-sm font-semibold tabular-nums">{ev.communication}/5</p>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground">{ev.comment}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
