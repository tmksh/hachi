"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/page-header";
import { Send, Save, Paperclip, Upload } from "lucide-react";

export default function MailComposePage() {
  const router = useRouter();
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);

  const handleSend = () => {
    if (!to) {
      toast.error("宛先を入力してください");
      return;
    }
    if (!subject) {
      toast.error("件名を入力してください");
      return;
    }
    toast.success("メールを送信しました", {
      description: `宛先: ${to}`,
    });
    router.push("/mail");
  };

  const handleSaveDraft = () => {
    toast.success("下書きを保存しました");
    router.push("/mail");
  };

  const handleCancel = () => {
    router.push("/mail");
  };

  const handleAttach = () => {
    const fileName = `添付ファイル_${attachments.length + 1}.pdf`;
    setAttachments([...attachments, fileName]);
    toast.success("ファイルを添付しました", {
      description: fileName,
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="新規メール" description="メールを作成" />

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="text-base">メール作成</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* 宛先 */}
          <div className="space-y-2">
            <Label htmlFor="to">宛先 <span className="text-destructive">*</span></Label>
            <Input
              id="to"
              type="email"
              placeholder="example@company.co.jp"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          {/* CC */}
          <div className="space-y-2">
            <Label htmlFor="cc">CC</Label>
            <Input
              id="cc"
              type="email"
              placeholder="cc@company.co.jp"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
            />
          </div>

          {/* 件名 */}
          <div className="space-y-2">
            <Label htmlFor="subject">件名 <span className="text-destructive">*</span></Label>
            <Input
              id="subject"
              placeholder="件名を入力"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* 本文 */}
          <div className="space-y-2">
            <Label htmlFor="body">本文</Label>
            <Textarea
              id="body"
              placeholder="本文を入力"
              rows={12}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-[240px]"
            />
          </div>

          {/* 添付ファイル */}
          <div className="space-y-2">
            <Label>添付ファイル</Label>
            <div
              className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={handleAttach}
            >
              <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                クリックしてファイルを添付
              </p>
            </div>
            {attachments.length > 0 && (
              <div className="space-y-1 mt-2">
                {attachments.map((file, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-sm text-muted-foreground px-2 py-1 bg-accent/30 rounded"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    {file}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ボタン */}
          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSend} className="gap-2">
              <Send className="h-4 w-4" />
              送信
            </Button>
            <Button variant="outline" onClick={handleSaveDraft} className="gap-2">
              <Save className="h-4 w-4" />
              下書き保存
            </Button>
            <Button variant="ghost" onClick={handleCancel}>
              キャンセル
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
