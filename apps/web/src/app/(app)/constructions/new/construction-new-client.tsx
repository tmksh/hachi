"use client";

import { useState, useEffect, Suspense, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Sparkles } from "lucide-react";
import { createConstruction } from "@/lib/actions/constructions";
import { getStatusLabel } from "@/lib/status-config";

/** URL に AI 工期が無い場合のフォールバック推定（受注額ベース） */
function estimateDurationFromAmount(orderAmount: string): { start: string; end: string; reason: string } | null {
  const amount = Number(orderAmount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const start = new Date();
  start.setDate(start.getDate() + 14);
  const months = amount > 10_000_000 ? 6 : amount > 3_000_000 ? 4 : 2;
  const end = new Date(start);
  end.setDate(end.getDate() + months * 30);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return {
    start: fmt(start),
    end: fmt(end),
    reason: `標準工事・受注額 ¥${amount.toLocaleString()} を基準に推定`,
  };
}

type EligibleContract = {
  id: string;
  contract_no: string;
  title: string;
  status: "contracted" | "executing";
  customer_id: string | null;
  customer_name: string;
  amount: number;
  start_date: string | null;
  end_date: string | null;
  assigned_to: string | null;
  department_name: string | null;
};

const ELIGIBLE_STATUSES = new Set(["contracted", "executing"]);

function toDateInputValue(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 10);
}


type ConstructionNewClientProps = {
  initialContracts: EligibleContract[];
  initialProfiles: { id: string; display_name: string }[];
  initialDepartments: string[];
  initialCustomerId: string;
  initialContractId: string;
  initialDealId: string;
  initialEstimateId: string;
  initialTitle: string;
  initialOrderAmount: string;
  initialStartDate: string;
  initialEndDate: string;
  initialDurationReason?: string;
  initialAssignedTo: string;
  initialAssigneeCandidates?: Array<{ profileId: string; displayName: string; score: number }>;
};

