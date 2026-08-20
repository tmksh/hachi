"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { getCustomer, updateCustomer, createCustomer, type CustomerEntryMasters } from "@/lib/actions/customers";
import { suggestLeadAssignee } from "@/lib/actions/sales-flow";
import { suggestCustomFieldsFromInquiry } from "@/lib/actions/crm-features";
import { useCustomerEntryMasters } from "@/hooks/use-customer-entry-masters";
import type { Customer } from "@/lib/database.types";

const FIELD_SELECT_TRIGGER = "w-full min-w-0";

const INQUIRY_CATEGORIES = [
  "新築相談",
  "リノベ相談",
  "見積依頼",
  "資料請求",
  "来場予約",
  "修繕・メンテ",
  "その他",
];

type CustomerEntryFormProps = {
  customerId?: string;
  mode: "create" | "edit";
  onSaved?: (id: string) => void;
  showCard?: boolean;
  initialCustomer?: Customer;
  initialProfiles?: { id: string; display_name: string }[];
  initialTagMasters?: { id: string; label: string }[];
  initialLeadSources?: { id: string; label: string }[];
  initialDepartments?: string[];
  initialMasters?: CustomerEntryMasters;
};

type FormState = {
  name: string;
  phone: string;
  email: string;
  eight_id: string;
  company_name: string;
  customer_type: "corporation" | "individual";
  department: string;
  age: string;
  address: string;
  source: string;
  inquiry_category: string;
  inquiry_date: string;
  inquiry_content: string;
  assigned_to: string;
  budget_min: string;
  budget_max: string;
  prospect_grade: string;
  is_special_demand: boolean;
  special_probability: string;
  status: string;
  tags: string[];
  notes: string;
  line_user_id: string;
  slack_channel_id: string;
  custom_fields: { key: string; value: string }[];
};

function customerToForm(c: Customer): FormState {
  const custom = c.custom_fields ?? {};
  return {
    name: c.name,
    phone: c.phone ?? "",
    email: c.email ?? "",
    eight_id: c.eight_id ?? "",
    company_name: c.company_name ?? "",
    customer_type: c.customer_type ?? (c.company_name ? "corporation" : "individual"),
    department: c.department ?? "",
    age: c.age != null ? String(c.age) : "",
    address: c.address ?? "",
    source: c.source ?? "",
    inquiry_category: c.inquiry_category ?? "",
    inquiry_date: c.inquiry_date ?? "",
    inquiry_content: c.inquiry_content ?? "",
    assigned_to: c.assigned_to ?? "",
    budget_min: c.budget_min != null ? String(c.budget_min) : "",
    budget_max: c.budget_max != null ? String(c.budget_max) : "",
    prospect_grade: c.prospect_grade ?? "",
    is_special_demand: c.is_special_demand ?? false,
    special_probability: c.special_probability != null ? String(c.special_probability) : "",
    status: c.status,
    tags: c.tags ?? [],
    notes: c.notes ?? "",
    line_user_id: c.line_user_id ?? "",
    slack_channel_id: c.slack_channel_id ?? "",
    custom_fields: Object.entries(custom).map(([key, value]) => ({ key, value })),
  };
}

function formToPayload(form: FormState) {
  const custom_fields = Object.fromEntries(
    form.custom_fields.filter(f => f.key.trim()).map(f => [f.key.trim(), f.value]),
  );
  return {
    name: form.name.trim(),
    phone: form.phone || null,
    email: form.email || null,
    eight_id: form.eight_id || null,
    company_name: form.customer_type === "corporation" ? (form.company_name || null) : null,
    customer_type: form.customer_type,
    department: form.department || null,
    age: form.age ? parseInt(form.age, 10) : null,
    address: form.address || null,
    source: form.source || null,
    inquiry_category: form.inquiry_category || null,
    inquiry_date: form.inquiry_date || null,
    inquiry_content: form.inquiry_content || null,
    assigned_to: form.assigned_to || null,
    budget_min: form.budget_min ? Number(form.budget_min) : null,
    budget_max: form.budget_max ? Number(form.budget_max) : null,
    is_special_demand: form.is_special_demand,
    special_probability: form.is_special_demand && form.special_probability !== ""
      ? Math.min(100, Math.max(0, Number(form.special_probability)))
      : null,
    prospect_grade: form.is_special_demand
      ? null
      : ((form.prospect_grade || null) as "A" | "B" | "C" | null),
    status: form.status,
    tags: form.tags,
    notes: form.notes || null,
    line_user_id: form.line_user_id || null,
    slack_channel_id: form.slack_channel_id || null,
    custom_fields,
    ai_score: null,
  };
}

