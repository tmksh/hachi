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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";

const customers = [
  { id: "1", name: "山田太郎" },
  { id: "2", name: "田中工務店" },
  { id: "3", name: "鈴木商事株式会社" },
  { id: "4", name: "佐藤花子" },
  { id: "5", name: "中村建設株式会社" },
  { id: "6", name: "加藤次郎" },
];

export default function ConstructionNewPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [site, setSite] = useState("");
  const [customer, setCustomer] = useState("");
  const [manager, setManager] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState("");

  const handleSave = () => {
    toast.success("工事を登録しました");
    router.push("/constructions");
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/constructions">
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <PageHeader title="新規工事登録" description="新しい工事を登録します" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">工事情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">工事名</Label>
              <Input
                id="name"
                placeholder="例: 山田邸リノベーション工事"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="site">現場住所</Label>
              <Input
                id="site"
                placeholder="例: 東京都世田谷区成城3-12-5"
                value={site}
                onChange={(e) => setSite(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer">顧客</Label>
              <Select value={customer} onValueChange={setCustomer}>
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
            <div className="space-y-2">
              <Label htmlFor="manager">担当者</Label>
              <Input
                id="manager"
                placeholder="例: 田中太郎"
                value={manager}
                onChange={(e) => setManager(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">開始日</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">完了予定日</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget">予算</Label>
              <Input
                id="budget"
                type="number"
                placeholder="例: 32000000"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">備考</Label>
            <Textarea
              id="notes"
              placeholder="備考や特記事項を入力してください"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3 pb-6">
        <Link href="/constructions">
          <Button variant="outline">キャンセル</Button>
        </Link>
        <Button onClick={handleSave}>
          <Save className="size-4 mr-1" />
          保存
        </Button>
      </div>
    </div>
  );
}