function ConstructionNewPageContent({
  initialContracts,
  initialProfiles,
  initialDepartments,
  initialCustomerId,
  initialContractId,
  initialDealId,
  initialEstimateId,
  initialTitle,
  initialOrderAmount,
  initialStartDate,
  initialEndDate,
  initialDurationReason = "",
  initialAssignedTo,
  initialAssigneeCandidates = [],
}: ConstructionNewClientProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [contracts, setContracts] = useState(initialContracts);
  const [profiles, setProfiles] = useState(initialProfiles);
  const [departments, setDepartments] = useState(initialDepartments);
  const [title, setTitle] = useState(initialTitle);
  const [titleTouched, setTitleTouched] = useState(Boolean(initialTitle));
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [contractId, setContractId] = useState("");
  const [assignedTo, setAssignedTo] = useState(initialAssignedTo);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [orderAmount, setOrderAmount] = useState(initialOrderAmount);
  const [budgetCost, setBudgetCost] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [assigneeCandidates] = useState(initialAssigneeCandidates);
  const [dateSource, setDateSource] = useState<"ai" | "contract" | "manual" | null>(
    initialStartDate && initialEndDate ? "ai" : null,
  );

  const aiSuggestion = useMemo(() => {
    if (initialStartDate && initialEndDate) {
      return {
        start: initialStartDate,
        end: initialEndDate,
        reason: initialDurationReason || "受注額を基準に推定",
      };
    }
    // 受注確定以外の導線でも提案工期を見せる（No.64）
    if (initialDealId || initialOrderAmount) {
      return estimateDurationFromAmount(initialOrderAmount);
    }
    return null;
  }, [initialStartDate, initialEndDate, initialDurationReason, initialDealId, initialOrderAmount]);

  useEffect(() => {
    setContracts(initialContracts);
    setProfiles(initialProfiles);
    setDepartments(initialDepartments);
  }, [initialContracts, initialProfiles, initialDepartments]);

  // URL に AI 工期がありフォームが空なら自動反映（旧NG: バナーのみで入力欄が空）
  useEffect(() => {
    if (!aiSuggestion) return;
    setStartDate((prev) => prev || aiSuggestion.start);
    setEndDate((prev) => prev || aiSuggestion.end);
    setDateSource((prev) => prev ?? "ai");
  }, [aiSuggestion]);

  const applyContract = useCallback((contract: EligibleContract) => {
    setCustomerId(contract.customer_id ?? "");
    setOrderAmount(String(contract.amount ?? ""));
    const contractStart = toDateInputValue(contract.start_date);
    const contractEnd = toDateInputValue(contract.end_date);
    // 優先: 契約工期 → 既存入力/AI推定（No.64）
    setStartDate((prev) => contractStart || prev || initialStartDate || aiSuggestion?.start || "");
    setEndDate((prev) => contractEnd || prev || initialEndDate || aiSuggestion?.end || "");
    if (contractStart && contractEnd) setDateSource("contract");
    else if (initialStartDate || aiSuggestion) setDateSource((s) => s ?? "ai");
    setAssignedTo((prev) => contract.assigned_to || prev || initialAssignedTo);
    setDepartmentName(contract.department_name ?? "");
    if (!titleTouched) {
      setTitle(contract.title);
    }
  }, [titleTouched, initialStartDate, initialEndDate, initialAssignedTo, aiSuggestion]);

  const clearContractFields = useCallback(() => {
    setCustomerId(initialCustomerId);
    setOrderAmount(initialOrderAmount);
    // 契約解除時は AI 推定工期へ戻す（空にしない）
    setStartDate(initialStartDate || aiSuggestion?.start || "");
    setEndDate(initialEndDate || aiSuggestion?.end || "");
    setDateSource(initialStartDate || aiSuggestion ? "ai" : null);
    setAssignedTo(initialAssignedTo || "");
    setDepartmentName("");
    if (!titleTouched) {
      setTitle(initialTitle);
    }
  }, [initialCustomerId, initialOrderAmount, initialTitle, titleTouched, initialStartDate, initialEndDate, initialAssignedTo, aiSuggestion]);

  const applyAiSuggestion = () => {
    if (!aiSuggestion) return;
    setStartDate(aiSuggestion.start);
    setEndDate(aiSuggestion.end);
    setDateSource("ai");
    toast.success("AI推定工期を反映しました。必要に応じて調整してください");
  };

  useEffect(() => {
    const filtered = initialCustomerId
      ? contracts.filter((c) => c.customer_id === initialCustomerId)
      : contracts;

    if (initialContractId) {
      const fromUrl = contracts.find((c) => c.id === initialContractId);
      if (fromUrl) {
        setContractId(fromUrl.id);
        applyContract(fromUrl);
      }
    } else if (filtered.length === 1) {
      setContractId(filtered[0].id);
      applyContract(filtered[0]);
    }
  }, [applyContract, contracts, initialCustomerId, initialContractId]);

  const visibleContracts = useMemo(() => {
    if (!initialCustomerId) return contracts;
    return contracts.filter((c) => c.customer_id === initialCustomerId);
  }, [contracts, initialCustomerId]);

  const selectedContract = useMemo(
    () => contracts.find((c) => c.id === contractId),
    [contracts, contractId],
  );

  const customerDisplayName = selectedContract?.customer_name ?? "契約を選択してください";

  const handleContractChange = (value: string) => {
    if (value === "_none") {
      setContractId("");
      clearContractFields();
      return;
    }

    setContractId(value);
    const contract = contracts.find((c) => c.id === value);
    if (contract) {
      applyContract(contract);
    }
  };

  const handleSave = async () => {
    if (!contractId) {
      toast.error("契約を選択してください");
      return;
    }
    if (!title.trim()) {
      toast.error("工事名を入力してください");
      return;
    }

    setSaving(true);
    try {
      await createConstruction({
        title: title.trim(),
        customer_id: customerId || undefined,
        contract_id: contractId,
        deal_id: initialDealId || undefined,
        estimate_id: initialEstimateId || undefined,
        assigned_to: assignedTo || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        order_amount: orderAmount ? Number(orderAmount) : undefined,
        budget_cost: budgetCost ? Number(budgetCost) : undefined,
        department_name: departmentName || undefined,
      });
      toast.success("登録しました");
      router.push("/constructions");
    } catch {
      toast.error("登録に失敗");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-3">
      <div className="flex items-center gap-2">
        <Link href="/constructions">
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">新規工事登録</h1>
      </div>

      {initialDealId && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
          受注確定フローから遷移しました。契約・見積・顧客情報が自動転記されています。
        </div>
      )}

      {aiSuggestion && (
        <div className="rounded-lg border border-sky-200 bg-sky-50/90 px-4 py-3 text-sm text-sky-950">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <p className="font-medium flex items-center gap-1.5">
                <Sparkles className="size-3.5 shrink-0 text-sky-700" />
                AI推定工期（提案）
              </p>
              <p className="text-base font-semibold tabular-nums tracking-tight">
                {aiSuggestion.start} 〜 {aiSuggestion.end}
              </p>
              <p className="text-xs text-sky-900/70">{aiSuggestion.reason}</p>
              <p className="text-xs text-muted-foreground">
                着工日・竣工日は下の入力欄で確認・手動調整できます
                {dateSource === "contract" && "（現在は契約工期を転記中）"}
                {dateSource === "ai" && "（現在はAI推定を反映中）"}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0 border-sky-300 bg-white hover:bg-sky-100"
              onClick={applyAiSuggestion}
            >
              この工期を反映
            </Button>
          </div>
        </div>
      )}

      <Card className="py-3 gap-2">
        <CardHeader className="px-4 py-0 pb-2">
          <CardTitle className="text-sm font-semibold">工事情報</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0 space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">契約 *</Label>
            <Select value={contractId || "_none"} onValueChange={handleContractChange}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="契約済み・履行中の契約を選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">未選択</SelectItem>
                {visibleContracts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.contract_no} · {c.title}（{getStatusLabel(c.status)}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              顧客: {customerDisplayName}
            </p>
            {initialCustomerId && visibleContracts.length === 0 && (
              <p className="text-xs text-amber-600">
                この顧客の契約済み・履行中の契約がありません。契約管理で契約を確定してください。
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-3 gap-y-2.5">
            <div className="space-y-1 sm:col-span-2 lg:col-span-3 xl:col-span-4">
              <Label className="text-xs">工事名 *</Label>
              <Input
                className="h-8"
                value={title}
                onChange={(e) => {
                  setTitleTouched(true);
                  setTitle(e.target.value);
                }}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">担当者</Label>
              <Select
                value={assignedTo || "_none"}
                onValueChange={(v) => setAssignedTo(v === "_none" ? "" : v)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">未設定</SelectItem>
                  {profiles.map((p) => {
                    const scored = assigneeCandidates.find((c) => c.profileId === p.id);
                    return (
                      <SelectItem key={p.id} value={p.id}>
                        {p.display_name}{scored ? `（適合度 ${scored.score}）` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {assigneeCandidates.length > 0 && (
                <div className="rounded-md border border-border/50 bg-muted/20 p-2 space-y-1">
                  <p className="text-[10px] text-muted-foreground">AI現場担当者推薦</p>
                  {assigneeCandidates.slice(0, 5).map((c) => (
                    <button
                      key={c.profileId}
                      type="button"
                      className={`w-full text-left text-xs px-1.5 py-1 rounded hover:bg-background ${
                        assignedTo === c.profileId ? "bg-background font-medium" : ""
                      }`}
                      onClick={() => setAssignedTo(c.profileId)}
                    >
                      {c.displayName}
                      <span className="text-muted-foreground ml-1">適合度 {c.score}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">部門（BI集計）</Label>
              <Select
                value={departmentName || "_none"}
                onValueChange={(v) => setDepartmentName(v === "_none" ? "" : v)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">未設定</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">受注額</Label>
              <Input className="h-8" type="number" value={orderAmount} onChange={(e) => setOrderAmount(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">
                着工日
                {dateSource === "ai" && <span className="ml-1 text-[10px] text-sky-700 font-normal">AI推定</span>}
                {dateSource === "contract" && <span className="ml-1 text-[10px] text-emerald-700 font-normal">契約転記</span>}
              </Label>
              <Input
                className="h-8"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setDateSource("manual");
                  setStartDate(e.target.value);
                }}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">
                竣工日
                {dateSource === "ai" && <span className="ml-1 text-[10px] text-sky-700 font-normal">AI推定</span>}
                {dateSource === "contract" && <span className="ml-1 text-[10px] text-emerald-700 font-normal">契約転記</span>}
              </Label>
              <Input
                className="h-8"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setDateSource("manual");
                  setEndDate(e.target.value);
                }}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">予算原価</Label>
              <Input className="h-8" type="number" value={budgetCost} onChange={(e) => setBudgetCost(e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1 border-t border-border/50">
            <Link href="/constructions">
              <Button variant="outline" size="sm">キャンセル</Button>
            </Link>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="size-3.5 mr-1" />
              {saving ? "登録中..." : "工事登録"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function ConstructionNewClient(props: ConstructionNewClientProps) {
  return (
    <Suspense fallback={<div className="p-4 md:p-8 text-sm text-muted-foreground">読み込み中...</div>}>
      <ConstructionNewPageContent {...props} />
    </Suspense>
  );
}
