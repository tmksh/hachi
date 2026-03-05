"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
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
import { ArrowLeft, Plus, Trash2, Save, Send } from "lucide-react";

interface LineItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

const customers = [
  { id: "1", name: "田中建設株式会社" },
  { id: "2", name: "鈴木工務店" },
  { id: "3", name: "佐藤 一郎" },
  { id: "4", name: "加藤総合建設株式会社" },
  { id: "5", name: "渡辺リフォーム株式会社" },
  { id: "6", name: "高橋 健二" },
  { id: "7", name: "西川工業株式会社" },
  { id: "8", name: "伊藤設計事務所" },
  { id: "9", name: "中村建設" },
];

let nextId = 2;

export default function QuoteNewPage() {
  const router = useRouter();
  const [items, setItems] = useState<LineItem[]>([
    { id: "1", name: "", quantity: 1, unit: "式", unitPrice: 0 },
  ]);
  const [notes, setNotes] = useState("");

  const addItem = () => {
    setItems([...items, { id: String(nextId++), name: "", quantity: 1, unit: "式", unitPrice: 0 }]);
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    setItems(items.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, field: keyof LineItem, value: string | number) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const subtotal = items.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
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
        <PageHeader title="見積作成" description="新しい見積書を作成します" />
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">基本情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customer">顧客</Label>
              <Select>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="顧客を選択" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-1">
              <Label htmlFor="subject">件名</Label>
              <Input id="subject" placeholder="例: マンション外壁塗装工事" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="validity">有効期限</Label>
              <Input id="validity" type="date" defaultValue="2026-04-05" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">明細項目</CardTitle>
            <Button variant="outline" size="sm" onClick={addItem}>
              <Plus className="size-4 mr-1" />
              行を追加
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>項目名</TableHead>
                <TableHead className="w-20">数量</TableHead>
                <TableHead className="w-20">単位</TableHead>
                <TableHead className="w-28">単価</TableHead>
                <TableHead className="text-right w-28">金額</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, idx) => {
                const amount = item.quantity * item.unitPrice;
                return (
                  <TableRow key={item.id}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell>
                      <Input
                        value={item.name}
                        onChange={(e) => updateItem(item.id, "name", e.target.value)}
                        placeholder="項目名を入力"
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(item.id, "quantity", Number(e.target.value) || 0)
                        }
                        className="h-8 text-right"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={item.unit}
                        onValueChange={(val) => updateItem(item.id, "unit", val)}
                      >
                        <SelectTrigger className="h-8 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="式">式</SelectItem>
                          <SelectItem value="m2">m2</SelectItem>
                          <SelectItem value="m">m</SelectItem>
                          <SelectItem value="台">台</SelectItem>
                          <SelectItem value="個">個</SelectItem>
                          <SelectItem value="セット">セット</SelectItem>
                          <SelectItem value="人工">人工</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={item.unitPrice}
                        onChange={(e) =>
                          updateItem(item.id, "unitPrice", Number(e.target.value) || 0)
                        }
                        className="h-8 text-right"
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {amount.toLocaleString()}円
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeItem(item.id)}
                        disabled={items.length <= 1}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
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
        <CardHeader className="pb-3">
          <CardTitle className="text-base">備考</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="備考や特記事項を入力してください"
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pb-6">
        <Link href="/quotes">
          <Button variant="outline">キャンセル</Button>
        </Link>
        <Button variant="outline" onClick={() => { toast.success("下書きを保存しました"); router.push("/quotes"); }}>
          <Save className="size-4 mr-1" />
          下書き保存
        </Button>
        <Button onClick={() => { toast.success("見積を提出しました"); router.push("/quotes"); }}>
          <Send className="size-4 mr-1" />
          提出
        </Button>
      </div>
    </div>
  );
}
