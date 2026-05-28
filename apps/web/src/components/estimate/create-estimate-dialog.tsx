"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EstimateListItem } from "@/components/estimate/estimate-list-view";

type CreateEstimateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimateList: Pick<EstimateListItem, "id" | "estimate_no" | "title" | "total">[];
  onCreate: (input: { title: string; author?: string; sourceId?: string }) => Promise<{ id: string }>;
  onCreated: (estimateId: string) => void;
};

export function CreateEstimateDialog({
  open,
  onOpenChange,
  estimateList,
  onCreate,
  onCreated,
}: CreateEstimateDialogProps) {
  const { user } = useAuth();
  const defaultAuthor = (user?.user_metadata?.display_name as string | undefined) ?? user?.email ?? "";
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState(defaultAuthor);
  const [sourceId, setSourceId] = useState<string>("none");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(`No.${new Date().getFullYear()}-${String(estimateList.length + 1).padStart(3, "0")}`);
    setAuthor((user?.user_metadata?.display_name as string | undefined) ?? user?.email ?? "");
    setSourceId("none");
  }, [open, estimateList.length, user]);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("見積名を入力してください");
      return;
    }
    setCreating(true);
    try {
      const created = await onCreate({
        title: title.trim(),
        author: author.trim() || undefined,
        sourceId: sourceId === "none" ? undefined : sourceId,
      });
      onOpenChange(false);
      onCreated(created.id);
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : typeof e === "object" && e && "message" in e
            ? String((e as { message: unknown }).message)
            : "不明なエラー";
      toast.error(`作成に失敗: ${message}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>見積を作成</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs">見積名 *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">作成者</Label>
            <Input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="h-9"
              placeholder="作成者名を入力"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">見積もりを参照</Label>
            <Select value={sourceId} onValueChange={setSourceId}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">参照なし（空の見積を作成）</SelectItem>
                {estimateList.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.estimate_no}
                    {e.title ? `（${e.title}）` : ""}・¥{(e.total ?? 0).toLocaleString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">既存の見積を選ぶと、明細を複製します</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            キャンセル
          </Button>
          <Button onClick={() => void handleCreate()} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            {creating ? "作成中..." : "作成する"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
