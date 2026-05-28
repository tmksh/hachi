"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Save } from "lucide-react";
import { createContract } from "@/lib/actions/contracts";
import { getCustomers } from "@/lib/actions/customers";
import { getEstimates } from "@/lib/actions/estimates";
import { getProfiles } from "@/lib/actions/profiles";
import { ContractFormFields } from "@/components/contracts/contract-form-fields";

export default function ContractNewPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loadingOpts, setLoadingOpts] = useState(true);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [estimates, setEstimates] = useState<
    { id: string; estimate_no: string; title: string | null; customer_id: string | null; total?: number | null }[]
  >([]);
  const [profiles, setProfiles] = useState<{ id: string; display_name: string }[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [contractDate, setContractDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [estimateId, setEstimateId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    Promise.all([getCustomers(), getEstimates(), getProfiles()])
      .then(([c, e, p]) => {
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
      })
      .finally(() => setLoadingOpts(false));
  }, []);

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
      await createContract({
        title: title.trim(),
        customer_id: customerId || undefined,
        estimate_id: estimateId || undefined,
        contract_date: contractDate || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        amount: amount ? Number(amount) : undefined,
        assigned_to: assignedTo || undefined,
        notes: notes || undefined,
      });
      toast.success("契約を登録しました");
      router.push("/contracts");
    } catch {
      toast.error("登録に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/contracts">
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <PageHeader title="新規契約登録" description="顧客・金額・関連見積を登録します" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">契約情報</CardTitle>
          <CardDescription>上から順に入力してください</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingOpts ? (
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
            />
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pb-6">
        <Link href="/contracts">
          <Button variant="outline">キャンセル</Button>
        </Link>
        <Button onClick={handleSave} disabled={saving || loadingOpts}>
          <Save className="size-4 mr-1" />
          {saving ? "保存中..." : "保存"}
        </Button>
      </div>
    </div>
  );
}
