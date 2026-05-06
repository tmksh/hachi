"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GripVertical, Pencil, Check, X } from "lucide-react";
import {
  getDealStages, createDealStage, updateDealStage, deleteDealStage, reorderDealStages,
  getLostReasons, createLostReason, deleteLostReason,
  getLeadSources, createLeadSource, deleteLeadSource,
  getCustomerTagMasters, createCustomerTagMaster, deleteCustomerTagMaster,
} from "@/lib/actions/deals";

type Stage = { id: string; key: string; label: string; color: string; sort_order: number; is_won: boolean; is_lost: boolean };
type Item  = { id: string; label: string; sort_order: number };

const STAGE_COLORS = [
  "#6B7280","#3B82F6","#8B5CF6","#F59E0B","#10B981","#0F5132","#EF4444","#EC4899","#F97316","#06B6D4",
];

// ── シンプルリスト編集コンポーネント ──────────────────────────
function SimpleList({
  title, items, onCreate, onDelete, placeholder,
}: {
  title: string;
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input value={input} onChange={e => setInput(e.target.value)} placeholder={placeholder}
            onKeyDown={e => e.key === "Enter" && handleAdd()} className="h-8 text-sm" />
          <Button size="sm" className="h-8 px-3" onClick={handleAdd} disabled={saving || !input.trim()}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="space-y-1 max-h-52 overflow-y-auto">
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

// ── 商談ステージ編集 ──────────────────────────────────────────
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

  async function handleMoveUp(index: number) {
    if (index === 0) return;
    const reordered = [...stages];
    [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
    await reorderDealStages(reordered.map((s, i) => ({ id: s.id, sort_order: i })));
    onReload();
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">商談ステージ</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 追加フォーム */}
        <div className="flex gap-2 items-center">
          <div className="flex gap-1 flex-wrap">
            {STAGE_COLORS.map(c => (
              <button key={c} onClick={() => setNewColor(c)}
                className={`w-5 h-5 rounded-full border-2 transition-all ${newColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
          <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="新しいステージ名"
            onKeyDown={e => e.key === "Enter" && handleAdd()} className="h-8 text-sm flex-1" />
          <Button size="sm" className="h-8 px-3" onClick={handleAdd} disabled={saving || !newLabel.trim()}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* ステージ一覧 */}
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {stages.map((stage, idx) => (
            <div key={stage.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent/50 group">
              <button onClick={() => handleMoveUp(idx)} disabled={idx === 0}
                className="text-muted-foreground hover:text-foreground disabled:opacity-20 cursor-grab">
                <GripVertical className="h-3.5 w-3.5" />
              </button>
              <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
              {editId === stage.id ? (
                <Input value={editLabel} onChange={e => setEditLabel(e.target.value)} autoFocus
                  onKeyDown={e => { if (e.key === "Enter") handleEditSave(stage.id); if (e.key === "Escape") setEditId(null); }}
                  className="h-6 text-sm flex-1 py-0" />
              ) : (
                <span className="text-sm flex-1">{stage.label}</span>
              )}
              {stage.is_won && <Badge className="text-[10px] h-4 px-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">受注</Badge>}
              {stage.is_lost && <Badge className="text-[10px] h-4 px-1 bg-red-100 text-red-600 hover:bg-red-100">失注</Badge>}
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {editId === stage.id ? (
                  <>
                    <button onClick={() => handleEditSave(stage.id)} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"><Check className="h-3 w-3" /></button>
                    <button onClick={() => setEditId(null)} className="p-1 rounded hover:bg-accent text-muted-foreground"><X className="h-3 w-3" /></button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setEditId(stage.id); setEditLabel(stage.label); }}
                      className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" /></button>
                    <button onClick={() => handleDelete(stage.id)} disabled={deletingId === stage.id}
                      className="p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground"><Trash2 className="h-3 w-3" /></button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── メインコンポーネント ──────────────────────────────────────
export function CrmMasterTab() {
  const [stages, setStages]         = useState<Stage[]>([]);
  const [lostReasons, setLostReasons] = useState<Item[]>([]);
  const [leadSources, setLeadSources] = useState<Item[]>([]);
  const [tags, setTags]             = useState<Item[]>([]);

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

  useEffect(() => { void reload(); }, [reload]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        商談ステージや失注理由などは会社ごとにカスタマイズできます。
      </p>

      {/* 商談ステージ */}
      <StageList stages={stages} onReload={reload} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 失注理由 */}
        <SimpleList
          title="失注理由"
          items={lostReasons}
          onCreate={async (label) => { await createLostReason(label); toast.success("追加しました"); await reload(); }}
          onDelete={async (id) => { await deleteLostReason(id); toast.success("削除しました"); await reload(); }}
          placeholder="例: 予算乖離"
        />

        {/* 紹介元区分 */}
        <SimpleList
          title="紹介元区分"
          items={leadSources}
          onCreate={async (label) => { await createLeadSource(label); toast.success("追加しました"); await reload(); }}
          onDelete={async (id) => { await deleteLeadSource(id); toast.success("削除しました"); await reload(); }}
          placeholder="例: Instagram"
        />

        {/* 顧客タグ */}
        <SimpleList
          title="顧客タグ"
          items={tags}
          onCreate={async (label) => { await createCustomerTagMaster(label); toast.success("追加しました"); await reload(); }}
          onDelete={async (id) => { await deleteCustomerTagMaster(id); toast.success("削除しました"); await reload(); }}
          placeholder="例: VIP"
        />
      </div>
    </div>
  );
}
