"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, GripVertical, X, ChevronUp, ChevronDown } from "lucide-react";
import {
  createWorkflowType,
  updateWorkflowType,
  deleteWorkflowType,
} from "@/lib/actions/workflow";
import { fetchWorkflowTypes } from "@/lib/queries/portal";
import { fetchProfiles } from "@/lib/queries/lists";
import { CSV_DEFAULT_ROLES, ROLE_LABELS, type Role } from "@/lib/constants";
import {
  describeStep,
  isAttributeStep,
  matchProfiles,
  normalizeApprovalRoute,
  type ApprovalStep,
  type FieldDef,
} from "@/lib/workflow-route";

type WfType = Awaited<ReturnType<typeof fetchWorkflowTypes>>[number];
type Profile = { id: string; display_name: string; role?: string | null; department?: string | null };

const FIELD_TYPE_LABELS: Record<FieldDef["type"], string> = {
  text: "テキスト（1行）",
  textarea: "テキスト（複数行・改行あり）",
  number: "数値",
  date: "日付",
  select: "選択肢",
};

const EMPTY_FIELD: FieldDef = { key: "", label: "", type: "text", required: false };

/** 属性指名の選択肢。`role:sales` / `dept:営業部` / `role:sales|dept:営業部` 形式 */
type AttributeOption = { value: string; label: string; step: Omit<ApprovalStep, "step_order"> };

