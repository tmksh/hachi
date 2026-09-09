"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save } from "lucide-react";
import { updateContract } from "@/lib/actions/contracts";
import type { fetchContract } from "@/lib/queries/details";
import { ContractFormFields } from "@/components/contracts/contract-form-fields";

type Contract = Awaited<ReturnType<typeof fetchContract>>;

type ContractEditClientProps = {
  id: string;
  initialContract: Contract;
  initialCustomers: { id: string; name: string }[];
  initialEstimates: { id: string; estimate_no: string; title: string | null; customer_id: string | null; total?: number | null }[];
  initialProfiles: { id: string; display_name: string }[];
};

export function ContractEditClient({
  id,
  initialContract,
  initialCustomers,
  initialEstimates,
  initialProfiles,
}: ContractEditClientProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const customers = initialCustomers;
  const estimates = initialEstimates;
  const profiles = initialProfiles;
  const [customerId, setCustomerId] = useState(initialContract.customer_id ?? "");
  const [title, setTitle] = useState(initialContract.title);
  const [status, setStatus] = useState(initialContract.status);
  const [amount, setAmount] = useState(initialContract.amount ? String(initialContract.amount) : "");
  const [contractDate, setContractDate] = useState(initialContract.contract_date ?? "");
  const [startDate, setStartDate] = useState(initialContract.start_date ?? "");
  const [endDate, setEndDate] = useState(initialContract.end_date ?? "");
  const [estimateId, setEstimateId] = useState(initialContract.estimate_id ?? "");
  const [assignedTo, setAssignedTo] = useState(initialContract.assigned_to ?? "");
  const [notes, setNotes] = useState(initialContract.notes ?? "");

  const handleCustomerChange = (customerIdValue: string) => {
    setCustomerId(customerIdValue);
    setEstimateId((prev: string) => (estimates.some((e) => e.id === prev && e.customer_id === customerIdValue) ? prev : ""));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("件名を入力してください");
      return;
    }
    setSaving(true);
    try {
      await updateContract(id, {
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
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pb-6">
        <Link href={`/contracts/${id}`}>
          <Button variant="outline">キャンセル</Button>
        </Link>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="size-4 mr-1" />
          {saving ? "保存中..." : "保存"}
        </Button>
      </div>
    </div>
  );
}
