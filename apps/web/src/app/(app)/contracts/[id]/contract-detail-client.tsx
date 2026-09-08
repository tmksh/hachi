"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/shared/status-badge";
import { CustomerAvatar } from "@/components/shared/customer-avatar";
import { ContractDetailTabs } from "@/components/contracts/contract-detail-tabs";
import { ArrowLeft } from "lucide-react";
import { fetchContract } from "@/lib/queries/details";
import { useSeedCustomerEntryMasters } from "@/hooks/use-customer-entry-masters";
import type { CustomerEntryMasters } from "@/lib/actions/customers";
import { PageLoadingFallback } from "@/components/shared/page-loading-fallback";

type ContractDetail = Awaited<ReturnType<typeof fetchContract>>;

type ContractDetailClientProps = {
  initialData?: ContractDetail | null;
  initialMasters?: CustomerEntryMasters;
};

export function ContractDetailClient({ initialData, initialMasters }: ContractDetailClientProps) {
  useSeedCustomerEntryMasters(initialMasters);
  const { id } = useParams();
  const contractId = id as string;
  const queryClient = useQueryClient();
  const { data, isPending, isError } = useQuery({
    queryKey: ["contract", contractId],
    queryFn: () => fetchContract(contractId),
    staleTime: 60_000,
    initialData: initialData ?? undefined,
    initialDataUpdatedAt: initialData ? Date.now() : undefined,
    enabled: !!contractId,
  });

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
  };

  if (isPending) return <PageLoadingFallback />;
  if (!data || isError) return <div className="p-4 md:p-8"><Link href="/contracts" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4"><ArrowLeft className="h-4 w-4" />戻る</Link><p className="text-muted-foreground">契約が見つかりません</p></div>;

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
