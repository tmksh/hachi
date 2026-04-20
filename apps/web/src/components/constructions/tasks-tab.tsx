"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Pencil, Trash2, Plus, GripVertical } from "lucide-react";
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
};

const STATUS_OPTIONS = [
  { value: "not_started", label: "未着手",  color: "bg-gray-100 text-gray-600" },
  { value: "in_progress", label: "進行中",  color: "bg-blue-100 text-blue-700" },
  { value: "completed",   label: "完了",    color: "bg-green-100 text-green-700" },
  { value: "on_hold",     label: "保留",    color: "bg-amber-100 text-amber-700" },
];

function statusLabel(status: string) {
  return STATUS_OPTIONS.find(s => s.value === status) ?? STATUS_OPTIONS[0];
}

const EMPTY_FORM = { name: "", start_date: "", end_date: "", status: "not_started", description: "" };

interface Props {
  constructionId: string;
  initialTasks: Task[];
}

export function TasksTab({ constructionId, initialTasks }: Props) {
  const [tasks, setTasks]       = useState<Task[]>(initialTasks);
  const [dialog, setDialog]     = useState<"add" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<Task | null>(null);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /* ── open dialogs ── */
  function openAdd() {
    setForm(EMPTY_FORM);
    setEditTarget(null);
    setDialog("add");
  }
  function openEdit(task: Task) {
    setForm({
      name: task.name,
      start_date: task.start_date ?? "",
      end_date: task.end_date ?? "",
      status: task.status,
      description: "",
    });
    setEditTarget(task);
    setDialog("edit");
  }

  /* ── save ── */
  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (dialog === "add") {
        const created = await createConstructionTask(constructionId, {
          name: form.name,
          start_date: form.start_date || undefined,
          end_date: form.end_date || undefined,
          description: form.description || undefined,
        });
        setTasks(prev => [...prev, { ...created, progress: created.progress ?? 0, status: created.status ?? "not_started" }]);
      } else if (dialog === "edit" && editTarget) {
        await updateConstructionTask(editTarget.id, {
          name: form.name,
          start_date: form.start_date || undefined,
          end_date: form.end_date || undefined,
          status: form.status,
        });
        setTasks(prev => prev.map(t =>
          t.id === editTarget.id
            ? { ...t, name: form.name, start_date: form.start_date || null, end_date: form.end_date || null, status: form.status }
            : t
        ));
      }
      setDialog(null);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  /* ── delete ── */
  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteConstructionTask(id);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingId(null);
    }
  }

  /* ── progress ── */
  async function handleProgress(id: string, progress: number) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, progress } : t));
    await updateConstructionTask(id, { progress }).catch(console.error);
  }

  return (
    <div className="space-y-3">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{tasks.length} 件の工程</p>
        <Button size="sm" onClick={openAdd} className="gap-1.5">
          <Plus className="h-4 w-4" />工程を追加
        </Button>
      </div>

      {/* リスト */}
      {tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">工程がまだありません</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" />最初の工程を追加
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map(task => {
            const st = statusLabel(task.status);
            return (
              <div
                key={task.id}
                className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:shadow-sm transition-shadow"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground/30 flex-shrink-0" />

                {/* 工程名・期間 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-medium text-sm truncate">{task.name}</span>
                    <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0", st.color)}>
                      {st.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {task.start_date ?? "—"} 〜 {task.end_date ?? "—"}
                    </span>
                  </div>
                </div>

                {/* 進捗スライダー */}
                <div className="flex items-center gap-2 w-40 flex-shrink-0">
                  <input
                    type="range"
                    min={0} max={100} step={5}
                    value={task.progress}
                    onChange={e => handleProgress(task.id, Number(e.target.value))}
                    className="flex-1 accent-[#6BC9B3] cursor-pointer"
                  />
                  <span className="text-xs tabular-nums w-8 text-right text-muted-foreground">
                    {task.progress}%
                  </span>
                </div>

                {/* プログレスバー */}
                <div className="w-24 flex-shrink-0">
                  <Progress value={task.progress} className="h-1.5" />
                </div>

                {/* 操作ボタン */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(task)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-red-500"
                    onClick={() => handleDelete(task.id)}
                    disabled={deletingId === task.id}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ダイアログ（追加・編集共通） */}
      <Dialog open={dialog !== null} onOpenChange={open => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog === "add" ? "工程を追加" : "工程を編集"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="task-name">工程名 <span className="text-red-500">*</span></Label>
              <Input
                id="task-name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="例: 基礎工事、木工事、塗装工事"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="task-start">開始日</Label>
                <Input
                  id="task-start"
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="task-end">終了日</Label>
                <Input
                  id="task-end"
                  type="date"
                  value={form.end_date}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                />
              </div>
            </div>
            {dialog === "edit" && (
              <div className="space-y-1.5">
                <Label>ステータス</Label>
                <Select
                  value={form.status}
                  onValueChange={v => setForm(f => ({ ...f, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {dialog === "add" && (
              <div className="space-y-1.5">
                <Label htmlFor="task-desc">メモ（任意）</Label>
                <Input
                  id="task-desc"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="備考・注意事項など"
                />
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
