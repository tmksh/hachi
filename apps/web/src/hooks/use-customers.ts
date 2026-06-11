"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchCustomers,
  fetchCustomerCounts,
  fetchCustomerDealSummaries,
  fetchUnfollowedCustomers,
  fetchUnfollowedCustomersCount,
  type CustomerListItem,
} from "@/lib/queries/customers";
import type { CustomerListResult } from "@/lib/actions/customers";

export type { CustomerListItem as CustomerWithDeals };

export function useCustomers(
  page: number,
  search: string,
  enabled = true,
  initialData?: CustomerListResult,
) {
  return useQuery({
    queryKey: ["customers", page, search],
    queryFn: () => fetchCustomers({ page, limit: 50, search: search || undefined }),
    placeholderData: (prev) => prev,
    enabled,
    initialData: page === 1 && !search ? initialData : undefined,
    initialDataUpdatedAt: page === 1 && !search && initialData ? Date.now() : undefined,
  });
}

export function useCustomerCounts(initialData?: Awaited<ReturnType<typeof fetchCustomerCounts>>) {
  return useQuery({
    queryKey: ["customer-counts"],
    queryFn: fetchCustomerCounts,
    staleTime: 120_000,
    initialData,
    initialDataUpdatedAt: initialData ? Date.now() : undefined,
  });
}

export function useUnfollowedCustomers(page: number, enabled = true) {
  return useQuery({
    queryKey: ["unfollowed-customers", page],
    queryFn: () => fetchUnfollowedCustomers({ page, limit: 50 }),
    placeholderData: (prev) => prev,
    enabled,
  });
}

export function useUnfollowedCustomersCount(initialData?: number) {
  return useQuery({
    queryKey: ["unfollowed-customers-count"],
    queryFn: () => fetchUnfollowedCustomersCount(),
    staleTime: 120_000,
    initialData,
    initialDataUpdatedAt: initialData !== undefined ? Date.now() : undefined,
  });
}

export function useCustomerDealSummaries(
  customerIds: string[],
  initialData?: Record<string, string>,
) {
  const initialMap = initialData ? new Map(Object.entries(initialData)) : undefined;
  return useQuery({
    queryKey: ["customer-deal-summaries", customerIds],
    queryFn: () => fetchCustomerDealSummaries(customerIds),
    enabled: customerIds.length > 0,
    staleTime: 60_000,
    initialData: initialMap,
    initialDataUpdatedAt: initialMap ? Date.now() : undefined,
  });
}
