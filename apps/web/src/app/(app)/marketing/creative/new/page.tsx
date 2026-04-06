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
import { createDocument } from "@/lib/actions/documents";
import { createClient } from "@/lib/supabase/client";

const STORAGE_BUCKET = "documents";

export default function MarketingCreativeNewPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error("名前を入力してください"); return; }
    setSaving(true);
    try {
      let storagePath = `creative/${Date.now()}_placeholder`;
      let fileName = `${name.trim()}.txt`;
      let mimeType = "text/plain";
      let size = 0;

      if (file) {
        const supabase = createClient();
        const path = `creative/${Date.now()}_${file.name}`;
        const { error: storageError } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file);
        if (storageError) throw storageError;
        storagePath = path;
        fileName = file.name;
        mimeType = file.type;
        size = file.size;
      }

      await createDocument({
        name: name.trim(),
        category: "other",
        description: description.trim() || undefined,
        storage_path: storagePath,
        file_name: fileName,
        mime_type: mimeType,
        size,
      });
      toast.success("クリエイティブを保存しました");
      router.push("/marketing/creative");
    } catch (e: unknown) {
      toast.error(`保存に失敗しました: ${e instanceof Error ? e.message : "不明なエラー"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/marketing/creative"><Button variant="ghost" size="icon" className="size-8"><ArrowLeft className="size-4" /></Button></Link>
        <h1 className="text-xl font-semibold">クリエイティブ追加</h1>
      </div>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">素材情報</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label>名前</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="クリエイティブ名を入力" /></div>
          <div className="space-y-2"><Label>説明</Label><Textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="素材の説明を入力" /></div>
          <div className="space-y-2">
            <Label>ファイル</Label>
            <Input type="file" onChange={e => setFile(e.target.files?.[0] || null)} />
            {file && <p className="text-xs text-muted-foreground">{file.name} ({(file.size / 1024).toFixed(1)}KB)</p>}
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end gap-3">
        <Link href="/marketing/creative"><Button variant="outline">キャンセル</Button></Link>
        <Button onClick={handleSave} disabled={saving}><Save className="size-4 mr-1" />{saving ? "保存中..." : "保存"}</Button>
      </div>
    </div>
  );
}
