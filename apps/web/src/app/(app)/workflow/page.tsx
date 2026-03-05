"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Check,
  X,
  FileText,
  Plane,
  ShoppingCart,
  MoreHorizontal,
  Eye,
} from "lucide-react";

type WorkflowItem = {
  id: string;
  number: string;
  type: "経費" | "休暇" | "購入" | "その他";
  applicant: string;
  subject: string;
  amount: number | null;
  date: string;
  status: "pending" | "submitted" | "approved" | "rejected";
};

const mockWorkflows: WorkflowItem[] = [
  {
    id: "wf-001",
    number: "WF-2026-0042",
    type: "経費",
    applicant: "田中太郎",
    subject: "出張旅費精算（大阪現場視察）",
    amount: 45800,
    date: "2026-03-04",
    status: "pending",
  },
  {
    id: "wf-002",
    number: "WF-2026-0041",
    type: "購入",
    applicant: "鈴木花子",
    subject: "安全装備一式購入申請",
    amount: 128000,
    date: "2026-03-03",
    status: "pending",
  },
  {
    id: "wf-003",
    number: "WF-2026-0040",
    type: "休暇",
    applicant: "佐藤一郎",
    subject: "有給休暇申請（3/10-3/12）",
    amount: null,
    date: "2026-03-03",
    status: "pending",
  },
  {
    id: "wf-004",
    number: "WF-2026-0039",
    type: "経費",
    applicant: "山田健二",
    subject: "接待交際費精算",
    amount: 32500,
    date: "2026-03-02",
    status: "submitted",
  },
  {
    id: "wf-005",
    number: "WF-2026-0038",
    type: "その他",
    applicant: "高橋美咲",
    subject: "社用車利用申請",
    amount: null,
    date: "2026-03-01",
    status: "submitted",
  },
  {
    id: "wf-006",
    number: "WF-2026-0037",
    type: "購入",
    applicant: "伊藤大輔",
    subject: "建設資材追加発注申請",
    amount: 356000,
    date: "2026-02-28",
    status: "approved",
  },
  {
    id: "wf-007",
    number: "WF-2026-0036",
    type: "経費",
    applicant: "渡辺裕子",
    subject: "研修参加費用精算",
    amount: 55000,
    date: "2026-02-27",
    status: "approved",
  },
  {
    id: "wf-008",
    number: "WF-2026-0035",
    type: "休暇",
    applicant: "中村誠",
    subject: "特別休暇申請（慶弔）",
    amount: null,
    date: "2026-02-26",
    status: "approved",
  },
  {
    id: "wf-009",
    number: "WF-2026-0034",
    type: "経費",
    applicant: "小林直樹",
    subject: "現場消耗品購入精算",
    amount: 18700,
    date: "2026-02-25",
    status: "rejected",
  },
  {
    id: "wf-010",
    number: "WF-2026-0033",
    type: "購入",
    applicant: "加藤恵",
    subject: "事務用品購入申請",
    amount: 24300,
    date: "2026-02-24",
    status: "rejected",
  },
];

const typeIcons: Record<string, React.ReactNode> = {
  経費: <FileText className="h-4 w-4" />,
  休暇: <Plane className="h-4 w-4" />,
  購入: <ShoppingCart className="h-4 w-4" />,
  その他: <MoreHorizontal className="h-4 w-4" />,
};

const typeColors: Record<string, string> = {
  経費: "bg-blue-100 text-blue-800",
  休暇: "bg-green-100 text-green-800",
  購入: "bg-orange-100 text-orange-800",
  その他: "bg-gray-100 text-gray-800",
};

function formatAmount(amount: number | null): string {
  if (amount === null) return "-";
  return `¥${amount.toLocaleString()}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function WorkflowListPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("pending");

  const filteredItems = (status: string) =>
    mockWorkflows.filter((item) => item.status === status);

  const pendingCount = filteredItems("pending").length;
  const submittedCount = filteredItems("submitted").length;

  const renderTable = (items: WorkflowItem[], showActions: boolean) => (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>申請番号</TableHead>
              <TableHead>種別</TableHead>
              <TableHead>申請者</TableHead>
              <TableHead>件名</TableHead>
              <TableHead className="text-right">金額</TableHead>
              <TableHead>申請日</TableHead>
              <TableHead>ステータス</TableHead>
              {showActions && <TableHead className="text-center">操作</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showActions ? 8 : 7} className="text-center text-muted-foreground py-8">
                  該当する申請はありません
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id} className="cursor-pointer" onClick={() => router.push(`/workflow/${item.id}`)}>
                  <TableCell>
                    <Link href={`/workflow/${item.id}`} className="text-primary hover:underline font-medium text-xs">
                      {item.number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={`text-xs gap-1 ${typeColors[item.type]}`}>
                      {typeIcons[item.type]}
                      {item.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{item.applicant}</TableCell>
                  <TableCell>
                    <Link href={`/workflow/${item.id}`} className="text-sm hover:underline">
                      {item.subject}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatAmount(item.amount)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(item.date)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                  {showActions && (
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={(e) => { e.stopPropagation(); toast.success("承認しました"); }}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); toast.success("差戻しました"); }}>
                          <X className="h-4 w-4" />
                        </Button>
                        <Link href={`/workflow/${item.id}`}>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="ワークフロー" description="申請の作成・承認を管理します">
        <Link href="/workflow/new">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            新規申請
          </Button>
        </Link>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">
            承認待ち
            {pendingCount > 0 && (
              <Badge className="ml-1.5 h-5 min-w-5 px-1.5 text-[10px] bg-yellow-500 hover:bg-yellow-500 text-white">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="submitted">
            申請中
            {submittedCount > 0 && (
              <Badge className="ml-1.5 h-5 min-w-5 px-1.5 text-[10px] bg-blue-500 hover:bg-blue-500 text-white">
                {submittedCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">承認済み</TabsTrigger>
          <TabsTrigger value="rejected">差戻し</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {renderTable(filteredItems("pending"), true)}
        </TabsContent>
        <TabsContent value="submitted">
          {renderTable(filteredItems("submitted"), false)}
        </TabsContent>
        <TabsContent value="approved">
          {renderTable(filteredItems("approved"), false)}
        </TabsContent>
        <TabsContent value="rejected">
          {renderTable(filteredItems("rejected"), false)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
