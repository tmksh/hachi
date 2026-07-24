import { Skeleton } from "@/components/ui/skeleton";

export default function CalendarLoading() {
  return (
    <div className="p-4 md:p-6 space-y-4 animate-in fade-in duration-150">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-[640px] w-full rounded-2xl" />
    </div>
  );
}
