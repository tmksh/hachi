"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Pencil, Check, X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getDealStages, createDealStage, updateDealStage, deleteDealStage, reorderDealStages,
  getLostReasons, createLostReason, deleteLostReason,
  getLeadSources, createLeadSource, deleteLeadSource,
  getCustomerTagMasters, createCustomerTagMaster, deleteCustomerTagMaster,
} from "@/lib/actions/deals";

type Stage = { id: string; key: string; label: string; color: string; sort_order: number; is_won: boolean; is_lost: boolean };
type Item  = { id: string; label: string; sort_order: number };

const STAGE_COLORS = [
  "#6B7280", "#3B82F6", "#8B5CF6", "#F59E0B", "#10B981", "#0F5132", "#EF4444", "#EC4899", "#F97316", "#06B6D4",
];

function MasterCard({
  title,
  description,
  count,
  children,
}: {
  title: string;
  description?: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <Card variant="inset" className="gap-0">
      <CardHeader className="min-h-0 h-auto px-3 py-1 border-b border-border/60">
        <div className="flex items-center gap-2 flex-wrap">
          <CardTitle className="text-sm leading-tight">{title}</CardTitle>
          {count !== undefined && (
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-normal tabular-nums">
              {count}
            </Badge>
          )}
          {description && <span className="text-[11px] text-muted-foreground">{description}</span>}
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5 px-3 py-1.5">{children}</CardContent>
    </Card>
  );
}

