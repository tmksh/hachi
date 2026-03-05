"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Mail, Send, MousePointerClick, Eye, UserMinus, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const campaigns = [
  {
    id: "camp-001",
    name: "春のリフォームキャンペーン",
    date: "2026-03-01",
    target: 1250,
    openRate: 32.5,
    clickRate: 8.2,
    status: "配信済み",
  },
  {
    id: "camp-002",
    name: "完成見学会のご案内",
    date: "2026-02-20",
    target: 890,
    openRate: 41.2,
    clickRate: 12.8,
    status: "配信済み",
  },
  {
    id: "camp-003",
    name: "年末年始のご挨拶",
    date: "2025-12-25",
    target: 2100,
    openRate: 28.7,
    clickRate: 5.1,
    status: "配信済み",
  },
  {
    id: "camp-004",
    name: "施工事例紹介 Vol.15",
    date: "2026-02-10",
    target: 1580,
    openRate: 35.8,
    clickRate: 9.4,
    status: "配信済み",
  },
  {
    id: "camp-005",
    name: "防災リフォーム特集",
    date: "2026-03-10",
    target: 1400,
    openRate: 0,
    clickRate: 0,
    status: "予約済み",
  },
  {
    id: "camp-006",
    name: "新築プラン紹介メール",
    date: "2026-03-15",
    target: 980,
    openRate: 0,
    clickRate: 0,
    status: "下書き",
  },
  {
    id: "camp-007",
    name: "お客様アンケートのお願い",
    date: "2026-01-15",
    target: 750,
    openRate: 45.3,
    clickRate: 22.1,
    status: "配信済み",
  },
  {
    id: "camp-008",
    name: "夏季休業のご案内",
    date: "2026-03-20",
    target: 2200,
    openRate: 0,
    clickRate: 0,
    status: "下書き",
  },
];

function getStatusColor(status: string) {
  switch (status) {
    case "配信済み":
      return "bg-green-100 text-green-800";
    case "予約済み":
      return "bg-blue-100 text-blue-800";
    case "下書き":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export default function MarketingEmailPage() {
  const router = useRouter();

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title="メール配信"
        description="メールキャンペーンの管理と配信状況"
      >
        <Link href="/marketing/email/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            新規キャンペーン
          </Button>
        </Link>
      </PageHeader>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "配信数",
            value: "6,570",
            sub: "今月: 1,250",
            icon: Send,
          },
          {
            label: "開封率",
            value: "34.7%",
            sub: "業界平均: 25%",
            icon: Eye,
          },
          {
            label: "クリック率",
            value: "9.8%",
            sub: "業界平均: 5%",
            icon: MousePointerClick,
          },
          {
            label: "配信停止率",
            value: "0.8%",
            sub: "前月: 1.1%",
            icon: UserMinus,
          },
        ].map((stat, i) => (
          <Card key={i}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{stat.label}</span>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xl font-semibold tabular-nums">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Campaign Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            キャンペーン一覧
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>キャンペーン名</TableHead>
                <TableHead>配信日</TableHead>
                <TableHead className="text-right">対象数</TableHead>
                <TableHead className="text-right">開封率</TableHead>
                <TableHead className="text-right">クリック率</TableHead>
                <TableHead>ステータス</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign, i) => (
                <TableRow key={i} className="cursor-pointer hover:bg-accent/50" onClick={() => router.push(`/marketing/email/${campaign.id}`)}>
                  <TableCell className="font-medium">{campaign.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {campaign.date}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {campaign.target.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {campaign.openRate > 0 ? `${campaign.openRate}%` : "-"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {campaign.clickRate > 0 ? `${campaign.clickRate}%` : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={`text-xs border-0 ${getStatusColor(campaign.status)}`}
                    >
                      {campaign.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
