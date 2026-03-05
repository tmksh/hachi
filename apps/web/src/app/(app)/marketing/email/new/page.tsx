"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, Save, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";

export default function MarketingEmailNewPage() {
  const router = useRouter();

  const handleSend = () => {
    toast.success("キャンペーンを配信しました");
    router.push("/marketing/email");
  };

  const handleSaveDraft = () => {
    toast.success("下書きを保存しました");
    router.push("/marketing/email");
  };

  const handleCancel = () => {
    router.push("/marketing/email");
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title="新規キャンペーン"
        description="メールキャンペーンを作成します"
      >
        <Link href="/marketing/email">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            戻る
          </Button>
        </Link>
      </PageHeader>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">キャンペーン情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="campaignName">キャンペーン名</Label>
            <Input id="campaignName" placeholder="キャンペーン名を入力" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">件名</Label>
            <Input id="subject" placeholder="メールの件名を入力" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">本文</Label>
            <Textarea
              id="body"
              placeholder="メール本文を入力..."
              rows={8}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="segment">配信先セグメント</Label>
              <Select>
                <SelectTrigger id="segment">
                  <SelectValue placeholder="セグメントを選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全顧客</SelectItem>
                  <SelectItem value="active">アクティブ顧客</SelectItem>
                  <SelectItem value="prospect">見込み客</SelectItem>
                  <SelectItem value="past">過去の顧客</SelectItem>
                  <SelectItem value="vip">VIP顧客</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deliveryDate">配信日時</Label>
              <Input id="deliveryDate" type="datetime-local" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={handleCancel}>
              キャンセル
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleSaveDraft}>
              <Save className="h-4 w-4" />
              下書き保存
            </Button>
            <Button className="gap-2" onClick={handleSend}>
              <Send className="h-4 w-4" />
              配信する
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
