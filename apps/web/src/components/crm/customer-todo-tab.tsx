"use client";

import { useState, useEffect, useMemo } from "react";
import { format, isToday, isFuture, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getCustomerTodos, createCustomerTodo, updateCustomerTodo } from "@/lib/actions/crm-features";
import { Plus } from "lucide-react";
import { toast } from "sonner";

type TodoRow = Awaited<ReturnType<typeof getCustomerTodos>>[number];
type Bucket = "today" | "upcoming" | "all";

export function CustomerTodoTab({ customerId }: { customerId: string }) {
  const [todos, setTodos] = useState<TodoRow[]>([]);
  const [bucket, setBucket] = useState<Bucket>("today");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const load = () => getCustomerTodos(customerId).then(setTodos).catch(() => {});
  useEffect(() => { load(); }, [customerId]);

  const filtered = useMemo(() => {
    if (bucket === "all") return todos;
    return todos.filter((t) => {
      if (!t.due_date) return bucket === "upcoming";
      const d = parseISO(t.due_date);
      if (bucket === "today") return isToday(d);
      return isFuture(d) || isToday(d);
    });
  }, [todos, bucket]);

  const selected = todos.find((t) => t.id === selectedId);

  const addTodo = async () => {
    if (!newTitle.trim()) return;
    try {
      await createCustomerTodo({ customer_id: customerId, title: newTitle.trim() });
      setNewTitle("");
      load();
      toast.success("ToDoを追加しました");
    } catch {
      toast.error("追加に失敗しました");
    }
  };

  const toggleComplete = async (id: string, status: string) => {
    const next = status === "completed" ? "pending" : "completed";
    try {
      await updateCustomerTodo(id, { status: next });
      load();
    } catch {
      toast.error("更新に失敗しました");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[140px_1fr_280px] gap-3 min-h-[360px]">
      <div className="space-y-1">
        {([
          { key: "today" as const, label: "Today" },
          { key: "upcoming" as const, label: "Upcoming" },
          { key: "all" as const, label: "All" },
        ]).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setBucket(key)}
            className={cn(
              "w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              bucket === key ? "bg-primary/10 text-primary" : "hover:bg-muted/50 text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="border rounded-lg overflow-hidden flex flex-col">
        <div className="flex gap-2 p-2 border-b">
          <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="新しいToDo..." className="h-8 text-sm" onKeyDown={(e) => e.key === "Enter" && addTodo()} />
          <Button size="sm" className="h-8 shrink-0" onClick={addTodo}><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4 text-center">ToDoなし</p>
          ) : filtered.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedId(t.id)}
              className={cn(
                "w-full text-left px-3 py-2.5 border-b last:border-0 hover:bg-muted/30 transition-colors",
                selectedId === t.id && "bg-primary/5",
              )}
            >
              <div className="flex items-start gap-2">
                <input type="checkbox" checked={t.status === "completed"} onChange={() => toggleComplete(t.id, t.status)} className="mt-1" onClick={(e) => e.stopPropagation()} />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium truncate", t.status === "completed" && "line-through text-muted-foreground")}>{t.title}</p>
                  <div className="flex gap-2 mt-0.5">
                    {t.due_date && <span className="text-[11px] text-muted-foreground">{format(parseISO(t.due_date), "M/d", { locale: ja })}</span>}
                    {t.source === "recording" && <Badge variant="secondary" className="text-[9px] h-4">録音</Badge>}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="border rounded-lg p-3">
        {selected ? (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">{selected.title}</h4>
            <Textarea
              defaultValue={selected.description ?? ""}
              rows={6}
              className="text-sm"
              onBlur={async (e) => {
                await updateCustomerTodo(selected.id, { description: e.target.value });
                load();
              }}
            />
            <p className="text-[11px] text-muted-foreground">作成 {format(new Date(selected.created_at), "yyyy/MM/dd", { locale: ja })}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">ToDoを選択</p>
        )}
      </div>
    </div>
  );
}
