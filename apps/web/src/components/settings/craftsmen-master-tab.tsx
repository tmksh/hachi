"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
type Item = { id: string; label: string; sort_order: number };

type MasterKind = "specialties" | "qualifications";

async function fetchMasterLists(): Promise<{ specialties: Item[]; qualifications: Item[] }> {
  const res = await fetch("/api/settings/craftsmen-master");
  const data = (await res.json()) as {
    ok?: boolean;
    error?: string;
    specialties?: Item[];
    qualifications?: Item[];
  };
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? "マスタ一覧の取得に失敗しました");
  }
  return {
    specialties: data.specialties ?? [],
    qualifications: data.qualifications ?? [],
  };
}

async function createMasterItem(kind: MasterKind, label: string): Promise<Item> {
  const res = await fetch("/api/settings/craftsmen-master", {
    method: "POST",
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
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? "削除に失敗しました");
  }
}

function MasterList({
  title, description, items, onCreate, onDelete, placeholder,
}: {
  title: string;
  description?: string;
  items: Item[];
  onCreate: (label: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  placeholder: string;
}) {
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input value={input} onChange={e => setInput(e.target.value)} placeholder={placeholder}
            onKeyDown={e => e.key === "Enter" && handleAdd()} className="h-8 text-sm" />
          <Button size="sm" className="h-8 px-3" onClick={handleAdd} disabled={saving || !input.trim()}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {items.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">まだ登録がありません</p>
          )}
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-accent/50 group">
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
  const [specialties, setSpecialties]       = useState<Item[]>(initialData?.specialties ?? []);
  const [qualifications, setQualifications] = useState<Item[]>(initialData?.qualifications ?? []);

  const reload = useCallback(async () => {
    const { specialties: s, qualifications: q } = await fetchMasterLists();
    setSpecialties(s);
    setQualifications(q);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        職種区分や資格は会社ごとにカスタマイズできます。
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MasterList
          title="職種区分"
          description="協力職人の職種カテゴリ"
          items={specialties}
          onCreate={async (label) => {
            const item = await createMasterItem("specialties", label);
            setSpecialties((prev) => [...prev, item].sort((a, b) => a.sort_order - b.sort_order));
            toast.success("追加しました");
            await reload();
          }}
          onDelete={async (id) => {
            await deleteMasterItem("specialties", id);
            setSpecialties((prev) => prev.filter((x) => x.id !== id));
            toast.success("削除しました");
            await reload();
          }}
          placeholder="例: 大工"
        />
        <MasterList
          title="資格・保有免許"
          description="職人が保有できる資格の選択肢"
          items={qualifications}
          onCreate={async (label) => {
            const item = await createMasterItem("qualifications", label);
            setQualifications((prev) => [...prev, item].sort((a, b) => a.sort_order - b.sort_order));
            toast.success("追加しました");
            await reload();
          }}
          onDelete={async (id) => {
            await deleteMasterItem("qualifications", id);
            setQualifications((prev) => prev.filter((x) => x.id !== id));
            toast.success("削除しました");
            await reload();
          }}
          placeholder="例: 施工管理技士"
        />
      </div>
    </div>
  );
}
