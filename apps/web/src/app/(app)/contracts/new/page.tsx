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

const contractTypes = [
  "新築工事",
  "リフォーム",
  "ビル改修",
  "増築工事",
  "外壁工事",
  "耐震補強",
  "内装工事",
];

const quotes = [
  { id: "Q-2025-018", name: "山田邸リノベーション 見積A" },
  { id: "Q-2025-022", name: "山田邸リノベーション 見積B" },
  { id: "Q-2026-001", name: "佐藤邸増築工事 見積" },
  { id: "Q-2026-003", name: "中村ビル外壁工事 見積" },
];

export default function ContractNewPage() {
  const router = useRouter();
  const [customer, setCustomer] = useState("");
  const [contractType, setContractType] = useState("");
  const [subject, setSubject] = useState("");
  const [amount, setAmount] = useState("");
  const [contractDate, setContractDate] = useState("");
  const [relatedQuote, setRelatedQuote] = useState("");
  const [notes, setNotes] = useState("");

  const handleSave = () => {
    toast.success("契約を登録しました");
    router.push("/contracts");
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/contracts">
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <PageHeader title="新規契約登録" description="新しい契約を登録します" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">契約情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <Label htmlFor="contractType">契約種別</Label>
              <Select value={contractType} onValueChange={setContractType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="契約種別を選択" />
                </SelectTrigger>
                <SelectContent>
                  {contractTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="subject">件名</Label>
              <Input
                id="subject"
                placeholder="例: 山田邸リノベーション工事請負契約"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">契約金額</Label>
              <Input
                id="amount"
                type="number"
                placeholder="例: 32000000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contractDate">契約日</Label>
              <Input
                id="contractDate"
                type="date"
                value={contractDate}
                onChange={(e) => setContractDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="relatedQuote">関連見積</Label>
              <Select value={relatedQuote} onValueChange={setRelatedQuote}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="関連見積を選択" />
                </SelectTrigger>
                <SelectContent>
                  {quotes.map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.id} - {q.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
        <Link href="/contracts">
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
