"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { FilePlus2, Plus, Loader2, Send, Trash2, ArrowRightLeft } from "lucide-react";
import {
  createChangeOrder,
  deleteChangeOrder,
  getChangeOrders,
  sendChangeOrderToCloudSign,
  approveChangeOrder,
} from "@/lib/actions/change-orders";
import type { ChangeOrder } from "@/lib/database.types";

type ChangeOrderRow = ChangeOrder & {
  creator?: { id: string; display_name: string } | null;
};

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft: { label: "下書き", cls: "bg-gray-100 text-gray-600" },
  pending: { label: "確認中", cls: "bg-yellow-100 text-yellow-700" },
  approved: { label: "承認済", cls: "bg-green-100 text-green-700" },
  rejected: { label: "差戻し", cls: "bg-red-100 text-red-600" },
  sent: { label: "送信済", cls: "bg-blue-100 text-blue-700" },
};

interface Props {
  constructionId: string;
  initialOrders: ChangeOrderRow[];
  baseAmount: number;
  onRefresh: () => void;
}

export function ChangeOrderTab({ constructionId, initialOrders, baseAmount, onRefresh }: Props) {
  const [orders, setOrders] = useState(initialOrders);
  const [dialog, setDialog] = useState(false);
  const [preview, setPreview] = useState<ChangeOrderRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    after_amount: "",
    change_reason: "",
  });

  async function handleCreate() {
    if (!form.title.trim() || !form.after_amount) return;
    setSaving(true);
    try {
      const after = Number(form.after_amount);
      const created = await createChangeOrder({
        construction_id: constructionId,
        title: form.title,
        before_amount: baseAmount,
        after_amount: after,
        change_reason: form.change_reason || undefined,
      });
      setOrders(prev => [created as ChangeOrderRow, ...prev]);
      setDialog(false);
      setForm({ title: "", after_amount: "", change_reason: "" });
      toast.success("追加変更を登録しました");
      onRefresh();
    } catch {
      toast.error("登録に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteChangeOrder(id);
      setOrders(prev => prev.filter(o => o.id !== id));
      toast.success("削除しました");
    } catch {
      toast.error("削除に失敗しました");
    }
  }

  async function handleApprove(co: ChangeOrderRow) {
    setApprovingId(co.id);
    try {
      await approveChangeOrder(co.id);
      const refreshed = await getChangeOrders(constructionId);
      setOrders(refreshed as ChangeOrderRow[]);
      toast.success("承認しました。契約金額を更新しました");
      onRefresh();
    } catch {
      toast.error("承認に失敗しました");
    } finally {
      setApprovingId(null);
    }
  }

  async function handleCloudSign(co: ChangeOrderRow) {
    setSendingId(co.id);
    try {
      const { message } = await sendChangeOrderToCloudSign(co.id, [
        { name: "施主", email: "client@example.com" },
      ]);
      const refreshed = await getChangeOrders(constructionId);
      setOrders(refreshed as ChangeOrderRow[]);
      toast.info(message);
    } catch {
      toast.error("クラウドサイン送信に失敗しました");
    } finally {
      setSendingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          見積もりの差分管理・確認書生成（クラウドサイン連携）
        </p>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setDialog(true)}>
          <Plus className="h-3.5 w-3.5" />追加変更を登録
        </Button>
      </div>

      {orders.length === 0 ? (
        <div className="py-14 text-center text-sm text-muted-foreground rounded-xl border border-dashed border-border">
          <FilePlus2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>追加・変更工事の記録がありません</p>
          <p className="text-xs mt-1">変更前後の金額比較と確認書プレビューが利用できます</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(co => {
            const st = STATUS_MAP[co.status] ?? STATUS_MAP.draft;
            return (
              <Card key={co.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm">{co.title}</CardTitle>
                    <Badge variant="outline" className={`text-[11px] ${st.cls}`}>{st.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-[11px] text-muted-foreground">変更前</p>
                      <p className="font-semibold tabular-nums">¥{co.before_amount.toLocaleString()}</p>
                    </div>
                    <div className="flex items-center justify-center">
                      <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-[11px] text-muted-foreground">変更後</p>
                      <p className="font-semibold tabular-nums">¥{co.after_amount.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className={`text-sm font-medium tabular-nums ${co.diff_amount >= 0 ? "text-amber-700" : "text-green-700"}`}>
                    差額: {co.diff_amount >= 0 ? "+" : ""}¥{co.diff_amount.toLocaleString()}
                  </div>
                  {co.change_reason && (
                    <p className="text-xs text-muted-foreground">{co.change_reason}</p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => setPreview(co)}>
                      確認書プレビュー
                    </Button>
                    {co.status === "draft" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => handleApprove(co)}
                        disabled={approvingId === co.id}
                      >
                        {approvingId === co.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "承認して反映"}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1"
                      onClick={() => handleCloudSign(co)}
                      disabled={sendingId === co.id}
                    >
                      {sendingId === co.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                      クラウドサイン送信
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-red-600 ml-auto"
                      onClick={() => handleDelete(co.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 登録ダイアログ */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>追加変更を登録</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>件名</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="例: キッチン仕様変更" />
            </div>
            <div className="space-y-1.5">
              <Label>変更前金額（自動）</Label>
              <Input value={`¥${baseAmount.toLocaleString()}`} disabled />
            </div>
            <div className="space-y-1.5">
              <Label>変更後金額</Label>
              <Input type="number" value={form.after_amount}
                onChange={e => setForm(f => ({ ...f, after_amount: e.target.value }))}
                placeholder="5500000" />
            </div>
            <div className="space-y-1.5">
              <Label>変更理由</Label>
              <Textarea value={form.change_reason}
                onChange={e => setForm(f => ({ ...f, change_reason: e.target.value }))}
                rows={3} placeholder="変更内容の概要" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>キャンセル</Button>
            <Button onClick={handleCreate} disabled={saving || !form.title.trim() || !form.after_amount}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              登録
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 確認書プレビュー */}
      <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>追加変更確認書（プレビュー）</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="space-y-3 text-sm border rounded-lg p-4 bg-muted/20">
              <p className="font-semibold">{preview.title}</p>
              <p>変更前契約金額: ¥{preview.before_amount.toLocaleString()}</p>
              <p>変更後契約金額: ¥{preview.after_amount.toLocaleString()}</p>
              <p className="font-medium">
                増減額: {preview.diff_amount >= 0 ? "+" : ""}¥{preview.diff_amount.toLocaleString()}
              </p>
              {preview.change_reason && <p className="text-muted-foreground">{preview.change_reason}</p>}
              <p className="text-xs text-muted-foreground pt-2">
                ※ クラウドサイン連携時はこの内容で確認書を送信します
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