function ChipList({
  title,
  description,
  items,
  onCreate,
  onDelete,
  placeholder,
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
    try { await onCreate(input.trim()); setInput(""); }
    catch { toast.error("追加に失敗しました"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try { await onDelete(id); }
    catch { toast.error("削除に失敗しました"); }
    finally { setDeletingId(null); }
  }

  return (
    <MasterCard title={title} description={description} count={items.length}>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={placeholder}
          onKeyDown={e => e.key === "Enter" && handleAdd()}
          className="h-8 text-sm"
        />
        <Button size="sm" className="h-8 shrink-0 px-3" onClick={handleAdd} disabled={saving || !input.trim()}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4 rounded-lg border border-dashed bg-muted/20">
          まだ登録がありません
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map(item => (
            <span
              key={item.id}
              className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/30 pl-2 pr-1 py-1 text-xs group hover:bg-muted/50 transition-colors"
            >
              <span>{item.label}</span>
              <button
                type="button"
                onClick={() => handleDelete(item.id)}
                disabled={deletingId === item.id}
                className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                aria-label={`${item.label}を削除`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </MasterCard>
  );
}

function StageList({ stages, onReload }: { stages: Stage[]; onReload: () => void }) {
  const [newLabel, setNewLabel]   = useState("");
  const [newColor, setNewColor]   = useState(STAGE_COLORS[0]);
  const [editId, setEditId]       = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [saving, setSaving]       = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAdd() {
    if (!newLabel.trim()) return;
    setSaving(true);
    try {
      const key = newLabel.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_ぁ-ん一-龯]/g, "") || `stage_${Date.now()}`;
      await createDealStage({ key, label: newLabel.trim(), color: newColor, sort_order: stages.length });
      toast.success("ステージを追加しました");
      setNewLabel(""); onReload();
    } catch { toast.error("追加に失敗しました"); }
    finally { setSaving(false); }
  }

  async function handleEditSave(id: string) {
    if (!editLabel.trim()) return;
    try {
      await updateDealStage(id, { label: editLabel.trim() });
      toast.success("更新しました"); setEditId(null); onReload();
    } catch { toast.error("更新に失敗しました"); }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try { await deleteDealStage(id); toast.success("削除しました"); onReload(); }
    catch { toast.error("削除に失敗しました"); }
    finally { setDeletingId(null); }
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= stages.length) return;
    const reordered = [...stages];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    await reorderDealStages(reordered.map((s, i) => ({ id: s.id, sort_order: i })));
    onReload();
  }

  return (
    <MasterCard
      title="商談ステージ"
      description="左から右へ並び替え"
      count={stages.length}
    >
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border/40 pb-1.5 -mx-3 px-3">
        <div className="flex gap-0.5 shrink-0">
          {STAGE_COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setNewColor(c)}
              className={cn(
                "h-4 w-4 rounded-full border-2 transition-all",
                newColor === c ? "border-foreground scale-110" : "border-transparent hover:scale-105",
              )}
              style={{ backgroundColor: c }}
              aria-label={`色 ${c} を選択`}
            />
          ))}
        </div>
        <Input
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          placeholder="新しいステージ名"
          onKeyDown={e => e.key === "Enter" && handleAdd()}
          className="h-7 text-sm flex-1 min-w-[120px]"
        />
        <Button size="sm" className="h-7 shrink-0 px-2.5" onClick={handleAdd} disabled={saving || !newLabel.trim()}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {stages.length === 0 ? (
        <p className="text-xs text-muted-foreground py-1">ステージがありません</p>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          {stages.map((stage, idx) => (
            <div key={stage.id} className="flex items-center gap-1 shrink-0">
              {idx > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0" aria-hidden />}
              <div
                className="inline-flex items-center gap-0.5 rounded-md border px-1 py-0.5 group"
                style={{
                  borderColor: `${stage.color}50`,
                  backgroundColor: `${stage.color}10`,
                }}
              >
                <button
                  type="button"
                  onClick={() => handleMove(idx, -1)}
                  disabled={idx === 0}
                  className="p-0.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-20 shrink-0"
                  aria-label="左へ移動"
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <span className="h-2 w-2 rounded-full shrink-0 mx-0.5" style={{ backgroundColor: stage.color }} />
                {editId === stage.id ? (
                  <Input
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    autoFocus
                    onKeyDown={e => { if (e.key === "Enter") handleEditSave(stage.id); if (e.key === "Escape") setEditId(null); }}
                    className="h-6 w-24 text-xs py-0 px-1"
                  />
                ) : (
                  <span className="text-xs font-medium whitespace-nowrap px-0.5">{stage.label}</span>
                )}
                {stage.is_won && (
                  <Badge variant="outline" className="text-[9px] h-3.5 px-1 border-emerald-300 text-emerald-700 bg-emerald-50 shrink-0">
                    受注
                  </Badge>
                )}
                {stage.is_lost && (
                  <Badge variant="outline" className="text-[9px] h-3.5 px-1 border-red-300 text-red-600 bg-red-50 shrink-0">
                    失注
                  </Badge>
                )}
                <div className="flex opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  {editId === stage.id ? (
                    <>
                      <button type="button" onClick={() => handleEditSave(stage.id)} className="p-0.5 rounded hover:bg-background/80">
                        <Check className="h-3 w-3" />
                      </button>
                      <button type="button" onClick={() => setEditId(null)} className="p-0.5 rounded hover:bg-background/80">
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => { setEditId(stage.id); setEditLabel(stage.label); }}
                        className="p-0.5 rounded hover:bg-background/80 text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(stage.id)}
                        disabled={deletingId === stage.id}
                        className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleMove(idx, 1)}
                  disabled={idx === stages.length - 1}
                  className="p-0.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-20 shrink-0"
                  aria-label="右へ移動"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </MasterCard>
  );
}

function CrmMasterSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-80" />
      <Skeleton className="h-64 w-full rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function CrmMasterTab() {
  const [stages, setStages]         = useState<Stage[]>([]);
  const [lostReasons, setLostReasons] = useState<Item[]>([]);
  const [leadSources, setLeadSources] = useState<Item[]>([]);
  const [tags, setTags]             = useState<Item[]>([]);
  const [loading, setLoading]       = useState(true);

  const reload = useCallback(async () => {
    const [s, l, ls, t] = await Promise.all([
      getDealStages(),
      getLostReasons(),
      getLeadSources(),
      getCustomerTagMasters(),
    ]);
    setStages(s as Stage[]);
    setLostReasons(l as Item[]);
    setLeadSources(ls as Item[]);
    setTags(t as Item[]);
  }, []);

  useEffect(() => {
    void reload().finally(() => setLoading(false));
  }, [reload]);

  if (loading) return <CrmMasterSkeleton />;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        商談ステージ・失注理由・紹介元・顧客タグを会社ごとにカスタマイズできます。
      </p>

      <StageList stages={stages} onReload={reload} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ChipList
          title="失注理由"
          description="商談失注時の選択肢"
          items={lostReasons}
          onCreate={async (label) => { await createLostReason(label); toast.success("追加しました"); await reload(); }}
          onDelete={async (id) => { await deleteLostReason(id); toast.success("削除しました"); await reload(); }}
          placeholder="例: 予算乖離"
        />
        <ChipList
          title="紹介元区分"
          description="リード獲得チャネル"
          items={leadSources}
          onCreate={async (label) => { await createLeadSource(label); toast.success("追加しました"); await reload(); }}
          onDelete={async (id) => { await deleteLeadSource(id); toast.success("削除しました"); await reload(); }}
          placeholder="例: Instagram"
        />
        <ChipList
          title="顧客タグ"
          description="顧客分類ラベル"
          items={tags}
          onCreate={async (label) => { await createCustomerTagMaster(label); toast.success("追加しました"); await reload(); }}
          onDelete={async (id) => { await deleteCustomerTagMaster(id); toast.success("削除しました"); await reload(); }}
          placeholder="例: VIP"
        />
      </div>
    </div>
  );
}
