"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Save } from "lucide-react";
import { getContract, updateContract } from "@/lib/actions/contracts";
import { getCustomers } from "@/lib/actions/customers";
import { getEstimates } from "@/lib/actions/estimates";
import { getProfiles } from "@/lib/actions/profiles";
import { ContractFormFields } from "@/components/contracts/contract-form-fields";

export default function ContractEditPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [estimates, setEstimates] = useState<
    { id: string; estimate_no: string; title: string | null; customer_id: string | null; total?: number | null }[]
  >([]);
  const [profiles, setProfiles] = useState<{ id: string; display_name: string }[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("preparing");
  const [amount, setAmount] = useState("");
  const [contractDate, setContractDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [estimateId, setEstimateId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!id) return;
    Promise.all([getContract(id as string), getCustomers({ limit: 100 }), getEstimates(), getProfiles()])
      .then(([contract, customerResult, e, p]) => {
        const c = customerResult.customers;
        setCustomers(c.map((x) => ({ id: x.id, name: x.name })));
        setEstimates(
          e.map((x) => ({
            id: x.id,
            estimate_no: x.estimate_no,
            title: x.title,
            customer_id: x.customer_id,
            total: x.total,
          })),
        );
        setProfiles(p.map((x) => ({ id: x.id, display_name: x.display_name })));
        setCustomerId(contract.customer_id ?? "");
        setTitle(contract.title);
        setStatus(contract.status);
        setAmount(contract.amount ? String(contract.amount) : "");
        setContractDate(contract.contract_date ?? "");
        setStartDate(contract.start_date ?? "");
        setEndDate(contract.end_date ?? "");
        setEstimateId(contract.estimate_id ?? "");
        setAssignedTo(contract.assigned_to ?? "");
        setNotes(contract.notes ?? "");
      })
      .catch(() => toast.error("取得に失敗"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleCustomerChange = (id: string) => {
    setCustomerId(id);
    setEstimateId((prev) => (estimates.some((e) => e.id === prev && e.customer_id === id) ? prev : ""));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("件名を入力してください");
      return;
    }
    setSaving(true);
    try {
      await updateContract(id as string, {
        title: title.trim(),
        customer_id: customerId || null,
        estimate_id: estimateId || null,
        status: status as "preparing" | "contracted" | "executing" | "completed" | "cancelled",
        contract_date: contractDate || null,
        start_date: startDate || null,
        end_date: endDate || null,
        amount: amount ? Number(amount) : 0,
        assigned_to: assignedTo || null,
        notes: notes || null,
      });
      toast.success("更新しました");
      router.push(`/contracts/${id}`);
    } catch {
      toast.error("更新に失敗");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Link href={`/contracts/${id}`}>
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">契約編集</h1>
          <p className="text-sm text-muted-foreground mt-0.5">契約内容と関連見積を更新します</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">契約情報</CardTitle>
          <CardDescription>上から順に入力してください</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <ContractFormFields
              customers={customers}
              profiles={profiles}
              estimates={estimates}
              customerId={customerId}
              onCustomerChange={handleCustomerChange}
              title={title}
              onTitleChange={setTitle}
              assignedTo={assignedTo}
              onAssignedToChange={setAssignedTo}
              amount={amount}
              onAmountChange={setAmount}
              contractDate={contractDate}
              onContractDateChange={setContractDate}
              startDate={startDate}
              onStartDateChange={setStartDate}
              endDate={endDate}
              onEndDateChange={setEndDate}
              estimateId={estimateId}
              onEstimateChange={setEstimateId}
              notes={notes}
              onNotesChange={setNotes}
              status={status}
              onStatusChange={setStatus}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pb-6">
        <Link href={`/contracts/${id}`}>
          <Button variant="outline">キャンセル</Button>
        </Link>
        <Button onClick={handleSave} disabled={saving || loading}>
          <Save className="size-4 mr-1" />
          {saving ? "保存中..." : "保存"}
        </Button>
      </div>
    </div>
  );
}
