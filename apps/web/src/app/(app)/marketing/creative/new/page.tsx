"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save } from "lucide-react";

export default function MarketingCreativeNewPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSave = () => { toast.success("保存しました（ファイルアップロードは別途設定が必要です）"); router.push("/marketing/creative"); };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3"><Link href="/marketing/creative"><Button variant="ghost" size="icon" className="size-8"><ArrowLeft className="size-4" /></Button></Link><h1 className="text-xl font-semibold">クリエイティブ追加</h1></div>
      <Card><CardHeader className="pb-3"><CardTitle className="text-base">素材情報</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label>名前</Label><Input value={name} onChange={e=>setName(e.target.value)} /></div>
          <div className="space-y-2"><Label>説明</Label><Textarea rows={4} value={description} onChange={e=>setDescription(e.target.value)} /></div>
          <div className="space-y-2"><Label>ファイル</Label><p className="text-sm text-muted-foreground">Supabase Storageのセットアップ後にファイルアップロードが利用可能になります</p></div>
        </CardContent>
      </Card>
      <div className="flex justify-end gap-3"><Link href="/marketing/creative"><Button variant="outline">キャンセル</Button></Link><Button onClick={handleSave}><Save className="size-4 mr-1" />保存</Button></div>
    </div>
  );
}
