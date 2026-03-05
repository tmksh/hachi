"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
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

const customerData: Record<string, {
  name: string;
  company: string;
  type: string;
  phone: string;
  email: string;
  address: string;
  postalCode: string;
  representative: string;
  notes: string;
}> = {
  "1": {
    name: "田中 太郎",
    company: "田中建設株式会社",
    type: "法人",
    phone: "03-1234-5678",
    email: "tanaka@tanaken.co.jp",
    address: "東京都新宿区西新宿1-1-1 新宿ビル5F",
    postalCode: "160-0023",
    representative: "田中 太郎",
    notes: "大規模マンションリフォームに興味あり。年間予算は約5,000万円。",
  },
};

const defaultCustomer = {
  name: "田中 太郎",
  company: "田中建設株式会社",
  type: "法人",
  phone: "03-1234-5678",
  email: "tanaka@tanaken.co.jp",
  address: "東京都新宿区西新宿1-1-1 新宿ビル5F",
  postalCode: "160-0023",
  representative: "田中 太郎",
  notes: "大規模マンションリフォームに興味あり。年間予算は約5,000万円。",
};

export default function CrmEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const initial = customerData[id] ?? defaultCustomer;

  const [name, setName] = useState(initial.name);
  const [company, setCompany] = useState(initial.company);
  const [type, setType] = useState(initial.type);
  const [phone, setPhone] = useState(initial.phone);
  const [email, setEmail] = useState(initial.email);
  const [postalCode, setPostalCode] = useState(initial.postalCode);
  const [address, setAddress] = useState(initial.address);
  const [representative, setRepresentative] = useState(initial.representative);
  const [notes, setNotes] = useState(initial.notes);

  const handleSave = () => {
    toast.success("顧客情報を更新しました");
    router.push(`/crm/${id}`);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/crm/${id}`}>
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <PageHeader title="顧客編集" description="顧客情報を編集します" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">基本情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">氏名</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">会社名</Label>
              <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">区分</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="法人">法人</SelectItem>
                  <SelectItem value="個人">個人</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="representative">代表者</Label>
              <Input id="representative" value={representative} onChange={(e) => setRepresentative(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">電話番号</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postalCode">郵便番号</Label>
              <Input id="postalCode" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">住所</Label>
              <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">メモ</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3 pb-6">
        <Link href={`/crm/${id}`}>
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
