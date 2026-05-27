"use client";

import { useState, useEffect, useMemo } from "react";
import { addDays, format, isToday, isFuture, isPast, parseISO, startOfDay } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getCustomerTodos, createCustomerTodo, updateCustomerTodo, deleteCustomerTodo } from "@/lib/actions/crm-features";
import { CheckCircle2, Circle, Inbox, Plus, Trash2, CalendarDays, FileText } from "lucide-react";
import { toast } from "sonner";

type TodoRow = Awaited<ReturnType<typeof getCustomerTodos>>[number];
type Bucket = "today" | "upcoming" | "all";

const BUCKETS: { key: Bucket; label: string; description: string }[] = [
  { key: "today", label: "Today", description: "今日・期限切れ" },
  { key: "upcoming", label: "Upcoming", description: "今後の予定" },
  { key: "all", label: "All", description: "すべて" },
];

function matchesBucket(todo: TodoRow, bucket: Bucket): boolean {
  if (bucket === "all") return true;
  if (!todo.due_date) return bucket === "today";
  const d = startOfDay(parseISO(todo.due_date));
  const today = startOfDay(new Date());
  if (bucket === "today") return d <= today;
  return isFuture(d) && !isToday(d);
}

function defaultDueDateForBucket(bucket: Bucket) {
  if (bucket === "today") return format(new Date(), "yyyy-MM-dd");
  if (bucket === "upcoming") return format(addDays(new Date(), 1), "yyyy-MM-dd");
  return "";
}

