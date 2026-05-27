"use client";

import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Upload, FileText } from "lucide-react";
import { getCustomerDocuments } from "@/lib/actions/crm-features";
import { createDocument } from "@/lib/actions/documents";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const STORAGE_BUCKET = "documents";

type DocRow = Awaited<ReturnType<typeof getCustomerDocuments>>[number];

export function CustomerFilesTab({ customerId }: { customerId: string }) {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => getCustomerDocuments(customerId).then(setDocs).catch(() => {});
  useEffect(() => { load(); }, [customerId]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "bin";
      const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "");
      const path = `customers/${customerId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${safeExt}`;
      const { error: storageError } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file);
      if (storageError) throw storageError;

      await createDocument({
        name: file.name,
        customer_id: customerId,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type,
        size: file.size,
      });

      toast.success(`「${file.name}」をアップロードしました`);
      load();
    } catch (err) {
      toast.error(`アップロードに失敗しました: ${err instanceof Error ? err.message : "不明なエラー"}`);
    } finally {
      e.target.value = "";
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <input
          ref={fileRef}
          type="file"
          className="sr-only"
          onChange={handleFileChange}
          disabled={uploading}
        />
        <Button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="h-9 gap-1.5"
          disabled={uploading}
        >
          <Upload className="h-4 w-4" />
          {uploading ? "アップロード中..." : "アップロード"}
        </Button>
      </div>
      <div className="space-y-2">
        {docs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">ファイルなし</p>
        ) : docs.map((d) => (
          <div key={d.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border hover:bg-muted/30">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{d.name}</p>
              <p className="text-[11px] text-muted-foreground">{d.category ?? "一般"} · {format(new Date(d.created_at), "yyyy/MM/dd", { locale: ja })}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
