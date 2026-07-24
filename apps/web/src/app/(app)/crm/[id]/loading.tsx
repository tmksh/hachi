import { Skeleton } from "@/components/ui/skeleton";

export default function CustomerDetailLoading() {
  return (
    <div className="p-4 md:p-6 space-y-4 animate-in fade-in duration-150">
      <Skeleton className="h-8 w-56" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
      <Skeleton className="h-[480px] w-full rounded-2xl" />
    </div>
  );
}
