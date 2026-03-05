"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/shared/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, FileText, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface LineItem {
  id: number;
  description: string;
  quantity: number;
  unitPrice: number;
}

let nextId = 3;

export default function InvoiceNewPage() {
  const router = useRouter();

  const handleIssue = () => {
    toast.success("請求書を発行しました");
    router.push("/contracts");
  };

  const handleSaveDraft = () => {
    toast.success("下書きを保存しました");
  };

  const handleCancel = () => {
    router.back();
  };

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: 1, description: "基礎工事", quantity: 1, unitPrice: 3500000 },
    { id: 2, description: "木工事", quantity: 1, unitPrice: 8200000 },
  ]);

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: nextId++, description: "", quantity: 1, unitPrice: 0 },
    ]);
  };

  const removeLineItem = (id: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((item) => item.id !== id));
  };

  const updateLineItem = (
    id: number,
    field: keyof LineItem,
    value: string | number
  ) => {
    setLineItems(
      lineItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const subtotal = lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
  const tax = Math.floor(subtotal * 0.1);
  const total = subtotal + tax;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="請求書作成" description="新しい請求書を作成します">
        <div className="flex gap-2">
          <Button variant="ghost" onClick={handleCancel}>
            キャンセル
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleSaveDraft}>
            <Save className="h-4 w-4" />
            下書き保存
          </Button>
          <Button className="gap-2" onClick={handleIssue}>
            <FileText className="h-4 w-4" />
            発行する
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-4">
          {/* Basic Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">基本情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customer">請求先</Label>
                  <Select defaultValue="yamada">
                    <SelectTrigger id="customer">
                      <SelectValue placeholder="顧客を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yamada">山田建設株式会社</SelectItem>
                      <SelectItem value="tanaka">田中工務店</SelectItem>
                      <SelectItem value="suzuki">鈴木不動産</SelectItem>
                      <SelectItem value="sato">佐藤太郎（個人）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoiceNo">請求書番号</Label>
                  <Input
                    id="invoiceNo"
                    defaultValue="INV-2026-0042"
                    readOnly
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="issueDate">発行日</Label>
                  <Input id="issueDate" type="date" defaultValue="2026-03-05" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">支払期限</Label>
                  <Input id="dueDate" type="date" defaultValue="2026-04-04" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">明細</CardTitle>
              <Button variant="outline" size="sm" onClick={addLineItem} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                行を追加
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">項目</TableHead>
                    <TableHead className="text-right w-[15%]">数量</TableHead>
                    <TableHead className="text-right w-[20%]">単価</TableHead>
                    <TableHead className="text-right w-[20%]">金額</TableHead>
                    <TableHead className="w-[5%]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Input
                          value={item.description}
                          onChange={(e) =>
                            updateLineItem(item.id, "description", e.target.value)
                          }
                          placeholder="項目名を入力"
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            updateLineItem(
                              item.id,
                              "quantity",
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="h-8 text-right"
                          min={1}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateLineItem(
                              item.id,
                              "unitPrice",
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="h-8 text-right"
                          min={0}
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {(item.quantity * item.unitPrice).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLineItem(item.id)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          disabled={lineItems.length <= 1}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">備考</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notes">備考・特記事項</Label>
                <Textarea
                  id="notes"
                  placeholder="備考を入力..."
                  defaultValue="工事完了後、検査合格を確認の上、お支払いをお願いいたします。"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentTerms">支払条件</Label>
                <Select defaultValue="30">
                  <SelectTrigger id="paymentTerms">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">即時払い</SelectItem>
                    <SelectItem value="30">月末締め翌月末払い</SelectItem>
                    <SelectItem value="60">月末締め翌々月末払い</SelectItem>
                    <SelectItem value="custom">その他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary Sidebar */}
        <div>
          <Card className="sticky top-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">請求金額</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">小計</span>
                  <span className="tabular-nums">
                    ¥{subtotal.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    消費税（10%）
                  </span>
                  <span className="tabular-nums">
                    ¥{tax.toLocaleString()}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between text-base font-semibold">
                  <span>合計</span>
                  <span className="tabular-nums text-primary">
                    ¥{total.toLocaleString()}
                  </span>
                </div>
              </div>

              <Separator />

              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>請求書番号</span>
                  <span>INV-2026-0042</span>
                </div>
                <div className="flex justify-between">
                  <span>発行日</span>
                  <span>2026/03/05</span>
                </div>
                <div className="flex justify-between">
                  <span>支払期限</span>
                  <span>2026/04/04</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button className="w-full gap-2" onClick={handleIssue}>
                  <FileText className="h-4 w-4" />
                  発行する
                </Button>
                <Button variant="outline" className="w-full gap-2" onClick={handleSaveDraft}>
                  <Save className="h-4 w-4" />
                  下書き保存
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
