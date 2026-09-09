"use client";

import { useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Send, Users, Pencil, Trash2, Save, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  addAnnouncementComment,
  updateAnnouncement, deleteAnnouncement,
} from "@/lib/actions/announcements";
import { fetchAnnouncement } from "@/lib/queries/portal";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Detail = Awaited<ReturnType<typeof fetchAnnouncement>>;
type AnnouncementReadRow = { user_id: string; read_at: string; display_name: string };

const ROLE_ORDER_LIST: Role[] = [
  ROLES.HQ_ADMIN,
  ROLES.HQ_ADMIN,
  ROLES.CONTRACTOR_ADMIN,
  ROLES.EMPLOYEE,
];

type CirculationDetailClientProps = {
  initialData: Detail | null;
};

function CirculationDetailContent({ initialData }: CirculationDetailClientProps) {
  const { id } = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const [data, setData] = useState<Detail | null>(initialData);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editPinned, setEditPinned] = useState(false);
  const [editUrgent, setEditUrgent] = useState(false);
  const [editTargetType, setEditTargetType] = useState<"all" | "roles">("all");
  const [editTargetRoles, setEditTargetRoles] = useState<Set<Role>>(new Set());
  const [editDueDate, setEditDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const reload = () => {
    if (id) fetchAnnouncement(id as string).then(setData).catch(() => {});
  };

  const handleComment = async () => {
    if (!comment.trim()) return;
    setSending(true);
    try {
      await addAnnouncementComment(id as string, comment.trim());
      setComment("");
      reload();
      toast.success("コメントしました");
    } catch { toast.error("失敗"); } finally { setSending(false); }
  };

  const openEdit = () => {
    if (!data) return;
    setEditTitle(data.title);
    setEditBody(data.body);
    setEditPinned(data.pinned ?? false);
    setEditUrgent(data.is_urgent ?? false);
    setEditTargetType((data.target_type as "all" | "roles") ?? "all");
    setEditTargetRoles(new Set((data.target_roles as Role[] | null) ?? []));
    setEditDueDate(data.due_date ?? "");
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editTitle.trim() || !editBody.trim()) {
      toast.error("タイトルと本文を入力してください");
      return;
    }
    setSaving(true);
    try {
      await updateAnnouncement(id as string, {
        title: editTitle.trim(),
        body: editBody.trim(),
        pinned: editPinned,
        is_urgent: editUrgent,
        target_type: editTargetType,
        target_roles: editTargetType === "roles" ? Array.from(editTargetRoles) : [],
        due_date: editDueDate || null,
      });
      toast.success("更新しました");
      setEditOpen(false);
      reload();
    } catch { toast.error("更新に失敗しました"); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteAnnouncement(id as string);
      toast.success("削除しました");
      router.refresh();
      router.push("/circulation");
    } catch { toast.error("削除に失敗しました"); } finally { setDeleting(false); }
  };

  const toggleEditRole = (role: Role) => {
    setEditTargetRoles(prev => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role); else next.add(role);
      return next;
    });
  };

  const canEdit = data && (
    data.author_id === profile?.id ||
    profile?.role === "hq_admin"
  );

  if (!data) return (
    <div className="p-4 md:p-8">
      <Link href="/circulation" className="text-sm text-muted-foreground flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" />戻る
      </Link>
      <p className="mt-4">見つかりません</p>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/circulation" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />一覧に戻る
        </Link>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={openEdit}>
              <Pencil className="h-3.5 w-3.5" />編集
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-3.5 w-3.5" />削除
            </Button>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          {data.is_urgent && <Badge variant="destructive">緊急</Badge>}
          {data.pinned && <Badge variant="secondary">固定</Badge>}
          {data.target_type === "roles" && Array.isArray(data.target_roles) && data.target_roles.length > 0 && (
            <Badge variant="outline" className="gap-1">
              <Users className="h-3 w-3" />
              {(data.target_roles as Role[]).map(r => ROLE_LABELS[r] ?? r).join("・")}
            </Badge>
          )}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{data.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {data.author?.display_name ?? "-"} · {format(parseISO(data.published_at), "yyyy年M月d日 HH:mm", { locale: ja })}
          {data.due_date && <span className="ml-2">期限: {data.due_date}</span>}
          {data.current_user_read && (
            <span className="ml-2 inline-flex items-center gap-1 text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />既読
            </span>
          )}
        </p>
      </div>

      {data.reads && data.reads.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-semibold mb-2">既読者（{data.reads.length}名）</p>
            <ul className="space-y-1.5 max-h-40 overflow-y-auto">
              {data.reads.map((r: AnnouncementReadRow) => (
                <li key={r.user_id} className="flex items-center justify-between text-sm gap-2">
                  <span>{r.display_name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {format(parseISO(r.read_at), "M/d HH:mm", { locale: ja })}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-5">
          <div className="prose prose-sm max-w-none whitespace-pre-wrap">{data.body}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">コメント</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(data.comments ?? []).map((c: { id: string; user?: { display_name: string } | null; message: string; created_at: string }) => (
            <div key={c.id} className="border-b pb-3 last:border-0">
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">{c.user?.display_name ?? "-"}</span>
                <span className="text-muted-foreground">{format(parseISO(c.created_at), "M/d HH:mm", { locale: ja })}</span>
              </div>
              <p className="text-sm">{c.message}</p>
            </div>
          ))}
          <div className="flex gap-2">
            <Textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="コメントを入力..." rows={2} className="flex-1" />
            <Button onClick={handleComment} disabled={sending || !comment.trim()} className="self-end">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>お知らせを編集</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 space-y-4 py-2 pr-1">
            <div className="space-y-2">
              <Label>タイトル *</Label>
              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>本文 *</Label>
              <Textarea rows={8} value={editBody} onChange={e => setEditBody(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>通知対象</Label>
              <div className="flex gap-2">
                {(["all", "roles"] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setEditTargetType(t)}
                    className={cn(
                      "flex-1 rounded-lg border p-2.5 text-left transition-colors text-sm",
                      editTargetType === t
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "hover:bg-muted/40"
                    )}
                  >
                    {t === "all" ? "全員" : "ロール絞り込み"}
                  </button>
                ))}
              </div>
              {editTargetType === "roles" && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {ROLE_ORDER_LIST.map(role => (
                    <label key={role} className={cn(
                      "flex items-center gap-2 rounded-md border bg-background p-2.5 cursor-pointer",
                      editTargetRoles.has(role) ? "border-primary/50" : "hover:bg-muted/40"
                    )}>
                      <Checkbox checked={editTargetRoles.has(role)} onCheckedChange={() => toggleEditRole(role)} />
                      <span className="text-sm">{ROLE_LABELS[role]}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>期限</Label>
                <Input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} />
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={editPinned} onCheckedChange={setEditPinned} />
                  <Label>ピン留め</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editUrgent} onCheckedChange={setEditUrgent} />
                  <Label>緊急</Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 pt-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>キャンセル</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>このお知らせを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              削除すると元に戻せません。コメントも含めて全て削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function CirculationDetailClient(props: CirculationDetailClientProps) {
  return (
    <Suspense fallback={<div className="p-4 md:p-6 space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64" /></div>}>
      <CirculationDetailContent {...props} />
    </Suspense>
  );
}
