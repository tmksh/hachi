import { Skeleton } from "@/components/ui/skeleton";

/** クライアント先行ページでデータ待ちの間に出すシェル */
export function PageLoadingFallback() {
  return (
    <div className="p-4 md:p-6 space-y-4 animate-in fade-in duration-150">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
      <Skeleton className="h-[420px] w-full rounded-2xl" />
    </div>
  );
}
