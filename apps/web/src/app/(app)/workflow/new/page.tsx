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
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Upload,
  Send,
  Save,
  X,
  Plus,
  FileText,
} from "lucide-react";

export default function WorkflowNewPage() {
  const router = useRouter();
  const [applicationType, setApplicationType] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/workflow">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            戻る
          </Button>
        </Link>
      </div>

      <PageHeader title="申請作成" description="新しい申請を作成します" />

      <div className="max-w-2xl space-y-6">
        {/* Basic info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">基本情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="type">申請種別 <span className="text-red-500">*</span></Label>
              <Select value={applicationType} onValueChange={setApplicationType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="申請種別を選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">経費精算</SelectItem>
                  <SelectItem value="leave">休暇申請</SelectItem>
                  <SelectItem value="purchase">購入申請</SelectItem>
                  <SelectItem value="other">その他</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">件名 <span className="text-red-500">*</span></Label>
              <Input id="subject" placeholder="申請の件名を入力" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">説明</Label>
              <Textarea
                id="description"
                placeholder="申請の詳細を入力してください"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Dynamic fields based on type */}
        {applicationType === "expense" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">経費精算情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expense-date">発生日 <span className="text-red-500">*</span></Label>
                  <Input id="expense-date" type="date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expense-amount">金額 <span className="text-red-500">*</span></Label>
                  <Input id="expense-amount" type="number" placeholder="0" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expense-category">経費科目</Label>
                <Select>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="経費科目を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="travel">旅費交通費</SelectItem>
                    <SelectItem value="entertainment">接待交際費</SelectItem>
                    <SelectItem value="supplies">消耗品費</SelectItem>
                    <SelectItem value="communication">通信費</SelectItem>
                    <SelectItem value="other">その他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>領収書 <span className="text-red-500">*</span></Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-accent/50 transition-colors cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    クリックまたはドラッグ&ドロップでファイルを追加
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, JPG, PNG (最大10MB)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {applicationType === "leave" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">休暇申請情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="leave-type">休暇種別 <span className="text-red-500">*</span></Label>
                <Select>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="休暇種別を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">有給休暇</SelectItem>
                    <SelectItem value="special">特別休暇</SelectItem>
                    <SelectItem value="sick">病気休暇</SelectItem>
                    <SelectItem value="half-am">半休（午前）</SelectItem>
                    <SelectItem value="half-pm">半休（午後）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="leave-start">開始日 <span className="text-red-500">*</span></Label>
                  <Input id="leave-start" type="date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leave-end">終了日 <span className="text-red-500">*</span></Label>
                  <Input id="leave-end" type="date" />
                </div>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-800">有給休暇残日数: <span className="font-semibold">12日</span></p>
              </div>
            </CardContent>
          </Card>
        )}

        {applicationType === "purchase" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">購入申請情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="purchase-amount">希望金額 <span className="text-red-500">*</span></Label>
                <Input id="purchase-amount" type="number" placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchase-vendor">購入先</Label>
                <Input id="purchase-vendor" placeholder="購入先の会社名を入力" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchase-reason">購入理由</Label>
                <Textarea id="purchase-reason" placeholder="購入が必要な理由を入力" rows={3} />
              </div>
            </CardContent>
          </Card>
        )}

        {applicationType === "other" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">詳細情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="other-amount">金額（該当する場合）</Label>
                <Input id="other-amount" type="number" placeholder="0" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* File attachments */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              添付ファイル
            </CardTitle>
          </CardHeader>
          <CardContent>
            {attachments.length > 0 && (
              <div className="space-y-2 mb-4">
                {attachments.map((name, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-accent/50 transition-colors cursor-pointer">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                クリックまたはドラッグ&ドロップでファイルを追加
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF, Excel, Word, 画像ファイル (最大10MB)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pb-6">
          <Link href="/workflow">
            <Button variant="outline">キャンセル</Button>
          </Link>
          <Button variant="outline" className="gap-1.5" onClick={() => { toast.success("下書きを保存しました"); router.push("/workflow"); }}>
            <Save className="h-4 w-4" />
            下書き保存
          </Button>
          <Button className="gap-1.5" onClick={() => { toast.success("申請を提出しました"); router.push("/workflow"); }}>
            <Send className="h-4 w-4" />
            申請する
          </Button>
        </div>
      </div>
    </div>
  );
}
