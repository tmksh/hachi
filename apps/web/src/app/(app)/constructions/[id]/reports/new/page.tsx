"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Upload } from "lucide-react";

const safetyChecklist = [
  "朝礼・KY活動実施",
  "安全帯・ヘルメット着用確認",
  "足場・仮設設備点検",
  "重機・工具の始業前点検",
  "作業区域の整理整頓",
  "火気使用箇所の確認",
];

export default function ReportNewPage() {
  const { id } = useParams();
  const router = useRouter();
  const [date, setDate] = useState("");
  const [weather, setWeather] = useState("");
  const [content, setContent] = useState("");
  const [workers, setWorkers] = useState("");
  const [checkedItems, setCheckedItems] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const toggleCheck = (item: string) => {
    setCheckedItems((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const handleSave = () => {
    toast.success("日報を作成しました");
    router.push(`/constructions/${id}`);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/constructions/${id}`}>
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <PageHeader title="日報作成" description="新しい日報を作成します" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">基本情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">日付</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weather">天候</Label>
              <Select value={weather} onValueChange={setWeather}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="天候を選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="晴れ">晴れ</SelectItem>
                  <SelectItem value="曇り">曇り</SelectItem>
                  <SelectItem value="雨">雨</SelectItem>
                  <SelectItem value="雪">雪</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="workers">作業員数</Label>
              <Input
                id="workers"
                type="number"
                min={0}
                placeholder="例: 8"
                value={workers}
                onChange={(e) => setWorkers(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">作業内容</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="本日の作業内容を記入してください"
            rows={6}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">安全確認チェックリスト</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {safetyChecklist.map((item) => (
              <div key={item} className="flex items-center gap-3">
                <Checkbox
                  id={item}
                  checked={checkedItems.includes(item)}
                  onCheckedChange={() => toggleCheck(item)}
                />
                <Label htmlFor={item} className="text-sm font-normal cursor-pointer">
                  {item}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">写真添付</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              クリックまたはドラッグ&ドロップで写真を添付
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">備考</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="備考や特記事項を入力してください"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3 pb-6">
        <Link href={`/constructions/${id}`}>
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
