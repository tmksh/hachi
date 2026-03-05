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

const specialties = [
  "大工", "左官", "電気", "設備", "塗装", "内装", "板金", "防水",
];

export default function CraftsmanNewPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("大工");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [experience, setExperience] = useState("");
  const [notes, setNotes] = useState("");

  const handleSave = () => {
    toast.success("職人を登録しました");
    router.push("/craftsmen");
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/craftsmen">
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <PageHeader title="職人登録" description="新しい職人を登録します" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">基本情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">氏名</Label>
              <Input id="name" placeholder="例: 木村 正男" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="specialty">専門分野</Label>
              <Select value={specialty} onValueChange={setSpecialty}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {specialties.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">電話番号</Label>
              <Input id="phone" placeholder="例: 090-1234-5678" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input id="email" type="email" placeholder="例: kimura@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address">住所</Label>
              <Input id="address" placeholder="例: 東京都大田区南馬込3-15-7" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="experience">経験年数</Label>
              <Input id="experience" type="number" min={0} placeholder="例: 10" value={experience} onChange={(e) => setExperience(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">備考</Label>
            <Textarea id="notes" placeholder="紹介文や特記事項を入力してください" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3 pb-6">
        <Link href="/craftsmen">
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
