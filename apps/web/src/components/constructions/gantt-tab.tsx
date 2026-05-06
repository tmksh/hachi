"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createConstructionTask,
  updateConstructionTask,
  deleteConstructionTask,
} from "@/lib/actions/constructions";

type Task = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  progress: number;
  status: string;
  assigned_to?: string | null;
};

type ViewMode = "day" | "week" | "month";

const STATUS_OPTIONS = [
  { value: "not_started", label: "未着手" },
  { value: "in_progress", label: "進行中" },
  { value: "completed",   label: "完了" },
  { value: "on_hold",     label: "保留" },
];

interface Props {
  constructionId: string;
  initialTasks: Task[];
}

/* ── 日付ユーティリティ ── */
function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}
function fmtShort(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function getDaysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/* セル幅 */
const CELL_W: Record<ViewMode, number> = { day: 32, week: 52, month: 28 };
/* 左固定エリア幅（名前列 + 日付2列） */
const COL_NAME  = 200;
const COL_DATE  = 90;
const LEFT_W    = COL_NAME + COL_DATE * 2;
const ROW_H     = 44;
const HEADER_H  = 58; // 月ラベル行 + 日付行

const EMPTY_FORM = { name: "", start_date: "", end_date: "", status: "not_started", description: "" };

/* ステータス色 */
const BAR_COLORS: Record<string, string> = {
  not_started: "bg-slate-400",
  in_progress:  "bg-[#6BC9B3]",
  completed:    "bg-slate-300",
  on_hold:      "bg-amber-400",
};

export function GanttTab({ constructionId, initialTasks }: Props) {
  const [tasks, setTasks]       = useState<Task[]>(initialTasks);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [dialog, setDialog]     = useState<"add" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<Task | null>(null);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const scrollWrap = useRef<HTMLDivElement>(null);
  const cw = CELL_W[viewMode];

  /* タイムライン範囲 */
  const { timelineStart, timelineDays } = useMemo(() => {
    const dates = tasks
      .flatMap(t => [parseDate(t.start_date), parseDate(t.end_date)])
      .filter(Boolean) as Date[];
    const base = dates.length > 0
      ? new Date(Math.min(...dates.map(d => d.getTime()))) : new Date();
    const end = dates.length > 0
      ? new Date(Math.max(...dates.map(d => d.getTime()))) : addDays(base, 180);
    const tStart = startOfMonth(addDays(base, -10));
    const tEnd   = addDays(startOfMonth(new Date(end.getFullYear(), end.getMonth() + 2, 1)), -1);
    return { timelineStart: tStart, timelineDays: diffDays(tStart, tEnd) + 1 };
  }, [tasks]);

  /* 月ヘッダー */
  const monthHeaders = useMemo(() => {
    const arr: { label: string; startDay: number; colSpan: number }[] = [];
    let cur = new Date(timelineStart);
    while (diffDays(timelineStart, cur) < timelineDays) {
      const startDay = diffDays(timelineStart, cur);
      const daysInM  = getDaysInMonth(cur);
      const left     = daysInM - cur.getDate() + 1;
      const colSpan  = Math.min(left, timelineDays - startDay);
      arr.push({ label: `${cur.getFullYear()}年${cur.getMonth() + 1}月`, startDay, colSpan });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
    return arr;
  }, [timelineStart, timelineDays]);

  /* 今日の位置 */
  const todayOff = diffDays(timelineStart, new Date());

  /* 起動時に今日付近へスクロール */
  useEffect(() => {
    if (scrollWrap.current && todayOff > 0) {
      scrollWrap.current.scrollLeft = Math.max(0, todayOff * cw - 160);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* バー計算 */
  function getBar(task: Task) {
    const s = parseDate(task.start_date);
    const e = parseDate(task.end_date);
    if (!s || !e) return null;
    return {
      left:  Math.max(0, diffDays(timelineStart, s)) * cw,
      width: Math.max(cw, (diffDays(s, e) + 1) * cw),
      color: BAR_COLORS[task.status] ?? BAR_COLORS.not_started,
    };
  }

  /* 日付セル表示判定（月ビューは5の倍数のみ） */
  function showDateLabel(d: Date): boolean {
    if (viewMode === "day") return true;
    if (viewMode === "week") return d.getDay() === 1; // 月曜
    return d.getDate() === 1 || d.getDate() % 5 === 0;
  }

  /* 週末判定 */
  function isWeekend(d: Date) { return d.getDay() === 0 || d.getDay() === 6; }

  /* CRUD */
  function openAdd() { setForm(EMPTY_FORM); setEditTarget(null); setDialog("add"); }
  function openEdit(task: Task) {
    setForm({ name: task.name, start_date: task.start_date ?? "", end_date: task.end_date ?? "", status: task.status, description: "" });
    setEditTarget(task); setDialog("edit");
  }
  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (dialog === "add") {
        const created = await createConstructionTask(constructionId, {
          name: form.name, start_date: form.start_date || undefined,
          end_date: form.end_date || undefined, description: form.description || undefined,
        });
        setTasks(p => [...p, { ...created, progress: created.progress ?? 0, status: created.status ?? "not_started" }]);
      } else if (dialog === "edit" && editTarget) {
        await updateConstructionTask(editTarget.id, {
          name: form.name, start_date: form.start_date || undefined,
          end_date: form.end_date || undefined, status: form.status,
        });
        setTasks(p => p.map(t => t.id === editTarget.id
          ? { ...t, name: form.name, start_date: form.start_date || null, end_date: form.end_date || null, status: form.status }
          : t));
      }
      setDialog(null);
    } catch (e) { console.error(e); } finally { setSaving(false); }
  }
  async function handleDelete(id: string) {
    setDeletingId(id);
    try { await deleteConstructionTask(id); setTasks(p => p.filter(t => t.id !== id)); }
    catch (e) { console.error(e); } finally { setDeletingId(null); }
  }
  async function handleToggle(task: Task) {
    const next = task.status === "completed" ? "in_progress" : "completed";
    setTasks(p => p.map(t => t.id === task.id ? { ...t, status: next } : t));
    await updateConstructionTask(task.id, { status: next }).catch(console.error);
  }

  const timelineW = timelineDays * cw;
  const totalW    = LEFT_W + timelineW;

  return (
    <div className="space-y-3">
      {/* ── ツールバー ── */}
      <div className="flex items-center justify-between">
        <Button size="sm" onClick={openAdd} className="gap-1.5 h-8 text-xs">
          <Plus className="h-3.5 w-3.5" />工程追加
        </Button>
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5">
          {(["day", "week", "month"] as ViewMode[]).map(m => (
            <button key={m} onClick={() => setViewMode(m)}
              className={cn("px-3 py-1 text-xs rounded-md font-medium transition-all",
                viewMode === m
                  ? "bg-white shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}>
              {m === "day" ? "日" : m === "week" ? "週" : "月"}
            </button>
          ))}
        </div>
      </div>

      {/* ── ガントチャート本体 ── */}
      <div className="rounded-xl border border-border overflow-hidden shadow-sm">
        {/* スクロール外枠 */}
        <div ref={scrollWrap} className="overflow-x-auto" style={{ maxHeight: "70vh", overflowY: "auto" }}>
          <div style={{ width: totalW, minWidth: totalW }}>

            {/* ── ヘッダー（sticky top） ── */}
            <div className="sticky top-0 z-20 bg-[#F8FAFB] border-b-2 border-border" style={{ height: HEADER_H }}>
              <div className="flex h-full">
                {/* 左固定ヘッダー（sticky left） */}
                <div className="sticky left-0 z-30 border-r-2 border-border flex-shrink-0" style={{ width: LEFT_W, backgroundColor: "#F8FAFB" }}>
                  <div className="h-full flex items-end">
                    <div className="flex w-full border-t border-border/50">
                      <div className="flex-1 px-3 py-2 text-xs font-semibold text-slate-500 border-r border-border/50">工程内容</div>
                      <div style={{ width: COL_DATE }} className="px-2 py-2 text-xs font-semibold text-slate-500 border-r border-border/50 text-center">開始日</div>
                      <div style={{ width: COL_DATE }} className="px-2 py-2 text-xs font-semibold text-slate-500 text-center">終了日</div>
                    </div>
                  </div>
                </div>

                {/* 右タイムラインヘッダー */}
                <div className="flex-shrink-0 flex flex-col" style={{ width: timelineW }}>
                  {/* 月ラベル行 */}
                  <div className="flex" style={{ height: 28 }}>
                    {monthHeaders.map((m, i) => (
                      <div key={i}
                        className="flex-shrink-0 flex items-center px-2 text-[11px] font-bold text-slate-600 border-r border-border/60 bg-slate-100/80"
                        style={{ width: m.colSpan * cw }}>
                        {m.label}
                      </div>
                    ))}
                  </div>
                  {/* 日付行 */}
                  <div className="flex" style={{ height: 30 }}>
                    {Array.from({ length: timelineDays }).map((_, i) => {
                      const d    = addDays(timelineStart, i);
                      const show = showDateLabel(d);
                      const wknd = isWeekend(d);
                      const today = i === todayOff;
                      return (
                        <div key={i} style={{ width: cw }}
                          className={cn(
                            "flex-shrink-0 flex items-center justify-center text-[10px] border-r border-border/30 font-medium select-none",
                            wknd   ? "bg-rose-50/60 text-rose-400" : "text-slate-400",
                            today  && "bg-blue-500 text-white font-bold rounded-sm",
                          )}>
                          {show ? d.getDate() : ""}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* ── タスク行 ── */}
            {tasks.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground bg-white">
                <p>工程がまだありません</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={openAdd}>
                  <Plus className="h-4 w-4 mr-1" />最初の工程を追加
                </Button>
              </div>
            ) : (
              tasks.map((task, idx) => {
                const bar  = getBar(task);
                const done = task.status === "completed";
                return (
                  <div key={task.id}
                    className={cn("flex group border-b border-border/40 transition-colors",
                      idx % 2 === 1 ? "bg-slate-50" : "bg-white"
                    )}
                    style={{ height: ROW_H }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = "#EFF6FF";
                      const sticky = e.currentTarget.querySelector<HTMLElement>("[data-sticky-left]");
                      if (sticky) sticky.style.backgroundColor = "#EFF6FF";
                    }}
                    onMouseLeave={e => {
                      const bg = idx % 2 === 1 ? "#F8FAFC" : "#FFFFFF";
                      e.currentTarget.style.backgroundColor = bg;
                      const sticky = e.currentTarget.querySelector<HTMLElement>("[data-sticky-left]");
                      if (sticky) sticky.style.backgroundColor = bg;
                    }}
                  >
                    {/* 左固定セル */}
                    <div data-sticky-left className="sticky left-0 z-20 flex-shrink-0 flex border-r-2 border-border/60"
                      style={{ width: LEFT_W, backgroundColor: idx % 2 === 1 ? "#F8FAFC" : "#FFFFFF" }}>
                      {/* 工程名 */}
                      <div className="flex-1 flex items-center gap-2 px-3 min-w-0 border-r border-border/40">
                        <Checkbox
                          checked={done}
                          onCheckedChange={() => handleToggle(task)}
                          className="flex-shrink-0 h-3.5 w-3.5"
                        />
                        <span className={cn("text-xs font-medium truncate", done && "line-through text-slate-400")}>
                          {task.name}
                        </span>
                        <div className="ml-auto flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button
                            className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600"
                            onClick={() => openEdit(task)}>
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            className="p-0.5 rounded hover:bg-red-100 text-slate-400 hover:text-red-500"
                            onClick={() => handleDelete(task.id)}
                            disabled={deletingId === task.id}>
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      {/* 開始日 */}
                      <div style={{ width: COL_DATE }}
                        className="flex items-center justify-center text-[11px] text-slate-500 border-r border-border/40 tabular-nums">
                        {task.start_date ? fmtShort(new Date(task.start_date + "T00:00:00")) : "—"}
                      </div>
                      {/* 終了日 */}
                      <div style={{ width: COL_DATE }}
                        className="flex items-center justify-center text-[11px] text-slate-500 tabular-nums">
                        {task.end_date ? fmtShort(new Date(task.end_date + "T00:00:00")) : "—"}
                      </div>
                    </div>

                    {/* 右タイムラインセル */}
                    <div className="flex-shrink-0 relative" style={{ width: timelineW, height: ROW_H }}>
                      {/* 週末カラム */}
                      {Array.from({ length: timelineDays }).map((_, i) => {
                        const d = addDays(timelineStart, i);
                        if (!isWeekend(d)) return null;
                        return <div key={i} className="absolute top-0 bottom-0" style={{ left: i * cw, width: cw, backgroundColor: "#FFF1F2" }} />;
                      })}
                      {/* 月区切り縦線 */}
                      {monthHeaders.map((m, i) => (
                        <div key={i} className="absolute top-0 bottom-0 w-px bg-slate-200" style={{ left: m.startDay * cw }} />
                      ))}
                      {/* 今日ライン */}
                      {todayOff >= 0 && todayOff < timelineDays && (
                        <div className="absolute top-0 bottom-0 w-0.5 bg-blue-500/50 z-10" style={{ left: todayOff * cw }} />
                      )}
                      {/* ガントバー */}
                      {bar && (
                        <div
                          className={cn(
                            "absolute rounded-full flex items-center overflow-hidden transition-all",
                            bar.color,
                            done && "opacity-50"
                          )}
                          style={{
                            left: bar.left + 1,
                            width: Math.max(bar.width - 2, 6),
                            top: 10,
                            height: ROW_H - 20,
                          }}
                          title={`${task.name}  ${task.start_date ?? ""} → ${task.end_date ?? ""}`}
                        >
                          {bar.width > 50 && (
                            <span className="px-2.5 text-[11px] text-white font-semibold truncate drop-shadow-sm">
                              {task.name}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

          </div>
        </div>
      </div>

      {/* ── ダイアログ ── */}
      <Dialog open={dialog !== null} onOpenChange={o => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog === "add" ? "工程を追加" : "工程を編集"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="g-name">工程名 <span className="text-red-500">*</span></Label>
              <Input id="g-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="例: 基礎工事、木工事" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="g-start">開始日</Label>
                <Input id="g-start" type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="g-end">終了日</Label>
                <Input id="g-end" type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            {dialog === "edit" && (
              <div className="space-y-1.5">
                <Label>ステータス</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {dialog === "add" && (
              <div className="space-y-1.5">
                <Label htmlFor="g-desc">メモ（任意）</Label>
                <Input id="g-desc" value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="備考・注意事項など" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>キャンセル</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? "保存中..." : dialog === "add" ? "追加する" : "保存する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