export function CustomerTodoTab({ customerId }: { customerId: string }) {
  const [todos, setTodos] = useState<TodoRow[]>([]);
  const [bucket, setBucket] = useState<Bucket>("today");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDueDate, setCreateDueDate] = useState(() => defaultDueDateForBucket("today"));
  const [createDescription, setCreateDescription] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      const rows = await getCustomerTodos(customerId);
      setTodos(rows);
      return rows;
    } catch {
      toast.error("ToDoの取得に失敗しました");
      return [];
    }
  };
  useEffect(() => { void load(); }, [customerId]);

  const counts = useMemo(() => ({
    today: todos.filter((t) => matchesBucket(t, "today")).length,
    upcoming: todos.filter((t) => matchesBucket(t, "upcoming")).length,
    all: todos.length,
  }), [todos]);

  const filtered = useMemo(
    () => todos.filter((t) => matchesBucket(t, bucket)),
    [todos, bucket],
  );

  const selected = todos.find((t) => t.id === selectedId);

  const resetCreateForm = (targetBucket = bucket) => {
    setCreateTitle("");
    setCreateDueDate(defaultDueDateForBucket(targetBucket));
    setCreateDescription("");
  };

  const startCreate = () => { setIsCreating(true); resetCreateForm(); };
  const cancelCreate = () => { setIsCreating(false); resetCreateForm(); };

  useEffect(() => {
    if (selectedId && !filtered.some((t) => t.id === selectedId)) {
      setSelectedId(null);
    }
  }, [filtered, selectedId]);

  const selectTodo = (id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
    setIsCreating(false);
  };

  const addTodo = async () => {
    const title = createTitle.trim();
    if (!title) { toast.error("タイトルを入力してください"); return; }
    setAdding(true);
    try {
      const created = await createCustomerTodo({
        customer_id: customerId,
        title,
        due_date: createDueDate || undefined,
        description: createDescription.trim() || undefined,
      });
      const row = created as TodoRow;
      setTodos((prev) => [...prev, row]);
      setIsCreating(false);
      resetCreateForm();
      if (!matchesBucket(row, bucket)) {
        if (matchesBucket(row, "today")) setBucket("today");
        else if (matchesBucket(row, "upcoming")) setBucket("upcoming");
        else setBucket("all");
      }
      toast.success("ToDoを追加しました");
    } catch {
      toast.error("追加に失敗しました");
    } finally {
      setAdding(false);
    }
  };

  const toggleComplete = async (id: string, status: string) => {
    const next = status === "completed" ? "pending" : "completed";
    try {
      await updateCustomerTodo(id, { status: next });
      await load();
    } catch {
      toast.error("更新に失敗しました");
    }
  };

  const deleteSelected = async () => {
    if (!selected) return;
    if (!confirm(`「${selected.title}」を削除しますか？`)) return;
    setDeleting(true);
    try {
      await deleteCustomerTodo(selected.id);
      setSelectedId(null);
      await load();
      toast.success("ToDoを削除しました");
    } catch {
      toast.error("削除に失敗しました");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(140px,160px)_minmax(0,1fr)_minmax(0,1fr)] gap-3 min-h-[360px] items-stretch">
      {/* ① 期限カラム */}
      <Card variant="inset" className="py-0 overflow-hidden">
        <CardHeader className="pb-2 pt-4 px-3 border-b border-border/40">
          <CardTitle className="text-xs font-semibold">期限</CardTitle>
        </CardHeader>
        <div className="p-1.5 space-y-0.5">
          {BUCKETS.map(({ key, label, description }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setBucket(key);
                if (isCreating) resetCreateForm(key);
              }}
              className={cn(
                "w-full text-left px-3 py-2.5 rounded-lg transition-colors",
                bucket === key
                  ? "bg-[#D8EDE4]/60 text-[#0F5132]"
                  : "hover:bg-white/45 dark:hover:bg-white/5 text-foreground",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{label}</span>
                <span className="text-[11px] tabular-nums text-muted-foreground">{counts[key]}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>
            </button>
          ))}
        </div>
      </Card>

      {/* ② ToDo一覧 */}
      <Card variant="inset" className="py-0 overflow-hidden min-w-0 flex flex-col min-h-[360px]">
        <CardHeader className="pb-2 pt-4 px-4 border-b border-border/40 shrink-0">
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold">ToDo一覧</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              {BUCKETS.find((b) => b.key === bucket)?.label} — {filtered.length}件
            </CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            variant={isCreating ? "default" : "outline"}
            className="h-8 shrink-0 gap-1"
            onClick={() => (isCreating ? cancelCreate() : startCreate())}
          >
            <Plus className="h-3.5 w-3.5" />
            {isCreating ? "キャンセル" : "新規"}
          </Button>
        </CardHeader>

        {isCreating && (
          <div className="px-4 py-3 border-b border-border/40 bg-[#D8EDE4]/20 space-y-2 shrink-0">
            <Input
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              className="h-9"
              placeholder="タイトル"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Escape") cancelCreate(); }}
            />
            <Input
              type="date"
              value={createDueDate}
              onChange={(e) => setCreateDueDate(e.target.value)}
              className="h-9"
            />
            <Textarea
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value)}
              className="text-sm min-h-[72px] resize-none"
              placeholder="メモ（任意）"
            />
            <Button size="sm" className="h-9 w-full gap-1.5" disabled={adding} onClick={() => void addTodo()}>
              <Plus className="h-4 w-4" />
              {adding ? "追加中..." : "追加"}
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto divide-y divide-border/40">
          {filtered.length === 0 && !isCreating ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">ToDoなし</p>
              <p className="text-xs text-muted-foreground mt-1">「新規」から追加できます</p>
            </div>
          ) : filtered.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => selectTodo(t.id)}
              className={cn(
                "w-full text-left px-4 py-3 transition-colors",
                selectedId === t.id && !isCreating ? "bg-[#D8EDE4]/40" : "hover:bg-white/45 dark:hover:bg-white/5",
              )}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); void toggleComplete(t.id, t.status); }}
                  className="mt-0.5 shrink-0 text-muted-foreground hover:text-[#0F5132]"
                  aria-label={t.status === "completed" ? "未完了に戻す" : "完了にする"}
                >
                  {t.status === "completed"
                    ? <CheckCircle2 className="h-4 w-4 text-[#0F5132]" />
                    : <Circle className="h-4 w-4" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cn(
                    "text-sm font-medium truncate",
                    t.status === "completed" && "line-through text-muted-foreground",
                  )}>
                    {t.title}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {t.due_date ? (
                      <span className={cn(
                        "text-[11px] tabular-nums",
                        isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date)) && t.status !== "completed"
                          ? "text-red-600 font-medium"
                          : "text-muted-foreground",
                      )}>
                        {format(parseISO(t.due_date), "yyyy/MM/dd", { locale: ja })}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">期限なし</span>
                    )}
                    {t.source === "recording" && (
                      <Badge variant="secondary" className="text-[9px] h-4 px-1.5">録音</Badge>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* ③ ToDo詳細（読み取り専用） */}
      <Card variant="inset" className="py-0 overflow-hidden min-h-[360px] min-w-0 flex flex-col">
        <CardHeader className="pb-2 pt-4 px-4 border-b border-border/40 shrink-0">
          <CardTitle className="text-sm font-semibold">ToDo詳細</CardTitle>
        </CardHeader>

        {selected ? (
          <CardContent className="px-4 py-5 flex flex-col flex-1 gap-4">
            <div className="space-y-3 flex-1">
              <p className="text-sm font-semibold leading-snug">{selected.title}</p>

              <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                {selected.due_date
                  ? <span className={cn(
                      isPast(parseISO(selected.due_date)) && !isToday(parseISO(selected.due_date)) && selected.status !== "completed"
                        ? "text-red-600 font-medium"
                        : "",
                    )}>
                      {format(parseISO(selected.due_date), "yyyy年M月d日（E）", { locale: ja })}
                    </span>
                  : <span>期限なし</span>}
              </div>

              {selected.description && (
                <div className="flex gap-2 text-[12px] text-muted-foreground">
                  <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <p className="whitespace-pre-wrap leading-relaxed">{selected.description}</p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <Badge
                  className={cn(
                    "text-[10px] h-5 border-0",
                    selected.status === "completed"
                      ? "bg-[#D8EDE4] text-[#0F5132]"
                      : "bg-amber-100 text-amber-800",
                  )}
                >
                  {selected.status === "completed" ? "✓ 完了" : "進行中"}
                </Badge>
                {selected.source === "recording" && (
                  <Badge variant="secondary" className="text-[10px] h-5">録音から追加</Badge>
                )}
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {format(new Date(selected.created_at), "yyyy/MM/dd", { locale: ja })} 作成
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-4 border-t border-border/40">
              <Button
                size="sm"
                variant="outline"
                className="h-9"
                onClick={() => void toggleComplete(selected.id, selected.status)}
              >
                {selected.status === "completed" ? "未完了に戻す" : "完了にする"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-9 text-destructive hover:text-destructive ml-auto"
                disabled={deleting}
                onClick={() => void deleteSelected()}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {deleting ? "削除中..." : "削除"}
              </Button>
            </div>
          </CardContent>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">ToDoを選択</p>
            <p className="text-xs text-muted-foreground mt-1">一覧でクリックすると詳細を表示します</p>
          </div>
        )}
      </Card>
    </div>
  );
}
