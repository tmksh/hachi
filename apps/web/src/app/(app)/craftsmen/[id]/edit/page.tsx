"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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

const mockData: Record<string, {
  name: string;
  specialty: string;
  phone: string;
  email: string;
  address: string;
  experience: number;
  dailyRate: number;
  bio: string;
}> = {
  "W-001": {
    name: "木村正男",
    specialty: "大工",
    phone: "090-1234-5678",
    email: "kimura@example.com",
    address: "東京都大田区南馬込3-15-7",
    experience: 25,
    dailyRate: 28000,
    bio: "木造建築を専門とし、25年以上の経験を持つ熟練大工。リノベーションや耐震補強にも精通。",
  },
};

const defaultData = {
  name: "木村正男",
  specialty: "大工",
  phone: "090-1234-5678",
  email: "kimura@example.com",
  address: "東京都大田区南馬込3-15-7",
  experience: 25,
  dailyRate: 28000,
  bio: "木造建築を専門とし、25年以上の経験を持つ熟練大工。リノベーションや耐震補強にも精通。",
};

export default function CraftsmanEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const initial = mockData[id] ?? defaultData;

  const [name, setName] = useState(initial.name);
  const [specialty, setSpecialty] = useState(initial.specialty);
  const [phone, setPhone] = useState(initial.phone);
  const [email, setEmail] = useState(initial.email);
  const [address, setAddress] = useState(initial.address);
  const [experience, setExperience] = useState(String(initial.experience));
  const [dailyRate, setDailyRate] = useState(String(initial.dailyRate));
  const [bio, setBio] = useState(initial.bio);

  const handleSave = () => {
    toast.success("職人情報を更新しました");
    router.push(`/craftsmen/${id}`);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/craftsmen/${id}`}>
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <PageHeader title="職人情報編集" description="職人情報を編集します" />
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
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address">住所</Label>
              <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="experience">経験年数</Label>
              <Input id="experience" type="number" min={0} value={experience} onChange={(e) => setExperience(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dailyRate">日当（円）</Label>
              <Input id="dailyRate" type="number" min={0} value={dailyRate} onChange={(e) => setDailyRate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">紹介文</Label>
            <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={4} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3 pb-6">
        <Link href={`/craftsmen/${id}`}>
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
