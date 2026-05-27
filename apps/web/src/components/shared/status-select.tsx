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

  const select = (
    <Select value={value} disabled={disabled} onValueChange={onValueChange}>
      <SelectTrigger
        className={cn(
          "h-7 text-xs w-[118px]",
          current?.color ?? "text-muted-foreground",
          triggerClassName,
        )}
      >
        <SelectValue>{current?.label ?? getStatusLabel(value)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="text-xs">
            <span className={opt.color}>{opt.label}</span>
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
