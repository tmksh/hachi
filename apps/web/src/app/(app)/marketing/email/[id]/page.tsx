"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { ArrowLeft, Send, Eye, MousePointerClick, UserMinus } from "lucide-react";
import Link from "next/link";
import { use } from "react";

const mockCampaigns: Record<
  string,
  {
    name: string;
    status: string;
    date: string;
    subject: string;
    sent: number;
    opened: number;
    clicked: number;
    unsubscribed: number;
  }
> = {
  "camp-001": {
    name: "春のリフォームキャンペーン",
    status: "配信済み",
    date: "2026-03-01",
    subject: "春のリフォームシーズン到来！お得なキャンペーンのお知らせ",
    sent: 1250,
    opened: 406,
    clicked: 103,
    unsubscribed: 5,
  },
  "camp-002": {
    name: "完成見学会のご案内",
    status: "配信済み",
    date: "2026-02-20",
    subject: "【ご招待】3月完成見学会のご案内",
    sent: 890,
    opened: 367,
    clicked: 114,
    unsubscribed: 3,
  },
  "camp-003": {
    name: "年末年始のご挨拶",
    status: "配信済み",
    date: "2025-12-25",
    subject: "年末年始のご挨拶と年始営業のお知らせ",
    sent: 2100,
    opened: 603,
    clicked: 107,
    unsubscribed: 8,
  },
  "camp-004": {
    name: "施工事例紹介 Vol.15",
    status: "配信済み",
    date: "2026-02-10",
    subject: "最新施工事例をお届けします - Vol.15",
    sent: 1580,
    opened: 566,
    clicked: 149,
    unsubscribed: 4,
  },
  "camp-005": {
    name: "防災リフォーム特集",
    status: "予約済み",
    date: "2026-03-10",
    subject: "大切な家族を守る防災リフォーム特集",
    sent: 0,
    opened: 0,
    clicked: 0,
    unsubscribed: 0,
  },
  "camp-006": {
    name: "新築プラン紹介メール",
    status: "下書き",
    date: "2026-03-15",
    subject: "2026年新築プランのご紹介",
    sent: 0,
    opened: 0,
    clicked: 0,
    unsubscribed: 0,
  },
  "camp-007": {
    name: "お客様アンケートのお願い",
    status: "配信済み",
    date: "2026-01-15",
    subject: "お客様アンケートへのご協力のお願い",
    sent: 750,
    opened: 340,
    clicked: 166,
    unsubscribed: 2,
  },
  "camp-008": {
    name: "夏季休業のご案内",
    status: "下書き",
    date: "2026-03-20",
    subject: "夏季休業期間のお知らせ",
    sent: 0,
    opened: 0,
    clicked: 0,
    unsubscribed: 0,
  },
};

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

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const campaign = mockCampaigns[id];

  if (!campaign) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <PageHeader title="キャンペーンが見つかりません" description="">
          <Link href="/marketing/email">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              戻る
            </Button>
          </Link>
        </PageHeader>
      </div>
    );
  }

  const openRate = campaign.sent > 0 ? ((campaign.opened / campaign.sent) * 100).toFixed(1) : "0";
  const clickRate = campaign.sent > 0 ? ((campaign.clicked / campaign.sent) * 100).toFixed(1) : "0";
  const unsubRate = campaign.sent > 0 ? ((campaign.unsubscribed / campaign.sent) * 100).toFixed(1) : "0";

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title={campaign.name}
        description={`件名: ${campaign.subject}`}
      >
        <Link href="/marketing/email">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            一覧に戻る
          </Button>
        </Link>
      </PageHeader>

      {/* Status & Date */}
      <div className="flex items-center gap-3">
        <Badge
          variant="secondary"
          className={`text-xs border-0 ${getStatusColor(campaign.status)}`}
        >
          {campaign.status}
        </Badge>
        <span className="text-sm text-muted-foreground">
          配信日: {campaign.date}
        </span>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "配信数",
            value: campaign.sent.toLocaleString(),
            icon: Send,
          },
          {
            label: "開封数",
            value: campaign.opened.toLocaleString(),
            sub: `開封率: ${openRate}%`,
            icon: Eye,
          },
          {
            label: "クリック数",
            value: campaign.clicked.toLocaleString(),
            sub: `クリック率: ${clickRate}%`,
            icon: MousePointerClick,
          },
          {
            label: "配信停止",
            value: campaign.unsubscribed.toLocaleString(),
            sub: `停止率: ${unsubRate}%`,
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
              {stat.sub && (
                <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detail Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">配信パフォーマンス</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {campaign.sent > 0 ? (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">開封率</span>
                    <span className="font-medium">{openRate}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${openRate}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">クリック率</span>
                    <span className="font-medium">{clickRate}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${Math.min(parseFloat(clickRate) * 3, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">配信停止率</span>
                    <span className="font-medium">{unsubRate}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-400 rounded-full"
                      style={{ width: `${Math.min(parseFloat(unsubRate) * 20, 100)}%` }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">まだ配信されていません</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">キャンペーン情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">キャンペーン名</span>
              <span className="font-medium">{campaign.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">件名</span>
              <span className="font-medium max-w-[60%] text-right">{campaign.subject}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">配信日</span>
              <span className="font-medium">{campaign.date}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">ステータス</span>
              <Badge
                variant="secondary"
                className={`text-xs border-0 ${getStatusColor(campaign.status)}`}
              >
                {campaign.status}
              </Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">対象者数</span>
              <span className="font-medium">{campaign.sent > 0 ? campaign.sent.toLocaleString() : "-"}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
