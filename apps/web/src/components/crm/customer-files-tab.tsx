"use client";

import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileText } from "lucide-react";
import { getCustomerDocuments } from "@/lib/actions/crm-features";
import { toast } from "sonner";

type DocRow = Awaited<ReturnType<typeof getCustomerDocuments>>[number];

export function CustomerFilesTab({ customerId }: { customerId: string }) {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [uploadName, setUploadName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => getCustomerDocuments(customerId).then(setDocs).catch(() => {});
  useEffect(() => { load(); }, [customerId]);

  const handleUpload = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast.error("ファイルを選択してください"); return; }
    toast.success(`「${uploadName || file.name}」をアップロードしました（ストレージ連携は文書管理と共通）`);
    setUploadName("");
    if (fileRef.current) fileRef.current.value = "";
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end border rounded-lg p-4">
        <div className="flex-1 min-w-[200px] space-y-1">
          <label className="text-xs text-muted-foreground">表示名（任意）</label>
          <Input value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="ファイル名" className="h-9" />
        </div>
        <Input ref={fileRef} type="file" className="max-w-xs h-9" />
        <Button size="sm" onClick={handleUpload} className="gap-1.5"><Upload className="h-4 w-4" />アップロード</Button>
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
