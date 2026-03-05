"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Plus,
  Mail,
  MailOpen,
  Eye,
  Bell,
  FileText,
  MessageSquare,
  Share2,
  User,
} from "lucide-react";

type CirculationItem = {
  id: string;
  title: string;
  creator: string;
  date: string;
  category: "お知らせ" | "報告" | "依頼" | "共有";
  isRead: boolean;
  isOwn: boolean;
  excerpt: string;
  readCount: number;
  totalCount: number;
};

const categoryColors: Record<string, string> = {
  お知らせ: "bg-blue-100 text-blue-800",
  報告: "bg-green-100 text-green-800",
  依頼: "bg-orange-100 text-orange-800",
  共有: "bg-purple-100 text-purple-800",
};

const categoryIcons: Record<string, React.ReactNode> = {
  お知らせ: <Bell className="h-3.5 w-3.5" />,
  報告: <FileText className="h-3.5 w-3.5" />,
  依頼: <MessageSquare className="h-3.5 w-3.5" />,
  共有: <Share2 className="h-3.5 w-3.5" />,
};

const mockCirculations: CirculationItem[] = [
  {
    id: "cr-001",
    title: "安全大会開催のお知らせ（4月度）",
    creator: "総務部 山田花子",
    date: "2026-03-05",
    category: "お知らせ",
    isRead: false,
    isOwn: false,
    excerpt: "4月度の安全大会を下記の通り開催いたします。全社員のご参加をお願いいたします。",
    readCount: 12,
    totalCount: 45,
  },
  {
    id: "cr-002",
    title: "現場安全点検結果の共有（3月第1週）",
    creator: "工事部 佐藤一郎",
    date: "2026-03-04",
    category: "報告",
    isRead: false,
    isOwn: false,
    excerpt: "3月第1週の現場安全点検結果を報告いたします。指摘事項が2件ございます。",
    readCount: 8,
    totalCount: 20,
  },
  {
    id: "cr-003",
    title: "年度末棚卸し協力依頼",
    creator: "経理部 高橋美咲",
    date: "2026-03-03",
    category: "依頼",
    isRead: true,
    isOwn: false,
    excerpt: "年度末の棚卸し作業について、各部門のご協力をお願いいたします。",
    readCount: 30,
    totalCount: 45,
  },
  {
    id: "cr-004",
    title: "新入社員研修スケジュール",
    creator: "人事部 伊藤大輔",
    date: "2026-03-02",
    category: "共有",
    isRead: true,
    isOwn: false,
    excerpt: "4月入社の新入社員研修スケジュールを共有いたします。メンター担当の方はご確認ください。",
    readCount: 25,
    totalCount: 30,
  },
  {
    id: "cr-005",
    title: "社内システムメンテナンスのお知らせ",
    creator: "情報システム部 渡辺裕子",
    date: "2026-03-01",
    category: "お知らせ",
    isRead: true,
    isOwn: false,
    excerpt: "3月8日（土）にシステムメンテナンスを実施いたします。一部機能が利用できなくなります。",
    readCount: 40,
    totalCount: 45,
  },
  {
    id: "cr-006",
    title: "工事進捗報告（B現場）",
    creator: "工事部 中村誠",
    date: "2026-02-28",
    category: "報告",
    isRead: true,
    isOwn: false,
    excerpt: "B現場の2月度進捗報告です。工程通り順調に進んでおります。",
    readCount: 15,
    totalCount: 15,
  },
  {
    id: "cr-007",
    title: "健康診断の日程について",
    creator: "総務部 小林直樹",
    date: "2026-02-27",
    category: "お知らせ",
    isRead: true,
    isOwn: false,
    excerpt: "今年度の健康診断の日程が決まりましたのでお知らせいたします。",
    readCount: 42,
    totalCount: 45,
  },
  {
    id: "cr-008",
    title: "週次ミーティング議事録（2/24）",
    creator: "自分",
    date: "2026-02-24",
    category: "共有",
    isRead: true,
    isOwn: true,
    excerpt: "2月24日の週次ミーティングの議事録を共有いたします。",
    readCount: 10,
    totalCount: 12,
  },
  {
    id: "cr-009",
    title: "資材価格改定のお知らせ",
    creator: "自分",
    date: "2026-02-20",
    category: "お知らせ",
    isRead: true,
    isOwn: true,
    excerpt: "主要取引先から資材価格改定の通知がありましたので共有いたします。",
    readCount: 18,
    totalCount: 20,
  },
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "今日";
  if (days === 1) return "昨日";
  if (days < 7) return `${days}日前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function CirculationListPage() {
  const [activeTab, setActiveTab] = useState("unread");

  const unread = mockCirculations.filter((i) => !i.isRead && !i.isOwn);
  const read = mockCirculations.filter((i) => i.isRead && !i.isOwn);
  const own = mockCirculations.filter((i) => i.isOwn);

  const renderList = (items: CirculationItem[]) => (
    <div className="space-y-2">
      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            該当する回覧はありません
          </CardContent>
        </Card>
      ) : (
        items.map((item) => (
          <Link key={item.id} href={`/circulation/${item.id}`}>
            <Card className="transition-[box-shadow] duration-200 cursor-pointer">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {item.isRead ? (
                      <MailOpen className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Mail className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={`text-sm ${!item.isRead ? "font-semibold" : "font-medium"}`}>
                        {item.title}
                      </h3>
                      <Badge variant="secondary" className={`text-[10px] gap-1 ${categoryColors[item.category]}`}>
                        {categoryIcons[item.category]}
                        {item.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {item.excerpt}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        {item.creator}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(item.date)}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Eye className="h-3 w-3" />
                        {item.readCount}/{item.totalCount}
                      </div>
                    </div>
                  </div>
                  {!item.isRead && (
                    <div className="h-2.5 w-2.5 rounded-full bg-primary shrink-0 mt-2" />
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))
      )}
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="回覧" description="社内回覧の閲覧・作成を行います">
        <Link href="/circulation/new">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            新規回覧
          </Button>
        </Link>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="unread">
            未読
            {unread.length > 0 && (
              <Badge className="ml-1.5 h-5 min-w-5 px-1.5 text-[10px] bg-red-500 hover:bg-red-500 text-white">
                {unread.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="read">既読</TabsTrigger>
          <TabsTrigger value="own">自分が作成</TabsTrigger>
        </TabsList>

        <TabsContent value="unread">{renderList(unread)}</TabsContent>
        <TabsContent value="read">{renderList(read)}</TabsContent>
        <TabsContent value="own">{renderList(own)}</TabsContent>
      </Tabs>
    </div>
  );
}
