"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCustomerEntryMasters,
  type CustomerEntryMasters,
} from "@/lib/actions/customers";

export const CUSTOMER_ENTRY_MASTERS_KEY = ["customer-entry-masters"] as const;

export function useCustomerEntryMasters(initialData?: CustomerEntryMasters) {
  return useQuery({
    queryKey: CUSTOMER_ENTRY_MASTERS_KEY,
    queryFn: getCustomerEntryMasters,
    staleTime: 5 * 60_000,
    initialData,
    initialDataUpdatedAt: initialData ? Date.now() : undefined,
  });
}

/** SSR で取得したマスタをキャッシュし、フォームの追加 fetch を避ける */
export function useSeedCustomerEntryMasters(masters?: CustomerEntryMasters | null) {
  const queryClient = useQueryClient();
  useState(() => {
    if (masters) {
      queryClient.setQueryData(CUSTOMER_ENTRY_MASTERS_KEY, masters);
    }
  });
}
