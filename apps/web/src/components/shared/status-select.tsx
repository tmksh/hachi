"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ENTITY_STATUS_OPTIONS,
  getStatusLabel,
  type StatusEntity,
} from "@/lib/status-config";
import { cn } from "@/lib/utils";

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
  cancelled: "bg-gray-100 text-gray-500 border-gray-200/80",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
};

interface StatusSelectProps {
  entity: StatusEntity;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  stopPropagation?: boolean;
}

export function StatusSelect({
  entity,
  value,
  onValueChange,
  disabled,
  className,
  triggerClassName,
  stopPropagation = true,
}: StatusSelectProps) {
  const options = ENTITY_STATUS_OPTIONS[entity];
  const current = options.find((o) => o.value === value);
  const badgeStyle = STATUS_BADGE_STYLES[value] ?? "bg-muted/60 text-muted-foreground border-border/60";

  const select = (
    <Select value={value} disabled={disabled} onValueChange={onValueChange}>
      <SelectTrigger
        size="sm"
        className={cn(
          "h-7 min-h-7 w-auto min-w-[5rem] px-3 rounded-full border-0 text-xs font-medium shadow-none justify-center",
          "hover:opacity-90 focus-visible:ring-1 focus-visible:ring-ring/30",
          "bg-transparent dark:bg-transparent dark:hover:bg-transparent",
          "[&>svg]:hidden",
          badgeStyle,
          triggerClassName,
        )}
      >
        <SelectValue>{current?.label ?? getStatusLabel(value)}</SelectValue>
      </SelectTrigger>
      <SelectContent align="start">
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="text-xs">
            <span
              className={cn(
                "inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-medium",
                STATUS_BADGE_STYLES[opt.value] ?? "bg-muted text-muted-foreground border-border",
              )}
            >
              {opt.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (!stopPropagation) return select;

  return (
    <div className={className} onClick={(e) => e.stopPropagation()}>
      {select}
    </div>
  );
}
