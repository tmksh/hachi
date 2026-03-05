"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  MapPin,
  Edit,
  User,
  Calendar,
  MessageSquare,
  FileText,
  Clock,
} from "lucide-react";

const customerData: Record<string, {
  id: string;
  name: string;
  company: string;
  type: string;
  phone: string;
  email: string;
  address: string;
  postalCode: string;
  status: string;
  registeredDate: string;
  representative: string;
  notes: string;
}> = {
  "1": {
    id: "1",
    name: "田中 太郎",
    company: "田中建設株式会社",
    type: "法人",
    phone: "03-1234-5678",
    email: "tanaka@tanaken.co.jp",
    address: "東京都新宿区西新宿1-1-1 新宿ビル5F",
    postalCode: "160-0023",
    status: "active",
    registeredDate: "2024-06-15",
    representative: "田中 太郎",
    notes: "大規模マンションリフォームに興味あり。年間予算は約5,000万円。",
  },
};

const defaultCustomer = {
  id: "0",
  name: "田中 太郎",
  company: "田中建設株式会社",
  type: "法人",
  phone: "03-1234-5678",
  email: "tanaka@tanaken.co.jp",
  address: "東京都新宿区西新宿1-1-1 新宿ビル5F",
  postalCode: "160-0023",
  status: "active",
  registeredDate: "2024-06-15",
  representative: "田中 太郎",
  notes: "大規模マンションリフォームに興味あり。年間予算は約5,000万円。",
};

const dealHistory = [
  {
    id: "D-001",
    title: "新宿オフィスビル改修工事",
    amount: 12500000,
    status: "completed",
    date: "2025-08-15",
  },
  {
    id: "D-002",
    title: "渋谷マンション外壁塗装",
    amount: 4800000,
    status: "in_progress",
    date: "2026-01-20",
  },
  {
    id: "D-003",
    title: "品川倉庫リフォーム",
    amount: 8200000,
    status: "pending",
    date: "2026-02-28",
  },
];

const quotesContracts = [
  {
    id: "Q-2026-001",
    title: "渋谷マンション外壁塗装 見積",
    type: "見積",
    amount: 4800000,
    status: "approved",
    date: "2026-01-10",
  },
  {
    id: "Q-2026-005",
    title: "品川倉庫リフォーム 見積",
    type: "見積",
    amount: 8200000,
    status: "submitted",
    date: "2026-02-20",
  },
  {
    id: "C-2025-012",
    title: "新宿オフィスビル改修工事 契約",
    type: "契約",
    amount: 12500000,
    status: "completed",
    date: "2025-08-01",
  },
];

const activityNotes = [
  {
    id: "1",
    date: "2026-03-03",
    time: "14:30",
    user: "佐々木 営業",
    type: "電話",
    content: "品川倉庫リフォームの件で進捗確認。来週中に社内稟議を通す予定とのこと。",
  },
  {
    id: "2",
    date: "2026-02-28",
    time: "10:00",
    user: "佐々木 営業",
    type: "訪問",
    content: "品川倉庫の現地調査を実施。図面を受領し、見積作成に着手。",
  },
  {
    id: "3",
    date: "2026-02-20",
    time: "16:00",
    user: "佐々木 営業",
    type: "メール",
    content: "品川倉庫リフォームの見積書を送付。",
  },
  {
    id: "4",
    date: "2026-01-20",
    time: "11:00",
    user: "佐々木 営業",
    type: "訪問",
    content: "渋谷マンション外壁塗装の契約締結。着工日は2月上旬で合意。",
  },
  {
    id: "5",
    date: "2025-12-15",
    time: "13:00",
    user: "山本 課長",
    type: "会議",
    content: "年末のご挨拶を兼ねて訪問。来年度の改修計画についてヒアリング。",
  },
];

const activityTypeColors: Record<string, string> = {
  電話: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  訪問: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  メール: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  会議: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
};

export default function CrmDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const customer = customerData[id] ?? { ...defaultCustomer, id };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/crm">
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <PageHeader title="顧客詳細" description={customer.company || customer.name}>
          <Link href={`/crm/${id}/edit`}>
            <Button variant="outline" size="sm">
              <Edit className="size-4 mr-1" />
              編集
            </Button>
          </Link>
        </PageHeader>
      </div>

      {/* Customer Info Card */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            <div className="flex items-center gap-4">
              <div className="size-16 rounded-full bg-muted flex items-center justify-center">
                <User className="size-8 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{customer.name}</h2>
                {customer.company && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Building2 className="size-3.5" />
                    {customer.company}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline">{customer.type}</Badge>
                  <StatusBadge status={customer.status} />
                </div>
              </div>
            </div>
            <Separator orientation="vertical" className="hidden md:block h-20" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="size-4" />
                <span>{customer.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="size-4" />
                <span>{customer.email}</span>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground sm:col-span-2">
                <MapPin className="size-4 mt-0.5" />
                <span>〒{customer.postalCode} {customer.address}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="size-4" />
                <span>登録日: {customer.registeredDate}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="basic">
        <TabsList>
          <TabsTrigger value="basic">基本情報</TabsTrigger>
          <TabsTrigger value="deals">商談履歴</TabsTrigger>
          <TabsTrigger value="quotes">見積・契約</TabsTrigger>
          <TabsTrigger value="activities">活動メモ</TabsTrigger>
        </TabsList>

        {/* 基本情報 */}
        <TabsContent value="basic" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">基本情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">担当者名</p>
                  <p className="font-medium">{customer.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">代表者</p>
                  <p className="font-medium">{customer.representative}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">電話番号</p>
                  <p className="font-medium">{customer.phone}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">メールアドレス</p>
                  <p className="font-medium">{customer.email}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-muted-foreground mb-1">住所</p>
                  <p className="font-medium">〒{customer.postalCode} {customer.address}</p>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground mb-1 text-sm">メモ</p>
                <p className="text-sm">{customer.notes}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 商談履歴 */}
        <TabsContent value="deals" className="mt-4 space-y-4">
          {dealHistory.map((deal) => (
            <Card key={deal.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-muted-foreground font-mono">{deal.id}</span>
                    <StatusBadge status={deal.status} />
                  </div>
                  <p className="font-medium">{deal.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{deal.date}</p>
                </div>
                <p className="text-lg font-semibold">
                  {deal.amount.toLocaleString()}円
                </p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* 見積・契約 */}
        <TabsContent value="quotes" className="mt-4 space-y-4">
          {quotesContracts.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-muted-foreground font-mono">{item.id}</span>
                    <Badge variant="outline" className="text-xs">{item.type}</Badge>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{item.date}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold">
                    {item.amount.toLocaleString()}円
                  </p>
                  <Link href={item.type === "見積" ? `/quotes/${item.id}` : "#"}>
                    <Button variant="ghost" size="sm" className="mt-1">
                      <FileText className="size-3.5 mr-1" />
                      詳細
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* 活動メモ */}
        <TabsContent value="activities" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="size-4" />
                活動履歴
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative pl-6 space-y-6">
                {/* Timeline line */}
                <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />
                {activityNotes.map((note) => (
                  <div key={note.id} className="relative">
                    {/* Timeline dot */}
                    <div className="absolute -left-6 top-1.5 size-[7px] rounded-full bg-foreground ring-2 ring-background" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="secondary"
                          className={`text-xs border-0 ${activityTypeColors[note.type] ?? ""}`}
                        >
                          {note.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="size-3" />
                          {note.date} {note.time}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {note.user}
                        </span>
                      </div>
                      <p className="text-sm">{note.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
