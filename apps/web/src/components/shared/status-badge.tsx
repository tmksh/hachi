"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_COLORS } from "@/lib/constants";

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "下書き",
  pending: "承認待ち",
  approved: "承認済み",
  rejected: "差戻し",
  submitted: "提出済み",
  cancelled: "キャンセル",
  active: "有効",
  completed: "完了",
  preparing: "準備中",
  contracted: "契約済み",
  executing: "履行中",
  in_progress: "進行中",
  suspended: "中断",
  delayed: "遅延",
  issued: "発行済み",
  sent: "送信済み",
  accepted: "受理",
  paid: "支払済み",
};

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
      {label ?? STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
