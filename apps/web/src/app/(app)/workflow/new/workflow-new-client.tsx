"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import {
  createWorkflowRequest,
  type FieldDef,
  type ApprovalStep,
} from "@/lib/actions/workflow";
import type { fetchWorkflowTypes } from "@/lib/queries/portal";

type WfType = Awaited<ReturnType<typeof fetchWorkflowTypes>>[number];

type WorkflowNewClientProps = {
  initialTypes: WfType[];
  initialProfiles: { id: string; display_name: string }[];
};

export function WorkflowNewClient({ initialTypes, initialProfiles }: WorkflowNewClientProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [types, setTypes] = useState<WfType[]>(initialTypes);
  const [profiles, setProfiles] = useState(initialProfiles);

  const [typeId, setTypeId] = useState("");
  const [selectedType, setSelectedType] = useState<WfType | null>(null);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [approverIds, setApproverIds] = useState<string[]>([]);
  const [dynamicValues, setDynamicValues] = useState<Record<string, string>>({});

  useEffect(() => {
    setTypes(initialTypes);
    setProfiles(initialProfiles);
  }, [initialTypes, initialProfiles]);

  const handleTypeChange = (id: string) => {
    setTypeId(id);
    const t = types.find(x => x.id === id) ?? null;
    setSelectedType(t);
    setDynamicValues({});
    const ar = ((t as WfType & { approval_route?: ApprovalStep[] })?.approval_route ?? []) as ApprovalStep[];
    setApproverIds(ar.map(s => s.approver_id));
    if (t && !title) setTitle(t.name);
  };

  const handleSave = async () => {
    if (!title.trim() || !typeId) { toast.error("種別と件名を入力してください"); return; }
    const fields = ((selectedType as WfType & { fields_schema?: FieldDef[] })?.fields_schema ?? []) as FieldDef[];
    const required = fields.filter(f => f.required);
    const missing = required.find(f => !dynamicValues[f.key]?.trim());
    if (missing) { toast.error(`「${missing.label}」を入力してください`); return; }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...dynamicValues };
      const result = await createWorkflowRequest({
        type_id: typeId,
        title: title.trim(),
        amount: amount ? Number(amount) : undefined,
        due_date: dueDate || undefined,
        approver_ids: approverIds.length ? approverIds : undefined,
        payload,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("申請しました");
      router.push("/workflow");
    } catch { toast.error("申請に失敗"); } finally { setSaving(false); }
  };

  const fieldsDef = ((selectedType as WfType & { fields_schema?: FieldDef[] })?.fields_schema ?? []) as FieldDef[];
  const ddDays = (selectedType as WfType & { deadline_days?: number })?.deadline_days;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/workflow">
          <Button variant="ghost" size="icon" className="size-8"><ArrowLeft className="size-4" /></Button>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">新規申請</h1>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">申請種別を選択</CardTitle></CardHeader>
          <CardContent>
            <Select value={typeId} onValueChange={handleTypeChange}>
              <SelectTrigger><SelectValue placeholder="種別を選択してください" /></SelectTrigger>
              <SelectContent>
                {(() => {
                  const groups: Record<string, WfType[]> = {};
                  types.forEach(t => {
                    const cat = (t as WfType & { description?: string }).description || "その他";
                    if (!groups[cat]) groups[cat] = [];
                    groups[cat].push(t);
                  });
                  return Object.entries(groups).map(([cat, items]) => (
                    <div key={cat}>
                      <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{cat}</div>
                      {items.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </div>
                  ));
                })()}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedType && (
          <>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">申請内容</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>件名 *</Label>
                    <Input value={title} onChange={e => setTitle(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>金額</Label>
                    <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      期限
                      {ddDays && <span className="text-xs text-muted-foreground ml-1">（推奨: {ddDays}日以内）</span>}
                    </Label>
                    <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                  </div>

                  {fieldsDef.map(f => (
                    <div key={f.key} className={`space-y-2 ${f.type === "textarea" ? "sm:col-span-2" : ""}`}>
                      <Label>{f.label}{f.required && <span className="text-destructive ml-0.5">*</span>}</Label>
                      {f.type === "textarea" ? (
                        <Textarea
                          rows={3}
                          value={dynamicValues[f.key] ?? ""}
                          onChange={e => setDynamicValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                        />
                      ) : f.type === "select" ? (
                        <Select
                          value={dynamicValues[f.key] ?? ""}
                          onValueChange={v => setDynamicValues(prev => ({ ...prev, [f.key]: v }))}
                        >
                          <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                          <SelectContent>
                            {(f.options ?? []).map(opt => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type={f.type}
                          value={dynamicValues[f.key] ?? ""}
                          onChange={e => setDynamicValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">承認ルート</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {approverIds.length === 0 && (
                  <p className="text-sm text-muted-foreground">承認者が設定されていません</p>
                )}
                {approverIds.map((id, i) => {
                  const p = profiles.find(x => x.id === id);
                  return (
                    <div key={id} className="flex items-center gap-3 p-2.5 border rounded-lg bg-muted/30">
                      <span className="text-xs text-muted-foreground w-14 shrink-0">Step {i + 1}</span>
                      <span className="text-sm">{p?.display_name ?? "不明"}</span>
                    </div>
                  );
                })}
                <p className="text-xs text-muted-foreground">承認ルートは設定から変更できます</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <Link href="/workflow"><Button variant="outline">キャンセル</Button></Link>
        <Button onClick={handleSave} disabled={saving || !typeId}>
          <Save className="size-4 mr-1" />{saving ? "申請中..." : "申請"}
        </Button>
      </div>
    </div>
  );
}
