"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Image, Film, FileImage, Calendar } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

const creatives = [
  {
    title: "春のリフォームキャンペーン",
    type: "バナー",
    date: "2026-03-01",
    status: "公開中",
    color: "bg-blue-100",
  },
  {
    title: "完成見学会チラシ 3月号",
    type: "チラシ",
    date: "2026-02-28",
    status: "公開中",
    color: "bg-green-100",
  },
  {
    title: "施工事例紹介動画 Vol.8",
    type: "動画",
    date: "2026-02-25",
    status: "公開中",
    color: "bg-purple-100",
  },
  {
    title: "新築プラン紹介バナー",
    type: "バナー",
    date: "2026-02-20",
    status: "レビュー中",
    color: "bg-orange-100",
  },
  {
    title: "防災リフォーム特集チラシ",
    type: "チラシ",
    date: "2026-02-18",
    status: "下書き",
    color: "bg-yellow-100",
  },
  {
    title: "お客様インタビュー動画",
    type: "動画",
    date: "2026-02-15",
    status: "公開中",
    color: "bg-pink-100",
  },
  {
    title: "Instagram広告バナーセット",
    type: "バナー",
    date: "2026-02-12",
    status: "公開中",
    color: "bg-cyan-100",
  },
  {
    title: "会社紹介パンフレット",
    type: "チラシ",
    date: "2026-02-10",
    status: "レビュー中",
    color: "bg-emerald-100",
  },
  {
    title: "ルームツアー動画",
    type: "動画",
    date: "2026-02-05",
    status: "下書き",
    color: "bg-indigo-100",
  },
];

function getStatusColor(status: string) {
  switch (status) {
    case "公開中":
      return "bg-green-100 text-green-800";
    case "レビュー中":
      return "bg-yellow-100 text-yellow-800";
    case "下書き":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case "バナー":
      return <Image className="h-8 w-8 text-muted-foreground/50" />;
    case "チラシ":
      return <FileImage className="h-8 w-8 text-muted-foreground/50" />;
    case "動画":
      return <Film className="h-8 w-8 text-muted-foreground/50" />;
    default:
      return <Image className="h-8 w-8 text-muted-foreground/50" />;
  }
}

export default function MarketingCreativePage() {
  const [typeFilter, setTypeFilter] = useState("all");

  const filtered =
    typeFilter === "all"
      ? creatives
      : creatives.filter((c) => c.type === typeFilter);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title="クリエイティブ管理"
        description="マーケティング素材の管理"
      >
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            <SelectItem value="バナー">バナー</SelectItem>
            <SelectItem value="チラシ">チラシ</SelectItem>
            <SelectItem value="動画">動画</SelectItem>
          </SelectContent>
        </Select>
        <Link href="/marketing/creative/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            新規作成
          </Button>
        </Link>
      </PageHeader>

      {/* Creative Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((creative, i) => (
          <Card
            key={i}
            className="frost-card transition-[box-shadow] duration-200 cursor-pointer overflow-hidden"
            onClick={() =>
              toast.info(`${creative.title}`, {
                description: `種別: ${creative.type} / ステータス: ${creative.status} / 作成日: ${creative.date}`,
              })
            }
          >
            {/* Thumbnail Placeholder */}
            <div
              className={`h-40 ${creative.color} flex items-center justify-center`}
            >
              {getTypeIcon(creative.type)}
            </div>
            <CardContent className="pt-3 pb-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-sm font-medium leading-tight line-clamp-2">
                  {creative.title}
                </h3>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {creative.type}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className={`text-xs border-0 ${getStatusColor(creative.status)}`}
                  >
                    {creative.status}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {creative.date}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
