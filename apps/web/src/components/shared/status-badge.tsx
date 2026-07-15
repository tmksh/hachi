"use client";

import { cn } from "@/lib/utils";
import { getStatusLabel } from "@/lib/status-config";

const STATUS_BADGE_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600 border-slate-200/80",
  pending: "bg-amber-50 text-amber-700 border-amber-200/80",
  preparing: "bg-orange-50 text-orange-700 border-orange-200/80",
  submitted: "bg-blue-50 text-blue-700 border-blue-200/80",
  issued: "bg-blue-50 text-blue-700 border-blue-200/80",
  sent: "bg-sky-50 text-sky-700 border-sky-200/80",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200/80",
  executing: "bg-blue-50 text-blue-700 border-blue-200/80",
  contracted: "bg-indigo-50 text-indigo-700 border-indigo-200/80",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  accepted: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  suspended: "bg-amber-50 text-amber-700 border-amber-200/80",
  delayed: "bg-rose-50 text-rose-600 border-rose-200/80",
  rejected: "bg-rose-50 text-rose-600 border-rose-200/80",
  returned: "bg-amber-50 text-amber-700 border-amber-200/80",
  cancelled: "bg-gray-100 text-gray-500 border-gray-200/80",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  none: "bg-slate-100 text-slate-600 border-slate-200/80",
  conditional: "bg-violet-50 text-violet-700 border-violet-200/80",
};

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const colorClass =
    STATUS_BADGE_STYLES[status] ?? "bg-muted/60 text-muted-foreground border-border/60";

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-medium",
        colorClass,
        className,
      )}
    >
      {label ?? getStatusLabel(status)}
    </span>
  );
}
