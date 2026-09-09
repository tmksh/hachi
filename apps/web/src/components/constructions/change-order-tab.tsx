"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FilePlus2, Plus, Loader2, Send, Trash2, ArrowRightLeft, RotateCcw, CheckCircle2, Undo2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  createChangeOrder,
  deleteChangeOrder,
  sendChangeOrderToCloudSign,
  approveChangeOrder,
  submitChangeOrderApproval,
  rejectChangeOrder,
} from "@/lib/actions/change-orders";
import { fetchChangeOrders, fetchEstimate } from "@/lib/queries/details";
import { fetchProfiles } from "@/lib/queries/lists";
import type { ChangeOrder } from "@/lib/database.types";
import type { EstimateListItem } from "@/components/estimate/estimate-list-view";

type ChangeOrderRow = ChangeOrder & {
  creator?: { id: string; display_name: string } | null;
};

type EstimateItem = {
  id?: string;
  name: string;
  selling_amount: number;
  quantity?: number;
  unit?: string;
};

type DiffLine = {
  name: string;
  amount: number;
  type: "added" | "removed" | "changed";
};

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft: { label: "下書き", cls: "bg-gray-100 text-gray-600" },
  pending: { label: "確認中", cls: "bg-yellow-100 text-yellow-700" },
  approved: { label: "承認済", cls: "bg-green-100 text-green-700" },
  rejected: { label: "差戻し", cls: "bg-red-100 text-red-600" },
  sent: { label: "送信済", cls: "bg-blue-100 text-blue-700" },
};

function formatYen(n: number) {
  return `¥${Math.abs(n).toLocaleString()}`;
}

function computeDiff(beforeItems: EstimateItem[], afterItems: EstimateItem[]): DiffLine[] {
  const beforeMap = new Map<string, number>();
  for (const item of beforeItems) {
    beforeMap.set(item.name, (beforeMap.get(item.name) ?? 0) + item.selling_amount);
  }
  const afterMap = new Map<string, number>();
  for (const item of afterItems) {
    afterMap.set(item.name, (afterMap.get(item.name) ?? 0) + item.selling_amount);
  }

  const lines: DiffLine[] = [];
  // removed or changed
  for (const [name, beforeAmt] of beforeMap) {
    const afterAmt = afterMap.get(name);
    if (afterAmt === undefined) {
      lines.push({ name, amount: -beforeAmt, type: "removed" });
    } else if (afterAmt !== beforeAmt) {
      lines.push({ name, amount: afterAmt - beforeAmt, type: "changed" });
    }
  }
  // added
  for (const [name, afterAmt] of afterMap) {
    if (!beforeMap.has(name)) {
      lines.push({ name, amount: afterAmt, type: "added" });
    }
  }
  return lines;
}

interface ConstructionInfo {
  title: string;
  constructionNo?: string | null;
  projectNo?: string | null;
  customerName?: string | null;
  location?: string | null;
  assigneeName?: string | null;
}

interface Props {
  constructionId: string;
  initialOrders: ChangeOrderRow[];
  baseAmount: number;
  estimateList?: EstimateListItem[];
  constructionInfo?: ConstructionInfo;
  onRefresh: () => void;
}

