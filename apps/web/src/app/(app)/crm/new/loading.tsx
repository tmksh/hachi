import { Skeleton } from "@/components/ui/skeleton";

export default function CrmNewLoading() {
  return (
    <div className="p-4 md:p-6 space-y-4 animate-in fade-in duration-150">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-[520px] w-full rounded-2xl" />
    </div>
  );
}
