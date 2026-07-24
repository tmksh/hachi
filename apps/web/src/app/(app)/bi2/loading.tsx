import { Skeleton } from "@/components/ui/skeleton";

export default function Bi2Loading() {
  return (
    <div className="p-5 md:p-7 space-y-5 max-w-[1500px] mx-auto animate-in fade-in duration-150">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-64" />
      </div>
      <div className="grid grid-cols-12 gap-4">
        <Skeleton className="col-span-12 md:col-span-4 h-40 rounded-2xl" />
        <Skeleton className="col-span-12 md:col-span-4 h-40 rounded-2xl" />
        <Skeleton className="col-span-12 md:col-span-4 h-40 rounded-2xl" />
        <Skeleton className="col-span-12 h-[360px] rounded-2xl" />
      </div>
    </div>
  );
}
