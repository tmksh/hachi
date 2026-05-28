"use client";

import { useState, useEffect, Suspense, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import { createConstruction } from "@/lib/actions/constructions";
import { getBiDepartmentNames } from "@/lib/actions/bi";
import { getContracts } from "@/lib/actions/contracts";
import { getProfiles } from "@/lib/actions/profiles";
import { getStatusLabel } from "@/lib/status-config";

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

function ConstructionNewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCustomerId = searchParams.get("customer_id") ?? "";
  const initialTitle = searchParams.get("title") ?? "";
  const initialOrderAmount = searchParams.get("order_amount") ?? "";

  const [saving, setSaving] = useState(false);
  const [contracts, setContracts] = useState<EligibleContract[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; display_name: string }[]>([]);
  const [title, setTitle] = useState(initialTitle);
  const [titleTouched, setTitleTouched] = useState(Boolean(initialTitle));
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [contractId, setContractId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [orderAmount, setOrderAmount] = useState(initialOrderAmount);
  const [budgetCost, setBudgetCost] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [departments, setDepartments] = useState<string[]>([]);

  const applyContract = useCallback((contract: EligibleContract) => {
    setCustomerId(contract.customer_id ?? "");
    setOrderAmount(String(contract.amount ?? ""));
    setStartDate(toDateInputValue(contract.start_date));
    setEndDate(toDateInputValue(contract.end_date));
    setAssignedTo(contract.assigned_to ?? "");
    setDepartmentName(contract.department_name ?? "");
    if (!titleTouched) {
      setTitle(contract.title);
    }
  }, [titleTouched]);

  const clearContractFields = useCallback(() => {
    setCustomerId(initialCustomerId);
    setOrderAmount(initialOrderAmount);
    setStartDate("");
    setEndDate("");
    setAssignedTo("");
    setDepartmentName("");
    if (!titleTouched) {
      setTitle(initialTitle);
    }
  }, [initialCustomerId, initialOrderAmount, initialTitle, titleTouched]);

  useEffect(() => {
    Promise.all([getContracts(), getProfiles(), getBiDepartmentNames()])
      .then(([allContracts, p, depts]) => {
        const eligible = allContracts
          .filter((c) => ELIGIBLE_STATUSES.has(c.status))
          .map((c) => ({
            id: c.id,
            contract_no: c.contract_no,
            title: c.title,
            status: c.status as "contracted" | "executing",
            customer_id: c.customer_id,
            customer_name:
              c.customer?.company_name ||
              c.customer?.name ||
              "（顧客未設定）",
            amount: c.amount,
            start_date: c.start_date,
            end_date: c.end_date,
            assigned_to: c.assigned_to,
            department_name: c.department_name,
          }));

        setContracts(eligible);
        setProfiles(p.map((x) => ({ id: x.id, display_name: x.display_name })));
        setDepartments(depts);

        const filtered = initialCustomerId
          ? eligible.filter((c) => c.customer_id === initialCustomerId)
          : eligible;

        if (filtered.length === 1) {
          setContractId(filtered[0].id);
          applyContract(filtered[0]);
        }
      })
      .catch(() => {});
  }, [applyContract, initialCustomerId]);

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
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Label className="text-xs">着工日</Label>
              <Input className="h-8" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">竣工日</Label>
              <Input className="h-8" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
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
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ConstructionNewPage() {
  return (
    <Suspense fallback={<div className="p-4 md:p-8 text-sm text-muted-foreground">読み込み中...</div>}>
      <ConstructionNewPageContent />
    </Suspense>
  );
}