function buildAttributeOptions(profiles: Profile[]): AttributeOption[] {
  const roles = CSV_DEFAULT_ROLES.filter((r) => r !== "admin");
  const departments = Array.from(
    new Set(profiles.map((p) => (p.department ?? "").trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "ja"));

  const opts: AttributeOption[] = [];
  for (const r of roles) {
    opts.push({ value: `role:${r}`, label: `ロール: ${ROLE_LABELS[r]}`, step: { approver_role: r } });
  }
  for (const d of departments) {
    opts.push({ value: `dept:${d}`, label: `部署: ${d}`, step: { approver_department: d } });
    // 「営業トップ」= 部署 × 経営層/管理者 のような組み合わせ
    for (const r of ["executive", "admin"] as Role[]) {
      opts.push({
        value: `role:${r}|dept:${d}`,
        label: `${d} の${ROLE_LABELS[r]}（${d}トップ）`,
        step: { approver_role: r, approver_department: d, label: `${d}トップ` },
      });
    }
  }
  return opts;
}

export function WorkflowTypesTab() {
  const [types, setTypes] = useState<WfType[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WfType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WfType | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("");

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deadlineDays, setDeadlineDays] = useState("");
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [routeSteps, setRouteSteps] = useState<Omit<ApprovalStep, "step_order">[]>([]);
  const [selectOptionsInput, setSelectOptionsInput] = useState<Record<number, string>>({});

  const load = useCallback(() => {
    Promise.all([fetchWorkflowTypes(), fetchProfiles()])
      .then(([t, p]) => {
        setTypes(t);
        setProfiles(p.map(x => ({ id: x.id, display_name: x.display_name, role: x.role, department: x.department })));
      })
      .catch(() => toast.error("読み込みに失敗"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setName(""); setDescription(""); setDeadlineDays(""); setFields([]); setRouteSteps([]);
    setSelectOptionsInput({});
    setDialogOpen(true);
  };

  const openEdit = (t: WfType) => {
    setEditing(t);
    setName(t.name);
    setDescription((t as WfType & { description?: string }).description ?? "");
    setDeadlineDays(((t as WfType & { deadline_days?: number }).deadline_days ?? "").toString());
    const fs = ((t as WfType & { fields_schema?: FieldDef[] }).fields_schema ?? []) as FieldDef[];
    setFields(fs);
    const optMap: Record<number, string> = {};
    fs.forEach((f, i) => { if (f.options) optMap[i] = f.options.join("\n"); });
    setSelectOptionsInput(optMap);
    setRouteSteps(
      normalizeApprovalRoute((t as WfType & { approval_route?: unknown }).approval_route).map(
        ({ step_order: _order, ...rest }) => rest,
      ),
    );
    setDialogOpen(true);
  };

  const addField = () => setFields(prev => [...prev, { ...EMPTY_FIELD, key: `field_${Date.now()}` }]);
  const removeField = (i: number) => setFields(prev => prev.filter((_, idx) => idx !== i));
  const updateField = (i: number, patch: Partial<FieldDef>) =>
    setFields(prev => prev.map((f, idx) => idx === i ? { ...f, ...patch } : f));

  const stepKey = (s: Omit<ApprovalStep, "step_order">) =>
    s.approver_id ? `id:${s.approver_id}` : `role:${s.approver_role ?? ""}|dept:${s.approver_department ?? ""}`;
  const hasStep = (s: Omit<ApprovalStep, "step_order">) => routeSteps.some((x) => stepKey(x) === stepKey(s));
  const addApprover = (id: string) => {
    if (id && !hasStep({ approver_id: id })) setRouteSteps(prev => [...prev, { approver_id: id }]);
  };
  const addAttributeStep = (value: string) => {
    const opt = attributeOptions.find((o) => o.value === value);
    if (opt && !hasStep(opt.step)) setRouteSteps(prev => [...prev, opt.step]);
  };
  const removeStep = (i: number) => setRouteSteps(prev => prev.filter((_, idx) => idx !== i));
  const moveStep = (i: number, dir: -1 | 1) =>
    setRouteSteps(prev => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const attributeOptions = buildAttributeOptions(profiles);
  const approverIds = routeSteps.map((s) => s.approver_id).filter((id): id is string => Boolean(id));

  const handleSave = async () => {
    if (!name.trim()) { toast.error("種別名を入力してください"); return; }
    setSaving(true);
    try {
      const processedFields: FieldDef[] = fields.map((f, i) => ({
        ...f,
        options: f.type === "select" && selectOptionsInput[i]
          ? selectOptionsInput[i].split("\n").map(s => s.trim()).filter(Boolean)
          : undefined,
      }));
      const approval_route: ApprovalStep[] = routeSteps.map((s, i) => ({ ...s, step_order: i + 1 }));
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        fields_schema: processedFields,
        approval_route,
        deadline_days: deadlineDays ? Number(deadlineDays) : undefined,
      };
      if (editing) {
        await updateWorkflowType(editing.id, payload);
        toast.success("更新しました");
      } else {
        await createWorkflowType({ key: name.trim(), ...payload });
        toast.success("作成しました");
      }
      setDialogOpen(false);
      load();
    } catch { toast.error("保存に失敗"); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteWorkflowType(deleteTarget.id);
      toast.success("削除しました");
      setDeleteTarget(null);
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "削除に失敗"); }
  };

  const availableApprovers = profiles.filter(p => !approverIds.includes(p.id));

  if (loading) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}</div>;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">契約書の多段階承認・総務追記について</p>
        <p>
          種別名に「契約」を含むもの（例: 契約書承認 / 契約書承認テスト）、または key: contract_08 が契約書申請に使われます。
          承認ルートに Step1→Step2→Step3 の順で並べると、契約書申請で同じ順番が自動配置されます。
          総務ロールのメンバーをルートに含めると、回付時に通知され、承認画面で支払条件・口座情報を追記してから承認できます（仕様 Step17）。
          ルートに総務が無い場合も、申請時に総務ロールを末尾へ自動追加します。
        </p>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">申請種別・承認ルート・記入項目を自由に設定できます</p>
        <Button size="sm" onClick={openCreate} className="gap-1 h-7 text-xs px-2.5">
          <Plus className="size-3.5" />種別を追加
        </Button>
      </div>

      {types.length === 0 ? (
        <Card variant="inset">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            申請種別がまだありません。「種別を追加」から作成してください。
          </CardContent>
        </Card>
      ) : (() => {
        const groups: Record<string, WfType[]> = {};
        types.forEach(t => {
          const cat = (t as WfType & { description?: string }).description || "その他";
          if (!groups[cat]) groups[cat] = [];
          groups[cat].push(t);
        });
        const cats = Object.keys(groups);
        const currentTab = activeTab && cats.includes(activeTab) ? activeTab : cats[0];

        const renderTypeList = (items: WfType[]) => (
          <div className="space-y-1 mt-3">
            {items.map(t => {
              const fs = ((t as WfType & { fields_schema?: FieldDef[] }).fields_schema ?? []) as FieldDef[];
              const ar = normalizeApprovalRoute((t as WfType & { approval_route?: unknown }).approval_route);
              const ddDays = (t as WfType & { deadline_days?: number }).deadline_days;
              return (
                <Card key={t.id} className="group cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => openEdit(t)}>
                  <CardContent className="flex items-center justify-between gap-2 py-2 px-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <GripVertical className="size-3.5 text-muted-foreground shrink-0" />
                      <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                        <p className="font-medium text-sm shrink-0">{t.name}</p>
                        <div className="flex flex-wrap gap-1">
                          {fs.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] font-normal h-4 px-1.5">入力 {fs.length}件</Badge>
                          )}
                          {ar.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] font-normal h-4 px-1.5">承認 {ar.length}step</Badge>
                          )}
                          {ddDays && (
                            <Badge variant="secondary" className="text-[10px] font-normal h-4 px-1.5">{ddDays}日</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-6 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={e => { e.stopPropagation(); setDeleteTarget(t); }}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        );

        return (
          <div>
            <Select value={currentTab} onValueChange={setActiveTab}>
              <SelectTrigger className="h-8 text-sm w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {cats.map(cat => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                    <span className="ml-1.5 text-[11px] text-muted-foreground">({groups[cat].length})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {renderTypeList(groups[currentTab] ?? [])}
          </div>
        );
      })()}

      {/* 作成 / 編集ダイアログ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl flex flex-col max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editing ? "申請種別を編集" : "申請種別を追加"}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0 space-y-5 pr-1 py-1">
            {/* 基本情報 */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">基本情報</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label>種別名 *</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="例: 稟議書、経費精算、有給申請" />
                </div>
                <div className="space-y-1.5">
                  <Label>カテゴリ</Label>
                  <p className="text-[11px] text-muted-foreground">一覧でのグループ見出しになります</p>
                  <Input
                    list="category-suggestions"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="例: 稟議・業務依頼系、人事・労務関連"
                  />
                  <datalist id="category-suggestions">
                    {Array.from(new Set(types.map(t => (t as WfType & { description?: string }).description).filter(Boolean))).map(cat => (
                      <option key={cat} value={cat!} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-1.5">
                  <Label>承認期限（日）</Label>
                  <Input type="number" min="1" value={deadlineDays} onChange={e => setDeadlineDays(e.target.value)} placeholder="例: 3（未設定は期限なし）" className="w-40" />
                </div>
              </CardContent>
            </Card>

            {/* 入力項目 */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">入力項目</CardTitle>
                  <Button size="sm" variant="outline" onClick={addField} className="h-7 text-xs gap-1">
                    <Plus className="size-3" />追加
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {fields.length === 0 && (
                  <p className="text-xs text-muted-foreground">「追加」ボタンで記入項目を設定できます（件名・金額・期限は常に表示）。例: 目的＝テキスト（複数行）、取引先名＝テキスト、支払方法＝選択肢</p>
                )}
                {fields.map((f, i) => (
                  <div key={i} className="flex flex-col gap-2 p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Input
                        className="flex-1 h-8 text-sm"
                        placeholder="ラベル（例: 目的、取引先名）"
                        value={f.label}
                        onChange={e => updateField(i, { label: e.target.value, key: e.target.value.replace(/\s/g, "_").toLowerCase() || f.key })}
                      />
                      <Select value={f.type} onValueChange={v => updateField(i, { type: v as FieldDef["type"] })}>
                        <SelectTrigger className="w-32 h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(FIELD_TYPE_LABELS) as FieldDef["type"][]).map(k => (
                            <SelectItem key={k} value={k}>{FIELD_TYPE_LABELS[k]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <label className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap cursor-pointer">
                        <input type="checkbox" checked={f.required ?? false} onChange={e => updateField(i, { required: e.target.checked })} />
                        必須
                      </label>
                      <Button size="icon" variant="ghost" className="size-7 shrink-0" onClick={() => removeField(i)}>
                        <X className="size-3.5" />
                      </Button>
                    </div>
                    {f.type === "select" && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">選択肢（1行1つ）</p>
                        <Textarea
                          rows={3}
                          className="text-xs"
                          placeholder={"選択肢1\n選択肢2\n選択肢3"}
                          value={selectOptionsInput[i] ?? ""}
                          onChange={e => setSelectOptionsInput(prev => ({ ...prev, [i]: e.target.value }))}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* 承認ルート */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">デフォルト承認ルート</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">申請時に自動でセットされる承認者の順番を設定します。メンバー指名と属性指名（例: 営業部トップ → 経営層）を混在できます</p>
                {(/契約/.test(name) || editing?.key === "contract_08") && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={!profiles.some((p) => p.role === "administration" && !approverIds.includes(p.id))}
                      onClick={() => {
                        const soumu = profiles.find((p) => p.role === "administration" && !approverIds.includes(p.id));
                        if (soumu) addApprover(soumu.id);
                        else toast.error("未追加の総務ロールメンバーがいません");
                      }}
                    >
                      総務ロールをルート末尾に追加
                    </Button>
                    {!profiles.some((p) => p.role === "administration") && (
                      <span className="text-[11px] text-amber-700">総務ロールのメンバーがいません</span>
                    )}
                  </div>
                )}
                {routeSteps.length > 0 && (
                  <div className="space-y-1.5">
                    {routeSteps.map((s, i) => {
                      const step: ApprovalStep = { ...s, step_order: i + 1 };
                      const attr = isAttributeStep(step);
                      const p = s.approver_id ? profiles.find(x => x.id === s.approver_id) : undefined;
                      const roleLabel = p?.role ? (ROLE_LABELS[p.role as Role] ?? p.role) : null;
                      const matched = attr ? matchProfiles(step, profiles) : [];
                      return (
                        <div key={`${stepKey(s)}-${i}`} className="flex items-center gap-2 p-2 border rounded-lg bg-muted/30">
                          <span className="text-xs text-muted-foreground w-14 shrink-0">Step {i + 1}</span>
                          <span className="text-sm flex-1 min-w-0 truncate">
                            {describeStep(step, profiles)}
                            {attr ? (
                              <Badge
                                variant="outline"
                                className={`ml-1.5 text-[10px] h-4 px-1.5 align-middle ${
                                  matched.length === 0 ? "border-amber-300 text-amber-700" : "border-violet-300 text-violet-700"
                                }`}
                                title={matched.map((m) => m.display_name).join("、")}
                              >
                                属性 {matched.length === 0 ? "該当者なし" : `該当 ${matched.length}名`}
                              </Badge>
                            ) : roleLabel && (
                              <Badge
                                variant="outline"
                                className={`ml-1.5 text-[10px] h-4 px-1.5 align-middle ${
                                  p?.role === "administration" ? "border-teal-300 text-teal-700" : ""
                                }`}
                              >
                                {roleLabel}
                              </Badge>
                            )}
                          </span>
                          <Button size="icon" variant="ghost" className="size-6" disabled={i === 0} onClick={() => moveStep(i, -1)} aria-label="上へ">
                            <ChevronUp className="size-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="size-6" disabled={i === routeSteps.length - 1} onClick={() => moveStep(i, 1)} aria-label="下へ">
                            <ChevronDown className="size-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="size-6" onClick={() => removeStep(i)} aria-label="削除">
                            <X className="size-3" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {availableApprovers.length > 0 && (
                    <Select onValueChange={addApprover} value="">
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="メンバーを指名して追加..." /></SelectTrigger>
                      <SelectContent>
                        {availableApprovers.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.display_name}
                            {p.role ? `（${ROLE_LABELS[p.role as Role] ?? p.role}）` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Select onValueChange={addAttributeStep} value="">
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="属性（ロール／部署）で追加..." /></SelectTrigger>
                    <SelectContent>
                      {attributeOptions.map(o => {
                        const n = matchProfiles({ ...o.step, step_order: 0 }, profiles).length;
                        return (
                          <SelectItem key={o.value} value={o.value} disabled={hasStep(o.step)}>
                            {o.label}
                            <span className="ml-1 text-[11px] text-muted-foreground">（{n}名）</span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  属性で追加したステップは、申請時点でその属性を持つメンバー（申請者本人は除く）へ自動で割り当てられます。
                  部署はメンバー設定の「部署」欄が基準です。
                </p>
              </CardContent>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 削除確認 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>「{deleteTarget?.name}」を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>この種別を使用している申請データには影響しません。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">削除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
