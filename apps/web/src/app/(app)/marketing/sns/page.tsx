"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, Heart, MessageCircle, Eye } from "lucide-react";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";

const platformData: Record<
  string,
  {
    followers: string;
    growth: string;
    engagement: string;
    reach: string;
    weeklyData: { day: string; エンゲージメント: number }[];
    posts: { title: string; date: string; impressions: string; likes: number }[];
  }
> = {
  instagram: {
    followers: "4,520",
    growth: "+128",
    engagement: "4.8%",
    reach: "12,300",
    weeklyData: [
      { day: "月", エンゲージメント: 320 },
      { day: "火", エンゲージメント: 450 },
      { day: "水", エンゲージメント: 280 },
      { day: "木", エンゲージメント: 510 },
      { day: "金", エンゲージメント: 620 },
      { day: "土", エンゲージメント: 780 },
      { day: "日", エンゲージメント: 540 },
    ],
    posts: [
      { title: "施工事例: 木造住宅リノベーション", date: "2026-03-03", impressions: "2,340", likes: 187 },
      { title: "現場レポート: 基礎工事の様子", date: "2026-03-01", impressions: "1,890", likes: 142 },
      { title: "完成見学会のお知らせ", date: "2026-02-27", impressions: "3,120", likes: 256 },
      { title: "職人紹介シリーズ #5", date: "2026-02-25", impressions: "1,560", likes: 198 },
      { title: "Before/After: キッチンリフォーム", date: "2026-02-22", impressions: "4,210", likes: 342 },
    ],
  },
  line: {
    followers: "8,920",
    growth: "+256",
    engagement: "12.3%",
    reach: "7,800",
    weeklyData: [
      { day: "月", エンゲージメント: 180 },
      { day: "火", エンゲージメント: 220 },
      { day: "水", エンゲージメント: 150 },
      { day: "木", エンゲージメント: 340 },
      { day: "金", エンゲージメント: 290 },
      { day: "土", エンゲージメント: 420 },
      { day: "日", エンゲージメント: 380 },
    ],
    posts: [
      { title: "春のリフォーム相談会", date: "2026-03-02", impressions: "5,600", likes: 890 },
      { title: "お得なキャンペーン情報", date: "2026-02-28", impressions: "4,200", likes: 720 },
      { title: "施工豆知識 Vol.12", date: "2026-02-25", impressions: "3,800", likes: 540 },
      { title: "お客様の声紹介", date: "2026-02-20", impressions: "2,900", likes: 410 },
    ],
  },
  youtube: {
    followers: "1,280",
    growth: "+45",
    engagement: "6.2%",
    reach: "18,500",
    weeklyData: [
      { day: "月", エンゲージメント: 85 },
      { day: "火", エンゲージメント: 120 },
      { day: "水", エンゲージメント: 95 },
      { day: "木", エンゲージメント: 140 },
      { day: "金", エンゲージメント: 110 },
      { day: "土", エンゲージメント: 230 },
      { day: "日", エンゲージメント: 190 },
    ],
    posts: [
      { title: "【ルームツアー】築50年リノベーション", date: "2026-03-01", impressions: "8,900", likes: 420 },
      { title: "プロが教えるDIYの基本", date: "2026-02-22", impressions: "12,300", likes: 680 },
      { title: "注文住宅ができるまで密着", date: "2026-02-15", impressions: "6,700", likes: 350 },
    ],
  },
};

export default function MarketingSnsPage() {
  const [platform, setPlatform] = useState("instagram");
  const data = platformData[platform];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title="SNSインサイト"
        description="SNSプラットフォームの分析データ"
      />

      <Tabs value={platform} onValueChange={setPlatform}>
        <TabsList>
          <TabsTrigger value="instagram">Instagram</TabsTrigger>
          <TabsTrigger value="line">LINE</TabsTrigger>
          <TabsTrigger value="youtube">YouTube</TabsTrigger>
        </TabsList>

        <TabsContent value={platform} className="space-y-6 mt-4">
          {/* Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "フォロワー数", value: data.followers, icon: Users },
              { label: "増加数（今月）", value: data.growth, icon: TrendingUp },
              { label: "エンゲージメント率", value: data.engagement, icon: Heart },
              { label: "リーチ数", value: data.reach, icon: Eye },
            ].map((metric, i) => (
              <Card key={i}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">
                      {metric.label}
                    </span>
                    <metric.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-xl font-semibold tabular-nums">
                    {metric.value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Weekly Engagement Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  週間エンゲージメント
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data.weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="エンゲージメント"
                      fill="#2563eb"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Recent Posts */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">最近の投稿</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.posts.map((post, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-2 rounded-lg hover:bg-accent transition-colors cursor-pointer"
                      onClick={() =>
                        toast.info(`${post.title}`, {
                          description: `投稿日: ${post.date} / インプレッション: ${post.impressions} / いいね: ${post.likes}`,
                        })
                      }
                    >
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <MessageCircle className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {post.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {post.date}
                        </p>
                      </div>
                      <div className="text-right shrink-0 space-y-0.5">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Eye className="h-3 w-3" />
                          {post.impressions}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Heart className="h-3 w-3" />
                          {post.likes}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
