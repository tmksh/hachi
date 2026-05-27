"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_COLORS } from "@/lib/constants";
import { getStatusLabel } from "@/lib/status-config";

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const colorClass =
    STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? STATUS_COLORS.draft;

  return (
    <Badge
      variant="secondary"
      className={cn(
        "font-medium text-xs border-0",
        colorClass,
        className,
      )}
    >
      {label ?? getStatusLabel(status)}
    </Badge>
  );
}
