"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Edit, FileDown, Send } from "lucide-react";

interface LineItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
}

interface QuoteData {
  id: string;
  number: string;
  customer: string;
  customerAddress: string;
  subject: string;
  status: string;
  createdAt: string;
  validUntil: string;
  items: LineItem[];
  notes: string;
}

const quoteDataMap: Record<string, QuoteData> = {
  "1": {
    id: "1",
    number: "Q-2026-001",
    customer: "田中建設株式会社",
    customerAddress: "東京都新宿区西新宿1-1-1 新宿ビル5F",
    subject: "渋谷マンション外壁塗装工事",
    status: "approved",
    createdAt: "2026-01-10",
    validUntil: "2026-02-10",
    items: [
      { id: "1", name: "外壁塗装工事（シリコン塗料）", quantity: 450, unit: "m2", unitPrice: 5500, amount: 2475000 },
      { id: "2", name: "足場架設・撤去", quantity: 1, unit: "式", unitPrice: 850000, amount: 850000 },
      { id: "3", name: "高圧洗浄", quantity: 450, unit: "m2", unitPrice: 350, amount: 157500 },
      { id: "4", name: "シーリング打ち替え", quantity: 200, unit: "m", unitPrice: 1200, amount: 240000 },
      { id: "5", name: "養生・清掃", quantity: 1, unit: "式", unitPrice: 350000, amount: 350000 },
      { id: "6", name: "現場管理費", quantity: 1, unit: "式", unitPrice: 290909, amount: 290909 },
    ],
    notes: "工期は約4週間を予定しております。天候により工期が前後する場合がございます。\n足場架設期間中、一部のバルコニーが使用できなくなります。\n近隣への挨拶回りは弊社にて実施いたします。",
  },
};

const defaultQuote: QuoteData = {
  id: "0",
  number: "Q-2026-005",
  customer: "田中建設株式会社",
  customerAddress: "東京都新宿区西新宿1-1-1 新宿ビル5F",
  subject: "品川倉庫リフォーム工事",
  status: "submitted",
  createdAt: "2026-02-20",
  validUntil: "2026-03-20",
  items: [
    { id: "1", name: "内装解体工事", quantity: 1, unit: "式", unitPrice: 1200000, amount: 1200000 },
    { id: "2", name: "床張替え工事（タイルカーペット）", quantity: 300, unit: "m2", unitPrice: 4800, amount: 1440000 },
    { id: "3", name: "壁面クロス張替え", quantity: 500, unit: "m2", unitPrice: 2200, amount: 1100000 },
    { id: "4", name: "電気設備工事", quantity: 1, unit: "式", unitPrice: 1800000, amount: 1800000 },
    { id: "5", name: "空調設備更新", quantity: 4, unit: "台", unitPrice: 450000, amount: 1800000 },
    { id: "6", name: "諸経費・現場管理費", quantity: 1, unit: "式", unitPrice: 860000, amount: 860000 },
  ],
  notes: "工期は約6週間を予定しております。\n既存設備の撤去・処分費用を含みます。\n工事期間中は倉庫の一部使用制限がございます。",
};

export default function QuoteDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const quote = quoteDataMap[id] ?? { ...defaultQuote, id };

  const subtotal = quote.items.reduce((s, item) => s + item.amount, 0);
  const tax = Math.floor(subtotal * 0.1);
  const total = subtotal + tax;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/quotes">
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <PageHeader title="見積詳細" description={quote.number}>
          <Link href={`/quotes/${id}/edit`}>
            <Button variant="outline" size="sm">
              <Edit className="size-4 mr-1" />
              編集
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => toast.success("PDFを生成しました")}>
            <FileDown className="size-4 mr-1" />
            PDF出力
          </Button>
          <Button size="sm" onClick={() => toast.success("見積書を送付しました")}>
            <Send className="size-4 mr-1" />
            送付
          </Button>
        </PageHeader>
      </div>

      {/* Quote Header */}
      <Card>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground mb-1">見積番号</p>
              <p className="font-mono font-medium">{quote.number}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">顧客</p>
              <p className="font-medium">{quote.customer}</p>
              <p className="text-xs text-muted-foreground">{quote.customerAddress}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">作成日 / 有効期限</p>
              <p className="font-medium">{quote.createdAt} ~ {quote.validUntil}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">ステータス</p>
              <StatusBadge status={quote.status} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subject */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">件名</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-medium">{quote.subject}</p>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">明細</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>項目</TableHead>
                <TableHead className="text-right w-20">数量</TableHead>
                <TableHead className="w-16">単位</TableHead>
                <TableHead className="text-right w-28">単価</TableHead>
                <TableHead className="text-right w-32">金額</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quote.items.map((item, idx) => (
                <TableRow key={item.id}>
                  <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell className="text-right">{item.quantity.toLocaleString()}</TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell className="text-right">{item.unitPrice.toLocaleString()}円</TableCell>
                  <TableCell className="text-right font-medium">{item.amount.toLocaleString()}円</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Totals */}
          <div className="border-t px-4 py-4">
            <div className="flex flex-col items-end gap-2 text-sm">
              <div className="flex justify-between w-64">
                <span className="text-muted-foreground">小計</span>
                <span className="font-medium">{subtotal.toLocaleString()}円</span>
              </div>
              <div className="flex justify-between w-64">
                <span className="text-muted-foreground">消費税（10%）</span>
                <span className="font-medium">{tax.toLocaleString()}円</span>
              </div>
              <Separator className="w-64" />
              <div className="flex justify-between w-64">
                <span className="font-semibold text-base">合計</span>
                <span className="font-bold text-lg">{total.toLocaleString()}円</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">備考</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-line text-muted-foreground">{quote.notes}</p>
        </CardContent>
      </Card>
    </div>
  );
}
