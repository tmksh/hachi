"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Bell,
  User,
  Check,
  Clock,
  FileText,
  Download,
  Paperclip,
  Send,
  Eye,
} from "lucide-react";

const mockDetail = {
  id: "cr-001",
  title: "安全大会開催のお知らせ（4月度）",
  creator: "山田花子",
  department: "総務部",
  date: "2026-03-05 10:00",
  category: "お知らせ",
  isRead: false,
  content: `各位

お疲れ様です。総務部の山田です。

4月度の安全大会を下記の通り開催いたします。
建設現場における安全意識の向上と、労働災害防止を目的として実施するものです。
全社員のご参加をお願いいたします。

■ 日時
2026年4月5日（土）13:00 〜 16:00

■ 場所
本社 3階 大会議室

■ プログラム
1. 開会挨拶（代表取締役）
2. 安全方針の説明（安全管理部長）
3. 前年度事故事例の振り返り
4. グループディスカッション「安全な職場づくり」
5. 安全宣言
6. 閉会挨拶

■ 持ち物
・筆記用具
・安全大会資料（当日配布）

■ 注意事項
・やむを得ず欠席される場合は、3月28日までに各部門長へご連絡ください。
・現場作業中の方は、現場代理人と調整の上ご出席ください。

ご不明な点がございましたら、総務部 山田までお問い合わせください。

以上、よろしくお願いいたします。`,
  attachments: [
    { name: "安全大会プログラム.pdf", size: "520KB" },
    { name: "前年度安全実績.xlsx", size: "1.1MB" },
  ],
  readers: [
    { name: "田中太郎", department: "工事部", readAt: "2026-03-05 10:15", isRead: true },
    { name: "鈴木花子", department: "営業部", readAt: "2026-03-05 10:30", isRead: true },
    { name: "佐藤一郎", department: "工事部", readAt: "2026-03-05 11:00", isRead: true },
    { name: "高橋美咲", department: "経理部", readAt: "2026-03-05 11:45", isRead: true },
    { name: "伊藤大輔", department: "人事部", readAt: null, isRead: false },
    { name: "渡辺裕子", department: "情報システム部", readAt: null, isRead: false },
    { name: "中村誠", department: "工事部", readAt: null, isRead: false },
    { name: "小林直樹", department: "総務部", readAt: null, isRead: false },
  ],
  comments: [
    {
      author: "田中太郎",
      date: "2026-03-05 10:20",
      text: "承知しました。工事部は全員参加予定です。",
    },
    {
      author: "佐藤一郎",
      date: "2026-03-05 11:05",
      text: "B現場の作業員については、現場代理人と調整中です。改めてご連絡いたします。",
    },
  ],
};

export default function CirculationDetailPage() {
  const params = useParams();
  const [comment, setComment] = useState("");
  const [isRead, setIsRead] = useState(mockDetail.isRead);

  const readCount = mockDetail.readers.filter((r) => r.isRead).length;
  const totalCount = mockDetail.readers.length;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/circulation">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            戻る
          </Button>
        </Link>
      </div>

      <PageHeader title={mockDetail.title}>
        <Badge variant="secondary" className="bg-blue-100 text-blue-800 gap-1">
          <Bell className="h-3.5 w-3.5" />
          {mockDetail.category}
        </Badge>
        {!isRead && (
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => { setIsRead(true); toast.success("既読にしました"); }}
          >
            <Eye className="h-4 w-4" />
            既読にする
          </Button>
        )}
        {isRead && (
          <Badge variant="secondary" className="bg-green-100 text-green-800 gap-1">
            <Check className="h-3.5 w-3.5" />
            既読
          </Badge>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Meta info */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{mockDetail.creator}</p>
                    <p className="text-xs text-muted-foreground">{mockDetail.department}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                  <Clock className="h-3.5 w-3.5" />
                  {mockDetail.date}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Content */}
          <Card>
            <CardContent className="py-6">
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {mockDetail.content}
              </div>
            </CardContent>
          </Card>

          {/* Attachments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                添付ファイル ({mockDetail.attachments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {mockDetail.attachments.map((file, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded-lg border hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{file.name}</span>
                      <span className="text-xs text-muted-foreground">({file.size})</span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Comments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">コメント ({mockDetail.comments.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {mockDetail.comments.map((c, i) => (
                <div key={i} className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{c.author}</span>
                      <span className="text-xs text-muted-foreground">{c.date}</span>
                    </div>
                    <p className="text-sm mt-1 text-muted-foreground">{c.text}</p>
                  </div>
                </div>
              ))}
              <Separator />
              <div className="flex gap-3">
                <Textarea
                  placeholder="コメントを入力..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                  className="flex-1"
                />
                <Button size="sm" className="gap-1.5 self-end">
                  <Send className="h-3.5 w-3.5" />
                  送信
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Read status */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span>閲覧状況</span>
                <span className="text-xs text-muted-foreground font-normal">
                  {readCount}/{totalCount} 既読
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Progress bar */}
              <div className="mb-4">
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${(readCount / totalCount) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1 text-center">
                  {Math.round((readCount / totalCount) * 100)}% 閲覧済み
                </p>
              </div>

              <div className="space-y-1">
                {mockDetail.readers.map((reader, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-2 rounded-lg text-sm"
                  >
                    <div
                      className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${
                        reader.isRead
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {reader.isRead ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Clock className="h-3 w-3" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">{reader.name}</p>
                      <p className="text-[10px] text-muted-foreground">{reader.department}</p>
                    </div>
                    {reader.readAt && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {reader.readAt.split(" ")[1]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
