"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { QK } from "@/lib/queries/portal";
import { fetchCraftsmenMasterLists, type CraftsmanMasterItem } from "@/lib/queries/craftsmen-master";
import { cn } from "@/lib/utils";

type Item = CraftsmanMasterItem;
type MasterKind = "specialties" | "qualifications";

async function createMasterItem(kind: MasterKind, label: string): Promise<Item> {
  const res = await fetch("/api/settings/craftsmen-master", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, label }),
  });
  const data = (await res.json()) as { ok?: boolean; error?: string; item?: Item };
  if (!res.ok || !data.ok || !data.item) {
    throw new Error(data.error ?? "追加に失敗しました");
  }
  return data.item;
}

async function deleteMasterItem(kind: MasterKind, id: string): Promise<void> {
  const res = await fetch(`/api/settings/craftsmen-master?kind=${kind}&id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? "削除に失敗しました");
  }
}

function sortItems(items: Item[]): Item[] {
  return [...items].sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, "ja"));
}

function upsertItem(prev: Item[], item: Item): Item[] {
  return sortItems([...prev.filter((x) => x.id !== item.id), item]);
}

function mergeItems(remote: Item[], local: Item[]): Item[] {
  const byId = new Map(remote.map((x) => [x.id, x]));
  for (const x of local) {
    if (!byId.has(x.id)) byId.set(x.id, x);
  }
  return sortItems([...byId.values()]);
}

function MasterList({
  title,
  description,
  items,
  flashId,
  onCreate,
  onDelete,
  placeholder,
}: {
  title: string;
  description?: string;
  items: Item[];
  flashId: string | null;
  onCreate: (label: string) => Promise<string>;
  onDelete: (id: string) => Promise<void>;
  placeholder: string;
}) {
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!flashId) return;
    itemRefs.current[flashId]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [flashId, items]);

  async function handleAdd() {
    if (!input.trim()) return;
    setSaving(true);
    try {
      await onCreate(input.trim());
      setInput("");
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "追加に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await onDelete(id);
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "削除に失敗しました");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-baseline justify-between gap-2">
          <span>{title}</span>
          <span className="text-[11px] font-normal text-muted-foreground">{items.length}件</span>
        </CardTitle>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="h-8 text-sm"
          />
          <Button size="sm" className="h-8 px-3" onClick={handleAdd} disabled={saving || !input.trim()}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="space-y-1 max-h-[min(70vh,36rem)] overflow-y-auto rounded-md border border-border/60 p-1">
          {items.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">まだ登録がありません</p>
          )}
          {items.map((item) => (
            <div
              key={item.id}
              ref={(el) => {
                itemRefs.current[item.id] = el;
              }}
              className={cn(
                "flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-accent/50 group",
                flashId === item.id && "bg-emerald-50 ring-1 ring-emerald-200",
              )}
            >
              <span className="text-sm flex-1">{item.label}</span>
              <button
                onClick={() => handleDelete(item.id)}
                disabled={deletingId === item.id}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export type CraftsmenMasterInitialData = {
  specialties: Item[];
  qualifications: Item[];
};

export function CraftsmenMasterTab({ initialData }: { initialData?: CraftsmenMasterInitialData }) {
  const queryClient = useQueryClient();
  const [specialties, setSpecialties] = useState<Item[]>(() => sortItems(initialData?.specialties ?? []));
  const [qualifications, setQualifications] = useState<Item[]>(() => sortItems(initialData?.qualifications ?? []));
  const [flashSpecialtyId, setFlashSpecialtyId] = useState<string | null>(null);
  const [flashQualificationId, setFlashQualificationId] = useState<string | null>(null);
  const reloadGen = useRef(0);

  const reload = useCallback(async () => {
    const gen = ++reloadGen.current;
    try {
      const { specialties: s, qualifications: q } = await fetchCraftsmenMasterLists();
      if (gen !== reloadGen.current) return;
      setSpecialties((prev) => mergeItems(s, prev));
      setQualifications((prev) => mergeItems(q, prev));
      queryClient.setQueryData(QK.craftsmenMaster, (old: { specialties?: Item[]; qualifications?: Item[] } | undefined) => ({
        specialties: mergeItems(s, old?.specialties ?? []),
        qualifications: mergeItems(q, old?.qualifications ?? []),
      }));
      void queryClient.invalidateQueries({ queryKey: QK.craftsmenMaster });
    } catch (e) {
      if (gen !== reloadGen.current) return;
      toast.error(e instanceof Error && e.message ? e.message : "マスタ一覧の取得に失敗しました");
    }
  }, [queryClient]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        職種区分や資格は会社ごとにカスタマイズできます。職人の新規・編集画面の選択肢にそのまま出ます。
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MasterList
          title="職種区分"
          description="協力職人の職種カテゴリ"
          items={specialties}
          flashId={flashSpecialtyId}
          onCreate={async (label) => {
            const item = await createMasterItem("specialties", label);
            setSpecialties((prev) => upsertItem(prev, item));
            queryClient.setQueryData(QK.craftsmenMaster, (old: { specialties?: Item[]; qualifications?: Item[] } | undefined) => ({
              specialties: upsertItem(old?.specialties ?? [], item),
              qualifications: old?.qualifications ?? qualifications,
            }));
            setFlashSpecialtyId(item.id);
            toast.success(`「${item.label}」を追加しました`);
            void reload();
            return item.id;
          }}
          onDelete={async (id) => {
            await deleteMasterItem("specialties", id);
            setSpecialties((prev) => prev.filter((x) => x.id !== id));
            toast.success("削除しました");
            void reload();
          }}
          placeholder="例: 大工"
        />
        <MasterList
          title="資格・保有免許"
          description="職人が保有できる資格の選択肢"
          items={qualifications}
          flashId={flashQualificationId}
          onCreate={async (label) => {
            const item = await createMasterItem("qualifications", label);
            setQualifications((prev) => upsertItem(prev, item));
            queryClient.setQueryData(QK.craftsmenMaster, (old: { specialties?: Item[]; qualifications?: Item[] } | undefined) => ({
              specialties: old?.specialties ?? specialties,
              qualifications: upsertItem(old?.qualifications ?? [], item),
            }));
            setFlashQualificationId(item.id);
            toast.success(`「${item.label}」を追加しました`);
            void reload();
            return item.id;
          }}
          onDelete={async (id) => {
            await deleteMasterItem("qualifications", id);
            setQualifications((prev) => prev.filter((x) => x.id !== id));
            toast.success("削除しました");
            void reload();
          }}
          placeholder="例: 施工管理技士"
        />
      </div>
    </div>
  );
}