export function CustomerEntryForm({
  customerId,
  mode,
  onSaved,
  showCard = true,
  initialCustomer,
  initialProfiles,
  initialTagMasters,
  initialLeadSources,
  initialDepartments,
  initialMasters,
}: CustomerEntryFormProps) {
  const [loading, setLoading] = useState(mode === "edit" && !initialCustomer);
  const [saving, setSaving] = useState(false);
  const ssrMasters: CustomerEntryMasters | undefined = initialMasters
    ?? (initialProfiles && initialTagMasters && initialLeadSources && initialDepartments
      ? {
          profiles: initialProfiles,
          tagMasters: initialTagMasters,
          leadSources: initialLeadSources,
          departments: initialDepartments,
        }
      : undefined);
  const { data: masters } = useCustomerEntryMasters(ssrMasters);
  const profiles = masters?.profiles ?? initialProfiles ?? [];
  const tagMasters = masters?.tagMasters ?? initialTagMasters ?? [];
  const leadSources = masters?.leadSources ?? initialLeadSources ?? [];
  const departments = masters?.departments ?? initialDepartments ?? [];
  const [assignSuggesting, setAssignSuggesting] = useState(false);
  const [aiFieldSuggesting, setAiFieldSuggesting] = useState(false);
  const [assignCandidates, setAssignCandidates] = useState<Array<{
    profileId: string;
    displayName: string;
    score: number;
    reasons: string[];
  }>>([]);
  const [form, setForm] = useState<FormState>(() =>
    initialCustomer ? customerToForm(initialCustomer) : {
    name: "",
    phone: "",
    email: "",
    eight_id: "",
    company_name: "",
    customer_type: "individual",
    department: "",
    age: "",
    address: "",
    source: "",
    inquiry_category: "",
    inquiry_date: "",
    inquiry_content: "",
    assigned_to: "",
    budget_min: "",
    budget_max: "",
    prospect_grade: "",
    is_special_demand: false,
    special_probability: "",
    status: "active",
    tags: [],
    notes: "",
    line_user_id: "",
    slack_channel_id: "",
    custom_fields: [],
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const toggleTag = (label: string) => {
    setForm(prev => ({
      ...prev,
      tags: prev.tags.includes(label) ? prev.tags.filter(t => t !== label) : [...prev.tags, label],
    }));
  };

  const suggestAssignee = async () => {
    setAssignSuggesting(true);
    try {
      const result = await suggestLeadAssignee(form.inquiry_content);
      setAssignCandidates(result.candidates ?? []);
      if (result.recommendedId) {
        set("assigned_to", result.recommendedId);
        const top = result.candidates[0];
        toast.success(`担当者を提案: ${top?.displayName ?? ""}（適合度 ${top?.score ?? 0}）ほか ${Math.max(0, (result.candidates?.length ?? 1) - 1)}名`);
      } else {
        toast.info("担当者候補が見つかりませんでした");
      }
    } catch {
      toast.error("担当者提案に失敗しました");
    } finally {
      setAssignSuggesting(false);
    }
  };

  const suggestFieldsWithAi = async () => {
    setAiFieldSuggesting(true);
    try {
      const result = await suggestCustomFieldsFromInquiry({
        inquiry_content: form.inquiry_content,
        notes: form.notes,
        existing_keys: form.custom_fields.map(f => f.key).filter(Boolean),
      });
      if (result.ok) {
        setForm(prev => ({ ...prev, custom_fields: [...prev.custom_fields, ...result.fields] }));
        toast.success(`AIが${result.fields.length}件の項目を提案しました。内容を確認して保存してください`);
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("AI入力に失敗しました");
    } finally {
      setAiFieldSuggesting(false);
    }
  };

  useEffect(() => {
    if (initialCustomer) setForm(customerToForm(initialCustomer));
  }, [initialCustomer]);

  useEffect(() => {
    if (mode !== "edit" || !customerId || initialCustomer) return;
    getCustomer(customerId)
      .then(c => setForm(customerToForm(c)))
      .catch(() => toast.error("取得に失敗しました"))
      .finally(() => setLoading(false));
  }, [customerId, mode, initialCustomer]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("契約者氏名を入力してください");
      return;
    }
    setSaving(true);
    try {
      const payload = formToPayload(form);
      if (mode === "edit" && customerId) {
        await updateCustomer(customerId, payload);
        toast.success("保存しました");
        onSaved?.(customerId);
      } else {
        const created = await createCustomer(payload);
        const linked = Boolean((created as { _linkedExisting?: boolean })._linkedExisting);
        toast.success(linked ? "既存顧客に紐付けて登録しました" : "登録しました");
        onSaved?.(created.id);
      }
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const addCustomField = () => {
    setForm(prev => ({ ...prev, custom_fields: [...prev.custom_fields, { key: "", value: "" }] }));
  };

  const updateCustomField = (index: number, field: "key" | "value", val: string) => {
    setForm(prev => ({
      ...prev,
      custom_fields: prev.custom_fields.map((f, i) => (i === index ? { ...f, [field]: val } : f)),
    }));
  };

  const removeCustomField = (index: number) => {
    setForm(prev => ({ ...prev, custom_fields: prev.custom_fields.filter((_, i) => i !== index) }));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const departmentOptions = [...new Set([
    ...departments,
    ...tagMasters.map(t => t.label).filter(l => /新築|リノベ|修繕|部門/.test(l)),
    "新築",
    "リノベーション",
  ])];

  const formBody = (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>電話番号（携帯電話）</Label>
          <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="090-0000-0000" />
        </div>
        <div className="space-y-2">
          <Label>メールアドレス</Label>
          <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>EIGHT-ID</Label>
          <Input value={form.eight_id} onChange={e => set("eight_id", e.target.value)} placeholder="Sansan Eight ID" />
        </div>
        <div className="space-y-2">
          <Label>契約者氏名 *</Label>
          <Input value={form.name} onChange={e => set("name", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>法人/個人</Label>
          <Select value={form.customer_type} onValueChange={v => set("customer_type", v as FormState["customer_type"])}>
            <SelectTrigger className={FIELD_SELECT_TRIGGER}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="individual">個人</SelectItem>
              <SelectItem value="corporation">法人</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {form.customer_type === "corporation" && (
          <div className="space-y-2">
            <Label>会社名</Label>
            <Input value={form.company_name} onChange={e => set("company_name", e.target.value)} />
          </div>
        )}
        <div className="space-y-2">
          <Label>部門（新築・リノベーション etc…）</Label>
          <Select value={form.department || "_none"} onValueChange={v => set("department", v === "_none" ? "" : v)}>
            <SelectTrigger className={FIELD_SELECT_TRIGGER}><SelectValue placeholder="選択" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">未選択</SelectItem>
              {departmentOptions.map(d => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>年齢</Label>
          <Input type="number" min={0} max={150} value={form.age} onChange={e => set("age", e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>住所</Label>
          <Input value={form.address} onChange={e => set("address", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>知ったきっかけ</Label>
          {leadSources.length > 0 ? (
            <Select value={form.source || "_none"} onValueChange={v => set("source", v === "_none" ? "" : v)}>
              <SelectTrigger className={FIELD_SELECT_TRIGGER}><SelectValue placeholder="選択" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">未選択</SelectItem>
                {leadSources.map(s => (
                  <SelectItem key={s.id} value={s.label}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input value={form.source} onChange={e => set("source", e.target.value)} />
          )}
        </div>
        <div className="space-y-2">
          <Label>問い合わせ分類</Label>
          <Select value={form.inquiry_category || "_none"} onValueChange={v => set("inquiry_category", v === "_none" ? "" : v)}>
            <SelectTrigger className={FIELD_SELECT_TRIGGER}><SelectValue placeholder="選択" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">未選択</SelectItem>
              {INQUIRY_CATEGORIES.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>問い合わせ日</Label>
          <Input type="date" value={form.inquiry_date} onChange={e => set("inquiry_date", e.target.value)} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>担当者</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              disabled={assignSuggesting}
              onClick={() => void suggestAssignee()}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {assignSuggesting ? "提案中..." : "AI担当提案"}
            </Button>
          </div>
          <Select value={form.assigned_to || "_none"} onValueChange={v => set("assigned_to", v === "_none" ? "" : v)}>
            <SelectTrigger className={FIELD_SELECT_TRIGGER}><SelectValue placeholder="選択" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">未選択</SelectItem>
              {profiles.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {assignCandidates.length > 0 && (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-2 space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground">AI適合度スコア付き候補</p>
              {assignCandidates.slice(0, 5).map((c, i) => (
                <button
                  key={c.profileId}
                  type="button"
                  onClick={() => set("assigned_to", c.profileId)}
                  className={`w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-background ${
                    form.assigned_to === c.profileId ? "bg-background border border-primary/30" : ""
                  }`}
                >
                  <span className="font-medium truncate">
                    {i === 0 ? "★ " : ""}{c.displayName}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    適合度 {c.score}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label>予算感（下限）</Label>
          <Input type="number" value={form.budget_min} onChange={e => set("budget_min", e.target.value)} placeholder="円" />
        </div>
        <div className="space-y-2">
          <Label>予算感（上限）</Label>
          <Input type="number" value={form.budget_max} onChange={e => set("budget_max", e.target.value)} placeholder="円" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>問い合わせ内容</Label>
          <Textarea rows={4} value={form.inquiry_content} onChange={e => set("inquiry_content", e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2 rounded-lg border border-border/60 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label>特需（大型案件）</Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                1件の成否で全体見込みが狂う大型案件。通常のA/B/C一律確度は使わず、この案件独自の確度%を入力します
              </p>
            </div>
            <Switch
              checked={form.is_special_demand}
              onCheckedChange={(v) => {
                set("is_special_demand", v);
                if (v) set("prospect_grade", "");
              }}
            />
          </div>
          {form.is_special_demand ? (
            <div className="space-y-1.5 pt-2 border-t border-border/50">
              <Label>独自確度%</Label>
              <div className="flex items-center gap-2 max-w-[200px]">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  className="tabular-nums"
                  value={form.special_probability}
                  onChange={(e) => set("special_probability", e.target.value)}
                  placeholder="例: 40"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 pt-2 border-t border-border/50">
              <Label>見込度</Label>
              <Select value={form.prospect_grade || "_none"} onValueChange={v => set("prospect_grade", v === "_none" ? "" : v)}>
                <SelectTrigger className={FIELD_SELECT_TRIGGER}><SelectValue placeholder="選択" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">未設定</SelectItem>
                  <SelectItem value="A">A（見込度：高）</SelectItem>
                  <SelectItem value="B">B（見込度：中）</SelectItem>
                  <SelectItem value="C">C（見込度：低）</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">A/B/Cの確度%はBIダッシュボードの期首設定で変更できます</p>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label>ステータス</Label>
          <Select value={form.status} onValueChange={v => set("status", v)}>
            <SelectTrigger className={FIELD_SELECT_TRIGGER}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">アクティブ</SelectItem>
              <SelectItem value="inactive">非アクティブ</SelectItem>
              <SelectItem value="pending">保留</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>タグ</Label>
          <div className="flex flex-wrap gap-2 min-h-9">
            {tagMasters.length === 0 ? (
              <p className="text-xs text-muted-foreground">設定画面でタグマスタを登録してください</p>
            ) : tagMasters.map(tag => (
              <button key={tag.id} type="button" onClick={() => toggleTag(tag.label)}>
                <Badge variant={form.tags.includes(tag.label) ? "default" : "outline"}>{tag.label}</Badge>
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>備考</Label>
          <Textarea rows={3} value={form.notes} onChange={e => set("notes", e.target.value)} />
        </div>
      </div>

      <div className="space-y-4 pt-2 border-t">
        <div>
          <Label className="text-sm font-semibold">メッセージ連携</Label>
          <p className="text-xs text-muted-foreground mt-1">
            契約のやり取り管理で、この顧客の LINE / Slack の履歴を絞り込むための ID です
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>LINE ユーザー ID</Label>
            <Input
              value={form.line_user_id}
              onChange={e => set("line_user_id", e.target.value)}
              placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-2">
            <Label>Slack チャンネル ID</Label>
            <Input
              value={form.slack_channel_id}
              onChange={e => set("slack_channel_id", e.target.value)}
              placeholder="C0123456789"
              className="font-mono text-xs"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-2 border-t">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm font-semibold">その他項目</Label>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1" disabled={aiFieldSuggesting} onClick={() => void suggestFieldsWithAi()}>
              <Sparkles className="h-3.5 w-3.5" />{aiFieldSuggesting ? "抽出中..." : "AI入力"}
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={addCustomField}>
              <Plus className="h-3.5 w-3.5" />項目を追加
            </Button>
          </div>
        </div>
        {form.custom_fields.length === 0 ? (
          <p className="text-xs text-muted-foreground">自由に項目を追加できます</p>
        ) : (
          <div className="space-y-2">
            {form.custom_fields.map((field, i) => (
              <div key={i} className="flex gap-2 items-start">
                <Input className="flex-1" placeholder="項目名" value={field.key} onChange={e => updateCustomField(i, "key", e.target.value)} />
                <Input className="flex-[2]" placeholder="内容" value={field.value} onChange={e => updateCustomField(i, "value", e.target.value)} />
                <Button type="button" variant="ghost" size="icon" className="shrink-0 size-9" onClick={() => removeCustomField(i)}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="size-4 mr-1" />
          {saving ? "保存中..." : mode === "create" ? "登録" : "保存"}
        </Button>
      </div>
    </div>
  );

  if (!showCard) return formBody;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">顧客情報</CardTitle>
      </CardHeader>
      <CardContent>{formBody}</CardContent>
    </Card>
  );
}
