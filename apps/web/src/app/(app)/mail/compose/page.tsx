"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send } from "lucide-react";
import { sendEmail } from "@/lib/actions/mail";

export default function MailComposePage() {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const handleSend = async () => {
    if (!to.trim() || !subject.trim()) { toast.error("宛先と件名を入力してください"); return; }
    setSending(true);
    try {
      const toAddrs = to.split(",").map(a => ({ address: a.trim() })).filter(a => a.address);
      const ccAddrs = cc ? cc.split(",").map(a => ({ address: a.trim() })).filter(a => a.address) : undefined;
      await sendEmail({ to: toAddrs, cc: ccAddrs, subject: subject.trim(), body_text: body });
      toast.success("送信しました"); router.push("/mail");
    } catch { toast.error("送信に失敗"); } finally { setSending(false); }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3"><Link href="/mail"><Button variant="ghost" size="icon" className="size-8"><ArrowLeft className="size-4" /></Button></Link><h1 className="text-xl font-semibold">メール作成</h1></div>
      <Card><CardHeader className="pb-3"><CardTitle className="text-base">メール</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label>宛先 *</Label><Input value={to} onChange={e=>setTo(e.target.value)} placeholder="メールアドレス（カンマ区切り）" /></div>
          <div className="space-y-2"><Label>CC</Label><Input value={cc} onChange={e=>setCc(e.target.value)} placeholder="CC" /></div>
          <div className="space-y-2"><Label>件名 *</Label><Input value={subject} onChange={e=>setSubject(e.target.value)} /></div>
          <div className="space-y-2"><Label>本文</Label><Textarea rows={10} value={body} onChange={e=>setBody(e.target.value)} /></div>
        </CardContent>
      </Card>
      <div className="flex justify-end gap-3"><Link href="/mail"><Button variant="outline">キャンセル</Button></Link><Button onClick={handleSend} disabled={sending}><Send className="size-4 mr-1" />{sending?"送信中...":"送信"}</Button></div>
    </div>
  );
}
