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
import { Save, ArrowLeft, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";

export default function MarketingCreativeNewPage() {
  const router = useRouter();

  const handleSave = () => {
    toast.success("クリエイティブを保存しました");
    router.push("/marketing/creative");
  };

  const handleCancel = () => {
    router.push("/marketing/creative");
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title="新規クリエイティブ作成"
        description="マーケティング素材を作成します"
      >
        <Link href="/marketing/creative">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            戻る
          </Button>
        </Link>
      </PageHeader>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">クリエイティブ情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">タイトル</Label>
            <Input id="title" placeholder="タイトルを入力" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">種別</Label>
            <Select>
              <SelectTrigger id="type">
                <SelectValue placeholder="種別を選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="banner">バナー</SelectItem>
                <SelectItem value="flyer">チラシ</SelectItem>
                <SelectItem value="video">動画</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">説明</Label>
            <Textarea
              id="description"
              placeholder="クリエイティブの説明を入力..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>ファイルアップロード</Label>
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-accent/50 transition-colors cursor-pointer"
              onClick={() => toast.info("ファイルを選択してください")}
            >
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                クリックまたはドラッグ&ドロップでアップロード
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PNG, JPG, MP4, PDF (最大50MB)
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={handleCancel}>
              キャンセル
            </Button>
            <Button className="gap-2" onClick={handleSave}>
              <Save className="h-4 w-4" />
              保存する
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
