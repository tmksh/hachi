"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageLoadingFallback } from "@/components/shared/page-loading-fallback";
import { fetchContract } from "@/lib/queries/details";
import { fetchCustomers } from "@/lib/queries/customers";
import { fetchEstimates, fetchProfiles, LIST_STALE_MS } from "@/lib/queries/lists";
import { ESTIMATE_QK } from "@/lib/queries/estimates";
import { DETAIL_STALE_MS } from "@/lib/queries/portal";
import { ContractEditClient } from "./contract-edit-client";

export function ContractEditPageClient() {
  const { id } = useParams<{ id: string }>();
  const { data: contract, isPending: contractPending } = useQuery({
    queryKey: ["contract", id],
    queryFn: () => fetchContract(id),
    staleTime: DETAIL_STALE_MS,
    enabled: !!id,
  });
  const { data: customerResult, isPending: cPending } = useQuery({
    queryKey: ["customers", 1, ""],
    queryFn: () => fetchCustomers({ page: 1, limit: 100 }),
    staleTime: LIST_STALE_MS,
  });
  const { data: estimates, isPending: ePending } = useQuery({
    queryKey: ESTIMATE_QK.all,
    queryFn: fetchEstimates,
    staleTime: LIST_STALE_MS,
  });
  const { data: profiles, isPending: pPending } = useQuery({
    queryKey: ["profiles"],
    queryFn: fetchProfiles,
    staleTime: 5 * 60_000,
  });

  if (contractPending || cPending || ePending || pPending) return <PageLoadingFallback />;
  if (!contract || !customerResult || !estimates || !profiles) {
    return <p className="p-6 text-sm text-muted-foreground">契約が見つかりません</p>;
  }

  return (
    <ContractEditClient
      id={id}
      initialContract={contract}
      initialCustomers={customerResult.customers.map((x) => ({ id: x.id, name: x.name }))}
      initialEstimates={estimates.map((x) => ({
        id: x.id,
        estimate_no: x.estimate_no,
        title: x.title,
        customer_id: x.customer_id,
        total: x.total,
      }))}
      initialProfiles={profiles.map((x) => ({ id: x.id, display_name: x.display_name }))}
    />
  );
}
