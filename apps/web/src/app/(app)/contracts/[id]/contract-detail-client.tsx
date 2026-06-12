"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/shared/status-badge";
import { CustomerAvatar } from "@/components/shared/customer-avatar";
import { ContractDetailTabs } from "@/components/contracts/contract-detail-tabs";
import { ArrowLeft } from "lucide-react";
import { getContract } from "@/lib/actions/contracts";

type ContractDetail = Awaited<ReturnType<typeof getContract>>;

type ContractDetailClientProps = {
  initialData: ContractDetail | null;
};

export function ContractDetailClient({ initialData }: ContractDetailClientProps) {
  const { id } = useParams();
  const [data, setData] = useState<ContractDetail | null>(initialData);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const reload = () => {
    if (!id) return;
    getContract(id as string).then(setData).catch(() => {});
  };

  if (!data) return <div className="p-4 md:p-8"><Link href="/contracts" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4"><ArrowLeft className="h-4 w-4" />戻る</Link><p className="text-muted-foreground">契約が見つかりません</p></div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <Link href="/contracts" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />契約一覧</Link>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            {data.customer && (
              <CustomerAvatar seed={data.customer.id} name={data.customer.name} size="md" />
            )}
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">{data.contract_no}</h1>
                <StatusBadge status={data.status} />
              </div>
              <p className="text-sm text-muted-foreground mt-1">{data.customer?.name ?? "-"} - {data.title}</p>
            </div>
          </div>
        </div>
        <div className="text-right sm:text-left">
          <p className="text-sm text-muted-foreground">契約金額</p>
          <p className="text-xl font-semibold tabular-nums">¥{(data.amount ?? 0).toLocaleString()}</p>
        </div>
      </div>

      <ContractDetailTabs data={data} contractId={id as string} onRefresh={reload} />
    </div>
  );
}