export function ChangeOrderTab({ constructionId, initialOrders, baseAmount, estimateList = [], constructionInfo, onRefresh }: Props) {
  const [orders, setOrders] = useState(initialOrders);
  const [dialog, setDialog] = useState(false);
  const [preview, setPreview] = useState<ChangeOrderRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  // 承認申請モーダル（No.14）
  const [submitTarget, setSubmitTarget] = useState<ChangeOrderRow | null>(null);
  const [approverId, setApproverId] = useState("");
  const [submitComment, setSubmitComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [profiles, setProfiles] = useState<{ id: string; display_name: string }[]>([]);

  useEffect(() => {
    fetchProfiles()
      .then(p => setProfiles(p.map(x => ({ id: x.id, display_name: x.display_name }))))
      .catch(() => {});
  }, []);

  // フォーム状態
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10).replace(/-/g, "/"));
  const [beforeEstId, setBeforeEstId] = useState("");
  const [afterEstId, setAfterEstId] = useState("");

  // 差分計算
  const [diffLines, setDiffLines] = useState<DiffLine[]>([]);
  const [diffLoading, setDiffLoading] = useState(false);
  const [beforeTotal, setBeforeTotal] = useState(0);
  const [afterTotal, setAfterTotal] = useState(0);

  const resetDialog = () => {
    setTitle("");
    setDate(new Date().toISOString().slice(0, 10).replace(/-/g, "/"));
    setBeforeEstId("");
    setAfterEstId("");
    setDiffLines([]);
    setBeforeTotal(0);
    setAfterTotal(0);
  };

  const fetchDiff = useCallback(async (bId: string, aId: string) => {
    if (!bId || !aId) return;
    setDiffLoading(true);
    try {
      const [bEst, aEst] = await Promise.all([fetchEstimate(bId), fetchEstimate(aId)]);
      const bItems = (bEst.items ?? []) as EstimateItem[];
      const aItems = (aEst.items ?? []) as EstimateItem[];
      setBeforeTotal(bEst.subtotal ?? 0);
      setAfterTotal(aEst.subtotal ?? 0);
      setDiffLines(computeDiff(bItems, aItems));
    } catch {
      toast.error("見積の読み込みに失敗しました");
    } finally {
      setDiffLoading(false);
    }
  }, []);

  useEffect(() => {
    if (beforeEstId && afterEstId) {
      fetchDiff(beforeEstId, afterEstId);
    } else {
      setDiffLines([]);
    }
  }, [beforeEstId, afterEstId, fetchDiff]);

  async function handleCreate() {
    if (!title.trim() || !beforeEstId || !afterEstId) return;
    setSaving(true);
    try {
      const beforeEst = estimateList.find(e => e.id === beforeEstId);
      const afterEst  = estimateList.find(e => e.id === afterEstId);
      const meta = {
        _type: "meta" as const,
        before_estimate_id: beforeEstId,
        after_estimate_id: afterEstId,
        before_label: beforeEst ? `${beforeEst.estimate_no}（${beforeEst.title ?? "無題"}）` : beforeEstId,
        after_label:  afterEst  ? `${afterEst.estimate_no}（${afterEst.title ?? "無題"}）`   : afterEstId,
        diff_count: diffLines.length,
        date: date,
      };
      const created = await createChangeOrder({
        construction_id: constructionId,
        title: title.trim(),
        before_amount: beforeTotal,
        after_amount: afterTotal,
        estimate_id: afterEstId,
        before_items: [meta],
        after_items: diffLines,
        change_reason: undefined,
      });
      setOrders(prev => [created as ChangeOrderRow, ...prev]);
      setDialog(false);
      resetDialog();
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

  async function handleSubmitApproval() {
    if (!submitTarget) return;
    if (!approverId) { toast.error("承認者を選択してください"); return; }
    if (!submitComment.trim()) { toast.error("申請コメントを入力してください"); return; }
    setSubmitting(true);
    try {
      await submitChangeOrderApproval({
        changeOrderId: submitTarget.id,
        approverId,
        comment: submitComment.trim(),
      });
      const refreshed = await fetchChangeOrders(constructionId);
      setOrders(refreshed as ChangeOrderRow[]);
      toast.success("承認申請を送信しました。承認者に通知されます");
      setSubmitTarget(null);
      setApproverId("");
      setSubmitComment("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "申請に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApprove(co: ChangeOrderRow) {
    setApprovingId(co.id);
    try {
      await approveChangeOrder(co.id);
      const refreshed = await fetchChangeOrders(constructionId);
      setOrders(refreshed as ChangeOrderRow[]);
      toast.success("承認しました。契約金額を更新しました");
      onRefresh();
    } catch {
      toast.error("承認に失敗しました");
    } finally {
      setApprovingId(null);
    }
  }

  async function handleReject(co: ChangeOrderRow) {
    setRejectingId(co.id);
    try {
      await rejectChangeOrder(co.id);
      const refreshed = await fetchChangeOrders(constructionId);
      setOrders(refreshed as ChangeOrderRow[]);
      toast.success("差戻しました。申請者に通知されます");
    } catch {
      toast.error("差戻しに失敗しました");
    } finally {
      setRejectingId(null);
    }
  }

  async function handleCloudSign(co: ChangeOrderRow) {
    setSendingId(co.id);
    try {
      const { message } = await sendChangeOrderToCloudSign(co.id, [
        { name: "施主", email: "client@example.com" },
      ]);
      const refreshed = await fetchChangeOrders(constructionId);
      setOrders(refreshed as ChangeOrderRow[]);
      toast.info(message);
    } catch {
      toast.error("クラウドサイン送信に失敗しました");
    } finally {
      setSendingId(null);
    }
  }

  const diffTotal = afterTotal - beforeTotal;
  const canCreate = title.trim() && beforeEstId && afterEstId && !diffLoading;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          見積もりの差分管理・確認書生成（クラウドサイン連携）
        </p>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => { resetDialog(); setDialog(true); }}>
          <Plus className="h-3.5 w-3.5" />追加変更を登録
        </Button>
      </div>

      {orders.length === 0 ? (
        <div className="py-14 text-center text-sm text-muted-foreground rounded-xl border border-dashed border-border">
          <FilePlus2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>追加・変更工事の記録がありません</p>
          <p className="text-xs mt-1">変更前後の見積を選択して差分を自動計算できます</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map(co => {
            const st = STATUS_MAP[co.status] ?? STATUS_MAP.draft;
            // before_items[0] にメタデータが格納されている場合に取得
            const meta = Array.isArray(co.before_items) && co.before_items.length > 0
              ? (co.before_items[0] as { _type?: string; before_label?: string; after_label?: string; diff_count?: number; date?: string } | null)
              : null;
            const hasEstMeta = meta?._type === "meta";

            // フォールバック: estimate_id から estimateList で after ラベルを補完
            const afterEstLabel = hasEstMeta
              ? meta!.after_label
              : co.estimate_id
                ? (() => { const e = estimateList.find(x => x.id === co.estimate_id); return e ? `${e.estimate_no}（${e.title ?? "無題"}）` : null; })()
                : null;
            // before ラベル: メタデータあり → ラベル, なし → 変更前金額で代替
            const beforeEstLabel = hasEstMeta
              ? meta!.before_label
              : afterEstLabel
                ? `変更前（¥${co.before_amount.toLocaleString()}）`
                : null;

            // 日付: メタデータ > created_at
            const displayDate = (hasEstMeta && meta!.date)
              ? meta!.date
              : co.created_at
                ? new Date(co.created_at).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "/")
                : null;

            const diffCount = hasEstMeta && meta!.diff_count != null ? meta!.diff_count : null;

            return (
              <div key={co.id} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
                {/* タイトル + サブ情報 */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{co.title}</span>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${st.cls}`}>{st.label}</Badge>
                  </div>
                  {(beforeEstLabel || afterEstLabel) && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 min-w-0">
                      {beforeEstLabel && <span className="truncate">{beforeEstLabel}</span>}
                      {beforeEstLabel && afterEstLabel && <ArrowRightLeft className="h-2.5 w-2.5 shrink-0" />}
                      {afterEstLabel && <span className="truncate">{afterEstLabel}</span>}
                    </div>
                  )}
                </div>

                {/* 差額・日付・件数 */}
                <div className="flex items-center gap-2 text-xs tabular-nums shrink-0">
                  <span className={`font-semibold ${co.diff_amount >= 0 ? "text-amber-700" : "text-green-700"}`}>
                    {co.diff_amount >= 0 ? "+" : ""}¥{co.diff_amount.toLocaleString()}
                  </span>
                  {displayDate && <span className="text-muted-foreground">{displayDate}</span>}
                  {diffCount != null && <span className="text-muted-foreground">{diffCount}件の変更</span>}
                </div>

                {/* アクション */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setPreview(co)}>
                    プレビュー
                  </Button>
                  {(co.status === "draft" || co.status === "rejected") && (
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                      onClick={() => { setSubmitTarget(co); setApproverId(""); setSubmitComment(""); }}>
                      <Send className="h-3 w-3" />
                      {co.status === "rejected" ? "再申請" : "承認申請"}
                    </Button>
                  )}
                  {co.status === "pending" && (
                    <>
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        onClick={() => handleApprove(co)} disabled={approvingId === co.id}>
                        {approvingId === co.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                        承認
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1 border-rose-300 text-rose-700 hover:bg-rose-50"
                        onClick={() => handleReject(co)} disabled={rejectingId === co.id}>
                        {rejectingId === co.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />}
                        差戻し
                      </Button>
                    </>
                  )}
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleCloudSign(co)}
                    disabled={sendingId === co.id || (co.status !== "approved" && co.status !== "sent")}
                    title={co.status !== "approved" && co.status !== "sent" ? "承認後に送信できます" : undefined}>
                    {sendingId === co.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    クラウドサイン送信
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(co.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 登録ダイアログ */}
      <Dialog open={dialog} onOpenChange={(open) => { setDialog(open); if (!open) resetDialog(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>追加変更を作成</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            {/* 変更名 */}
            <div className="space-y-1.5">
              <Label>変更名 <span className="text-destructive">*</span></Label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="例: 電気工事 仕様変更"
              />
            </div>

            {/* 日付 */}
            <div className="space-y-1.5">
              <Label>日付</Label>
              <Input
                value={date}
                onChange={e => setDate(e.target.value)}
                placeholder="2026/04/20"
              />
            </div>

            {/* 変更前の見積 */}
            <div className="space-y-1.5">
              <Label>変更前の見積 <span className="text-destructive">*</span></Label>
              {estimateList.length === 0 ? (
                <p className="text-xs text-muted-foreground py-1">
                  この工事に紐づく見積がありません
                </p>
              ) : (
                <Select value={beforeEstId} onValueChange={setBeforeEstId}>
                  <SelectTrigger>
                    <SelectValue placeholder="見積を選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    {estimateList.map(e => (
                      <SelectItem key={e.id} value={e.id} disabled={e.id === afterEstId}>
                        {e.estimate_no}（{e.title ?? "無題"}）（¥{(e.total ?? 0).toLocaleString()}）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* 変更後の見積 */}
            <div className="space-y-1.5">
              <Label>変更後の見積 <span className="text-destructive">*</span></Label>
              {estimateList.length === 0 ? (
                <p className="text-xs text-muted-foreground py-1">
                  この工事に紐づく見積がありません
                </p>
              ) : (
                <Select value={afterEstId} onValueChange={setAfterEstId}>
                  <SelectTrigger>
                    <SelectValue placeholder="見積を選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    {estimateList.map(e => (
                      <SelectItem key={e.id} value={e.id} disabled={e.id === beforeEstId}>
                        {e.estimate_no}（{e.title ?? "無題"}）（¥{(e.total ?? 0).toLocaleString()}）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* 差分プレビュー */}
            {(diffLoading || (beforeEstId && afterEstId)) && (
              <div className="rounded-lg border bg-muted/20 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
                  {diffLoading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    : <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                  }
                  <span className="text-xs font-medium text-muted-foreground">
                    {diffLoading ? "計算中..." : `差分プレビュー（${diffLines.length}件）`}
                  </span>
                </div>
                {!diffLoading && (
                  <>
                    <div className="max-h-48 overflow-y-auto divide-y divide-border/40">
                      {diffLines.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">差分はありません</p>
                      ) : (
                        diffLines.map((line, i) => (
                          <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                            <span className="flex items-center gap-1.5 min-w-0">
                              <span className={
                                line.type === "added" ? "text-emerald-600 font-medium" :
                                line.type === "removed" ? "text-rose-600 font-medium" :
                                "text-amber-600 font-medium"
                              }>
                                {line.type === "added" ? "追加" : line.type === "removed" ? "削除" : "変更"}
                              </span>
                              <span className="truncate text-foreground">{line.name}</span>
                            </span>
                            <span className={`tabular-nums shrink-0 ml-2 font-medium ${line.amount >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                              {line.amount >= 0 ? "+" : ""}{formatYen(line.amount)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/30 text-xs font-semibold">
                      <span className="text-muted-foreground">差分合計（税抜）</span>
                      <span className={diffTotal >= 0 ? "text-emerald-700" : "text-rose-600"}>
                        {diffTotal >= 0 ? "+" : ""}¥{Math.abs(diffTotal).toLocaleString()}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialog(false); resetDialog(); }}>キャンセル</Button>
            <Button onClick={handleCreate} disabled={saving || !canCreate}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              作成する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 承認申請ダイアログ（No.14） */}
      <Dialog open={!!submitTarget} onOpenChange={o => { if (!o) setSubmitTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>追加変更工事の承認申請</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            {submitTarget && (
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                <p className="font-medium">{submitTarget.title}</p>
                <p className={`text-xs tabular-nums mt-0.5 ${submitTarget.diff_amount >= 0 ? "text-amber-700" : "text-green-700"}`}>
                  差額 {submitTarget.diff_amount >= 0 ? "+" : ""}¥{submitTarget.diff_amount.toLocaleString()}
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>承認者 <span className="text-destructive">*</span></Label>
              <Select value={approverId} onValueChange={setApproverId}>
                <SelectTrigger>
                  <SelectValue placeholder="承認者（上長）を選択" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>申請コメント <span className="text-destructive">*</span></Label>
              <Textarea
                value={submitComment}
                onChange={e => setSubmitComment(e.target.value)}
                rows={3}
                placeholder="例: 施主要望による仕様変更。差額は追加請負で対応。"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitTarget(null)}>キャンセル</Button>
            <Button onClick={handleSubmitApproval} disabled={submitting || !approverId || !submitComment.trim()}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              申請する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 確認書プレビュー */}
      <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
        <DialogContent className="w-[920px] max-w-[97vw] sm:max-w-[920px] max-h-[92vh] overflow-y-auto bg-gray-100 p-5">
          {preview && (() => {
            const pmeta = Array.isArray(preview.before_items) && preview.before_items.length > 0
              ? (preview.before_items[0] as { _type?: string; before_label?: string; after_label?: string; diff_count?: number; date?: string } | null)
              : null;
            const haspmeta = pmeta?._type === "meta";
            const diffItems = Array.isArray(preview.after_items)
              ? (preview.after_items as { name: string; amount: number; type: string }[])
              : [];
            const subtotal = preview.diff_amount;
            const tax = Math.floor(Math.abs(subtotal) * 0.1) * (subtotal >= 0 ? 1 : -1);
            const totalWithTax = subtotal + tax;
            const beforeWithTax = preview.before_amount + Math.floor(preview.before_amount * 0.1);
            const afterWithTax  = preview.after_amount  + Math.floor(preview.after_amount  * 0.1);
            const itemDate = haspmeta && pmeta!.date ? pmeta!.date : "";
            const [dateM, dateD] = itemDate.includes("/")
              ? itemDate.split("/").slice(1)
              : ["", ""];

            return (
              /* A4 シート（幅可変・最低A4高） */
              <div className="bg-white text-black font-sans shadow-lg mx-auto"
                style={{ width: "100%", maxWidth: "830px", minHeight: "1174px", padding: "52px 60px", fontSize: "13px", lineHeight: "1.7", boxSizing: "border-box" }}>

                {/* タイトル */}
                <h1 style={{ fontSize: "24px", fontWeight: "bold", letterSpacing: "0.18em", textAlign: "center", marginBottom: "32px" }}>
                  追加・変更工事　確認書
                </h1>

                {/* 基本情報テーブル + ロゴ */}
                <div style={{ display: "flex", gap: "20px", alignItems: "flex-start", marginBottom: "20px" }}>
                  <table style={{ flex: 1, borderCollapse: "collapse", fontSize: "13px" }}>
                    <tbody>
                      {[
                        ["注　文　者", constructionInfo?.customerName ?? "－", true],
                        ["案　件　名", constructionInfo?.title ?? preview.title, false],
                        ["場　　　所", constructionInfo?.location ?? "－", false],
                        ["担　当　者", constructionInfo?.assigneeName ?? "－", false],
                      ].map(([label, value, hasSama]) => (
                        <tr key={label as string}>
                          <td style={{ border: "1px solid #999", background: "#dcefe8", padding: "9px 12px", width: "92px", fontWeight: 600, whiteSpace: "nowrap" }}>{label}</td>
                          <td colSpan={hasSama ? 1 : 2} style={{ border: "1px solid #999", padding: "9px 12px" }}>{value}</td>
                          {hasSama && <td style={{ border: "1px solid #999", width: "32px", textAlign: "center", color: "#555" }}>様</td>}
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={3} style={{ border: "1px solid #999", padding: "7px 12px", textAlign: "center", fontSize: "12px", color: "#555" }}>
                          物件No　{constructionInfo?.projectNo ?? constructionInfo?.constructionNo ?? "－"}　　　工事No　{constructionInfo?.constructionNo ?? "－"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  {/* ロゴボックス */}
                  <div style={{ width: "150px", height: "140px", border: "1px solid #ddd", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px", flexShrink: 0 }}>
                    <svg width="70" height="58" viewBox="0 0 70 58" fill="none">
                      {/* 縦バー4本 + 上下の横線でHHのロゴを表現 */}
                      <rect x="6"  y="4" width="6" height="50" fill="#1a1a1a" />
                      <rect x="22" y="4" width="6" height="50" fill="#1a1a1a" />
                      <rect x="42" y="4" width="6" height="50" fill="#1a1a1a" />
                      <rect x="58" y="4" width="6" height="50" fill="#1a1a1a" />
                      <rect x="6"  y="14" width="22" height="5" fill="#1a1a1a" />
                      <rect x="42" y="14" width="22" height="5" fill="#1a1a1a" />
                      <rect x="6"  y="39" width="22" height="5" fill="#1a1a1a" />
                      <rect x="42" y="39" width="22" height="5" fill="#1a1a1a" />
                    </svg>
                    <div style={{ fontSize: "15px", fontWeight: "bold", letterSpacing: "0.28em", paddingLeft: "0.28em" }}>BRIDGE</div>
                  </div>
                </div>

                <p style={{ fontSize: "12px", color: "#666", marginBottom: "16px" }}>注文者は下記の通り内容の追加・変更内容を確認しました。改めて本紙を含めた契約書を用意します。</p>

                {/* 明細テーブル */}
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "#dcefe8" }}>
                      <th style={{ border: "1px solid #999", padding: "10px 6px", width: "76px", textAlign: "center" }}>日付</th>
                      <th style={{ border: "1px solid #999", padding: "10px 12px", textAlign: "center" }}>追加・変更内容</th>
                      <th style={{ border: "1px solid #999", padding: "10px 6px", width: "120px", textAlign: "center" }}>金額（税抜）</th>
                      <th style={{ border: "1px solid #999", padding: "10px 6px", width: "84px", textAlign: "center", fontSize: "12px" }}>お客様<br />確認印</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffItems.map((item, i) => (
                      <tr key={i}>
                        <td style={{ border: "1px solid #999", padding: "9px 6px", textAlign: "center" }}>
                          {dateM && dateD ? `${dateM}月　${dateD}日` : ""}
                        </td>
                        <td style={{ border: "1px solid #999", padding: "9px 12px" }}>
                          {item.name}　{item.type === "removed" ? "削除" : item.type === "added" ? "追加" : "変更"}
                        </td>
                        <td style={{ border: "1px solid #999", padding: "9px 10px", textAlign: "right", whiteSpace: "nowrap", color: item.amount < 0 ? "#c0392b" : "inherit" }}>
                          {item.amount < 0 ? `-${Math.abs(item.amount).toLocaleString()}` : item.amount.toLocaleString()}　円
                        </td>
                        <td style={{ border: "1px solid #999" }} />
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={2} style={{ border: "1px solid #999", padding: "9px 12px", textAlign: "center", fontWeight: 600 }}>小計</td>
                      <td style={{ border: "1px solid #999", padding: "9px 10px", textAlign: "right", background: "#dcefe8", fontWeight: 600, whiteSpace: "nowrap" }}>
                        {subtotal.toLocaleString()}　円
                      </td>
                      <td style={{ border: "1px solid #999" }} />
                    </tr>
                    <tr>
                      <td colSpan={2} style={{ border: "1px solid #999", padding: "9px 12px", textAlign: "center", fontWeight: 600 }}>消費税（10%）</td>
                      <td style={{ border: "1px solid #999", padding: "9px 10px", textAlign: "right", whiteSpace: "nowrap" }}>{tax.toLocaleString()}　円</td>
                      <td style={{ border: "1px solid #999" }} />
                    </tr>
                    <tr>
                      <td colSpan={2} style={{ border: "1px solid #999", padding: "9px 12px", textAlign: "center", fontWeight: 600 }}>合計金額（税込）</td>
                      <td style={{ border: "1px solid #999", padding: "9px 10px", textAlign: "right", background: "#dcefe8", fontWeight: 600, whiteSpace: "nowrap" }}>{totalWithTax.toLocaleString()}　円</td>
                      <td style={{ border: "1px solid #999" }} />
                    </tr>
                    <tr>
                      <td colSpan={2} style={{ border: "1px solid #999", padding: "8px 12px", textAlign: "center", fontSize: "12px", color: "#444" }}>
                        変更後見積合計金額（税込）<br />
                        <span style={{ color: "#999", fontSize: "11px" }}>{haspmeta ? pmeta!.after_label : ""}</span>
                      </td>
                      <td style={{ border: "1px solid #999", padding: "8px 10px", textAlign: "right", whiteSpace: "nowrap" }}>{afterWithTax.toLocaleString()}　円</td>
                      <td style={{ border: "1px solid #999" }} />
                    </tr>
                    <tr>
                      <td colSpan={2} style={{ border: "1px solid #999", padding: "8px 12px", textAlign: "center", fontSize: "12px", color: "#444" }}>
                        当初請負契約金額（税込）<br />
                        <span style={{ color: "#999", fontSize: "11px" }}>{haspmeta ? pmeta!.before_label : ""}</span>
                      </td>
                      <td style={{ border: "1px solid #999", padding: "8px 10px", textAlign: "right", background: "#fdf0d5", fontWeight: 600, whiteSpace: "nowrap" }}>{beforeWithTax.toLocaleString()}　円</td>
                      <td style={{ border: "1px solid #999" }} />
                    </tr>
                    <tr>
                      <td colSpan={2} style={{ border: "1px solid #999", padding: "11px 12px", textAlign: "center", fontWeight: "bold", fontSize: "13px" }}>
                        追加変更金額一式（税込）＋当初請負契約金額（税込）
                      </td>
                      <td style={{ border: "1px solid #999", padding: "11px 10px", textAlign: "right", background: "#f4a93c", color: "#3a2500", fontWeight: "bold", fontSize: "16px", whiteSpace: "nowrap" }}>
                        {afterWithTax.toLocaleString()}　円
                      </td>
                      <td style={{ border: "1px solid #999" }} />
                    </tr>
                  </tbody>
                </table>

                {/* フッター */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "40px" }}>
                  <div style={{ border: "1px solid #bbb", width: "130px", paddingTop: "6px", textAlign: "center", fontSize: "12px", color: "#666" }}>
                    施工者確認欄
                    <div style={{ borderTop: "1px dashed #ccc", margin: "6px 10px 10px", height: "56px" }} />
                  </div>
                </div>
                <div style={{ fontSize: "12px", color: "#666", marginTop: "20px", lineHeight: "2" }}>
                  <p>※ 本書は追加・変更工事の内容と金額を確認するためのものです。</p>
                  <p>※ お客様確認印を押印の上、ご返送ください。</p>
                </div>
                <div style={{ textAlign: "right", fontSize: "12px", color: "#888", marginTop: "16px" }}>
                  文書番号：{constructionInfo?.constructionNo ?? "－"}　　作成日：{itemDate || new Date().toLocaleDateString("ja-JP")}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
