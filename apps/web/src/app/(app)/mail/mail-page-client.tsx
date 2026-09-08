"use client";

import { useQuery } from "@tanstack/react-query";
import { PageLoadingFallback } from "@/components/shared/page-loading-fallback";
import { fetchMailAccounts, fetchMailThreads, LIST_STALE_MS, QK } from "@/lib/queries/portal";
import { MailClient } from "./mail-client";

export function MailPageClient() {
  const { data: accounts, isPending: accountsPending } = useQuery({
    queryKey: QK.mailAccounts,
    queryFn: fetchMailAccounts,
    staleTime: LIST_STALE_MS,
  });
  const { data: threads, isPending: threadsPending } = useQuery({
    queryKey: QK.mailThreads,
    queryFn: fetchMailThreads,
    staleTime: LIST_STALE_MS,
  });

  if (accountsPending || threadsPending || accounts === undefined || threads === undefined) {
    return <PageLoadingFallback />;
  }

  return <MailClient initialAccounts={accounts} initialThreads={threads} />;
}
