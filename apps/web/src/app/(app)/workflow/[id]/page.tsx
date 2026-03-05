"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Check,
  X,
  FileText,
  Paperclip,
  Download,
  User,
  Send,
} from "lucide-react";

const mockDetail = {
  id: "wf-001",
  number: "WF-2026-0042",
  type: "経費",
  status: "pending" as const,
  subject: "出張旅費精算（大阪現場視察）",
  applicant: "田中太郎",
  department: "工事部",
  date: "2026-03-04",
  amount: 45800,
  description:
    "3月1日〜3月2日の大阪現場視察に伴う出張旅費を精算いたします。新幹線代（往復）、宿泊費、現地交通費が含まれます。現場の進捗確認および施主様との打ち合わせを実施しました。",
  details: [
    { label: "新幹線代（往復）", amount: 28000 },
    { label: "宿泊費（1泊）", amount: 12000 },
    { label: "現地タクシー代", amount: 3800 },
    { label: "日当", amount: 2000 },
  ],
  attachments: [
    { name: "新幹線領収書.pdf", size: "245KB" },
    { name: "ホテル領収書.pdf", size: "180KB" },
    { name: "タクシー領収書.jpg", size: "1.2MB" },
  ],
  approvalFlow: [
    { name: "田中太郎", role: "申請者", status: "completed", date: "2026-03-04 09:30" },
    { name: "鈴木部長", role: "部門長承認", status: "current", date: null },
    { name: "山田取締役", role: "役員承認", status: "waiting", date: null },
    { name: "経理部", role: "経理確認", status: "waiting", date: null },
  ],
  comments: [
    {
      author: "田中太郎",
      date: "2026-03-04 09:30",
      text: "大阪現場視察の旅費精算です。領収書を添付しております。ご確認をお願いいたします。",
    },
  ],
};

export default function WorkflowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [comment, setComment] = useState("");

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/workflow">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            戻る
          </Button>
        </Link>
      </div>

      <PageHeader
        title={mockDetail.subject}
        description={`${mockDetail.number} | ${mockDetail.type}申請`}
      >
        <StatusBadge status={mockDetail.status} />
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">申請情報</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">申請者</p>
                  <p className="font-medium mt-0.5">{mockDetail.applicant}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">所属部門</p>
                  <p className="font-medium mt-0.5">{mockDetail.department}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">申請日</p>
                  <p className="font-medium mt-0.5">{mockDetail.date}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">合計金額</p>
                  <p className="font-medium mt-0.5 text-lg">¥{mockDetail.amount.toLocaleString()}</p>
                </div>
              </div>
              <Separator className="my-4" />
              <div>
                <p className="text-muted-foreground text-xs mb-1">説明</p>
                <p className="text-sm leading-relaxed">{mockDetail.description}</p>
              </div>
              <Separator className="my-4" />
              <div>
                <p className="text-muted-foreground text-xs mb-2">明細</p>
                <div className="space-y-2">
                  {mockDetail.details.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span>{d.label}</span>
                      <span className="tabular-nums font-medium">¥{d.amount.toLocaleString()}</span>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span>合計</span>
                    <span className="tabular-nums">¥{mockDetail.amount.toLocaleString()}</span>
                  </div>
                </div>
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
              <CardTitle className="text-sm font-medium">コメント</CardTitle>
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
              <div className="space-y-3">
                <Textarea
                  placeholder="コメントを入力..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                />
                <div className="flex items-center justify-between">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Send className="h-3.5 w-3.5" />
                    コメント送信
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => { toast.success("差戻しました"); router.push("/workflow"); }}>
                      <X className="h-3.5 w-3.5" />
                      差戻す
                    </Button>
                    <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700" onClick={() => { toast.success("承認しました"); router.push("/workflow"); }}>
                      <Check className="h-3.5 w-3.5" />
                      承認する
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Approval Flow */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">承認フロー</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                {mockDetail.approvalFlow.map((step, i) => (
                  <div key={i} className="flex gap-3 pb-6 last:pb-0">
                    {/* Vertical line */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 border-2 ${
                          step.status === "completed"
                            ? "bg-green-100 border-green-500 text-green-700"
                            : step.status === "current"
                            ? "bg-yellow-100 border-yellow-500 text-yellow-700 ring-4 ring-yellow-100"
                            : "bg-gray-100 border-gray-300 text-gray-400"
                        }`}
                      >
                        {step.status === "completed" ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <span className="text-xs font-medium">{i + 1}</span>
                        )}
                      </div>
                      {i < mockDetail.approvalFlow.length - 1 && (
                        <div
                          className={`w-0.5 flex-1 mt-1 ${
                            step.status === "completed" ? "bg-green-300" : "bg-gray-200"
                          }`}
                        />
                      )}
                    </div>
                    <div className="pt-1">
                      <p className="text-sm font-medium">{step.name}</p>
                      <p className="text-xs text-muted-foreground">{step.role}</p>
                      {step.date && (
                        <p className="text-xs text-muted-foreground mt-0.5">{step.date}</p>
                      )}
                      {step.status === "current" && (
                        <Badge className="mt-1 text-[10px] bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                          対応中
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Meta info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">申請メタ情報</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">申請番号</p>
                <p className="font-mono text-xs mt-0.5">{mockDetail.number}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">申請種別</p>
                <p className="mt-0.5">{mockDetail.type}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">申請ID</p>
                <p className="font-mono text-xs mt-0.5">{params.id}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
