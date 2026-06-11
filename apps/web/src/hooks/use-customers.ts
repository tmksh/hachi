"use client";

import { useQuery } from "@tanstack/react-query";
import { getCustomers, getCustomerCounts, type CustomerListResult } from "@/lib/actions/customers";

export type CustomerWithDeals = CustomerListResult["customers"][number];

export function useCustomers(page: number, search: string) {
  return useQuery({
    queryKey: ["customers", page, search],
    queryFn: () => getCustomers({ page, limit: 50, search: search || undefined }),
    placeholderData: (prev) => prev,
  });
}

export function useCustomerCounts() {
  return useQuery({
    queryKey: ["customer-counts"],
    queryFn: getCustomerCounts,
    staleTime: 120_000,
  });
}
