"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PageLoadingFallback } from "@/components/shared/page-loading-fallback";
import { fetchContracts, fetchProfiles, LIST_STALE_MS } from "@/lib/queries/lists";
import { fetchDepartmentNames } from "@/lib/queries/portal";
import { ConstructionNewClient } from "./construction-new-client";

const ELIGIBLE_STATUSES = new Set(["contracted", "executing"]);

function ConstructionNewPageContent() {
  const searchParams = useSearchParams();
  const get = (key: string) => searchParams.get(key) ?? "";
  const initialContractId = get("contract_id");

  const { data: allContracts, isPending: contractsPending } = useQuery({
    queryKey: ["contracts"],
    queryFn: fetchContracts,
    staleTime: LIST_STALE_MS,
  });
  const { data: profiles, isPending: profilesPending } = useQuery({
    queryKey: ["profiles"],
    queryFn: fetchProfiles,
    staleTime: 5 * 60_000,
  });
  const { data: departments, isPending: deptPending } = useQuery({
    queryKey: ["bi-departments"],
    queryFn: () => fetchDepartmentNames(),
    staleTime: 5 * 60_000,
  });

  if (contractsPending || profilesPending || deptPending || allContracts === undefined || !profiles || !departments) {
    return <PageLoadingFallback />;
  }

  const initialContracts = (allContracts ?? [])
    .filter((c) => ELIGIBLE_STATUSES.has(c.status) || c.id === initialContractId)
    .map((c) => {
      const customer = Array.isArray(c.customer) ? c.customer[0] : c.customer;
      return {
        id: c.id,
        contract_no: c.contract_no,
        title: c.title,
        status: c.status as "contracted" | "executing",
        customer_id: c.customer_id,
        customer_name: customer?.company_name || customer?.name || "（顧客未設定）",
        amount: Number(c.amount) || 0,
        start_date: null as string | null,
        end_date: null as string | null,
        assigned_to: c.assigned_to,
        department_name: null as string | null,
      };
    });

  let assigneeCandidates: Array<{ profileId: string; displayName: string; score: number }> = [];
  try {
    const raw = get("assignee_candidates");
    if (raw) {
      const parsed = JSON.parse(decodeURIComponent(raw)) as Array<{
        profileId: string;
        displayName: string;
        score: number;
      }>;
      if (Array.isArray(parsed)) assigneeCandidates = parsed;
    }
  } catch {
    assigneeCandidates = [];
  }

  return (
    <ConstructionNewClient
      initialContracts={initialContracts}
      initialProfiles={profiles.map((x) => ({ id: x.id, display_name: x.display_name }))}
      initialDepartments={departments}
      initialCustomerId={get("customer_id")}
      initialContractId={initialContractId}
      initialDealId={get("deal_id")}
      initialEstimateId={get("estimate_id")}
      initialTitle={get("title")}
      initialOrderAmount={get("order_amount")}
      initialStartDate={get("start_date")}
      initialEndDate={get("end_date")}
      initialDurationReason={get("duration_reason")}
      initialAssignedTo={get("assigned_to")}
      initialAssigneeCandidates={assigneeCandidates}
    />
  );
}

export function ConstructionNewPageClient() {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <ConstructionNewPageContent />
    </Suspense>
  );
}
