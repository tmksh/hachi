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
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  User,
  Calendar,
  Building2,
  Phone,
  Mail,
  FileText,
  Download,
  Pencil,
} from "lucide-react";

const contractData = {
  id: "CT-2025-001",
  customer: "山田太郎",
  customerCompany: "個人",
  customerPhone: "03-1234-5678",
  customerEmail: "yamada@example.com",
  type: "新築工事",
  amount: 32000000,
  date: "2025-09-15",
  startDate: "2025-10-01",
  endDate: "2026-04-30",
  status: "executing",
  paymentTerms: "着工時30%、中間30%、完了時40%",
  description:
    "山田邸リノベーション工事に関する工事請負契約。キッチン・浴室の全面改装、耐震補強、断熱材入替を含む。",
  constructionId: "C-001",
  constructionName: "山田邸リノベーション工事",
};

const relatedQuotes = [
  {
    id: "Q-2025-018",
    name: "山田邸リノベーション 見積A",
    amount: 35000000,
    date: "2025-08-20",
    status: "rejected",
  },
  {
    id: "Q-2025-022",
    name: "山田邸リノベーション 見積B（修正版）",
    amount: 32000000,
    date: "2025-09-05",
    status: "approved",
  },
];

const payments = [
  {
    name: "着工時支払い（30%）",
    amount: 9600000,
    dueDate: "2025-10-01",
    paidDate: "2025-10-01",
    status: "paid",
  },
  {
    name: "中間支払い（30%）",
    amount: 9600000,
    dueDate: "2026-01-15",
    paidDate: "2026-01-20",
    status: "paid",
  },
  {
    name: "完了時支払い（40%）",
    amount: 12800000,
    dueDate: "2026-04-30",
    paidDate: null,
    status: "pending",
  },
];

const documents = [
  { name: "工事請負契約書", type: "PDF", date: "2025-09-15", size: "2.4MB" },
  { name: "契約約款", type: "PDF", date: "2025-09-15", size: "1.8MB" },
  { name: "見積書（最終版）", type: "PDF", date: "2025-09-05", size: "980KB" },
  { name: "設計図面一式", type: "PDF", date: "2025-09-10", size: "15.8MB" },
  { name: "重要事項説明書", type: "PDF", date: "2025-09-15", size: "1.2MB" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(value);
}

export default function ContractDetailPage() {
  const { id } = useParams();
  const data = contractData;

  const paidTotal = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Back link & Header */}
      <div>
        <Link
          href="/contracts"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          契約一覧に戻る
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight">{id as string}</h1>
              <StatusBadge status={data.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {data.customer} - {data.type}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">契約金額</p>
              <p className="text-xl font-semibold tabular-nums">{formatCurrency(data.amount)}</p>
            </div>
            <Link href={`/contracts/${id}/edit`}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Pencil className="h-4 w-4" />
                編集
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">契約情報</TabsTrigger>
          <TabsTrigger value="quotes">関連見積</TabsTrigger>
          <TabsTrigger value="payments">入金状況</TabsTrigger>
          <TabsTrigger value="documents">書類</TabsTrigger>
        </TabsList>

        {/* Contract Info */}
        <TabsContent value="info" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">契約基本情報</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" /> 契約番号
                    </dt>
                    <dd className="font-medium">{id as string}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" /> 契約種別
                    </dt>
                    <dd className="font-medium">{data.type}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" /> 締結日
                    </dt>
                    <dd className="font-medium tabular-nums">{data.date}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" /> 工期
                    </dt>
                    <dd className="font-medium tabular-nums">
                      {data.startDate} ~ {data.endDate}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">支払条件</dt>
                    <dd className="font-medium text-right max-w-[200px]">{data.paymentTerms}</dd>
                  </div>
                </dl>
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-muted-foreground mb-1">関連工事</p>
                  <Link
                    href={`/constructions/${data.constructionId}`}
                    className="text-sm text-primary hover:underline font-medium"
                  >
                    {data.constructionName}
                  </Link>
                </div>
                <div className="mt-3 pt-3 border-t">
                  <p className="text-sm text-muted-foreground">{data.description}</p>
                </div>
              </CardContent>
            </Card>

            {/* Customer Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">顧客情報</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-lg font-medium text-primary">
                      {data.customer.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">{data.customer}</p>
                    <p className="text-sm text-muted-foreground">{data.customerCompany}</p>
                  </div>
                </div>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" /> 電話番号
                    </dt>
                    <dd className="font-medium">{data.customerPhone}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" /> メール
                    </dt>
                    <dd className="font-medium">{data.customerEmail}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Related Quotes */}
        <TabsContent value="quotes" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">関連見積一覧</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>見積番号</TableHead>
                    <TableHead>見積名</TableHead>
                    <TableHead className="text-right">金額</TableHead>
                    <TableHead>提出日</TableHead>
                    <TableHead>ステータス</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {relatedQuotes.map((q) => (
                    <TableRow key={q.id} className="cursor-pointer hover:bg-accent/50">
                      <TableCell>
                        <Link
                          href={`/quotes/${q.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {q.id}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">{q.name}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCurrency(q.amount)}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">{q.date}</TableCell>
                      <TableCell>
                        <StatusBadge status={q.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Status */}
        <TabsContent value="payments" className="space-y-6 mt-4">
          {/* Payment Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">契約金額</p>
                <p className="text-lg font-semibold tabular-nums">{formatCurrency(data.amount)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">入金済み</p>
                <p className="text-lg font-semibold text-green-700 dark:text-green-400 tabular-nums">
                  {formatCurrency(paidTotal)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">未入金</p>
                <p className="text-lg font-semibold text-orange-600 dark:text-orange-400 tabular-nums">
                  {formatCurrency(data.amount - paidTotal)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Payment Schedule */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">入金スケジュール</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>項目</TableHead>
                    <TableHead className="text-right">金額</TableHead>
                    <TableHead>支払期日</TableHead>
                    <TableHead>入金日</TableHead>
                    <TableHead>ステータス</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCurrency(p.amount)}
                      </TableCell>
                      <TableCell className="tabular-nums">{p.dueDate}</TableCell>
                      <TableCell className="tabular-nums">
                        {p.paidDate ?? <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={p.status === "paid" ? "approved" : "pending"}
                          label={p.status === "paid" ? "入金済み" : "未入金"}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">契約書類</CardTitle>
              <Button size="sm" className="gap-1.5" onClick={() => toast.success("書類をアップロードしました")}>
                <FileText className="h-4 w-4" />
                書類追加
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>書類名</TableHead>
                    <TableHead>種別</TableHead>
                    <TableHead>日付</TableHead>
                    <TableHead>サイズ</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {doc.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {doc.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">{doc.date}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{doc.size}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
