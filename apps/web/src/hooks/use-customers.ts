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

export type { CustomerListItem as CustomerWithDeals };

export function useCustomers(page: number, search: string, enabled = true) {
  return useQuery({
    queryKey: ["customers", page, search],
    queryFn: () => fetchCustomers({ page, limit: 50, search: search || undefined }),
    placeholderData: (prev) => prev,
    enabled,
  });
}

export function useCustomerCounts() {
  return useQuery({
    queryKey: ["customer-counts"],
    queryFn: fetchCustomerCounts,
    staleTime: 120_000,
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

export function useUnfollowedCustomersCount() {
  return useQuery({
    queryKey: ["unfollowed-customers-count"],
    queryFn: () => fetchUnfollowedCustomersCount(),
    staleTime: 120_000,
  });
}

export function useCustomerDealSummaries(customerIds: string[]) {
  return useQuery({
    queryKey: ["customer-deal-summaries", customerIds],
    queryFn: () => fetchCustomerDealSummaries(customerIds),
    enabled: customerIds.length > 0,
    staleTime: 60_000,
  });
}
