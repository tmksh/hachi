"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Users, ChevronDown, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { CAL_QK, CALENDAR_STALE_MS, fetchCompanyMembers } from "@/lib/queries/calendar";

/** 予定の共有先メンバー選択（No.4-6-2） */
export function MemberShareSelect({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const { data: members = [] } = useQuery({
    queryKey: CAL_QK.members,
    queryFn: fetchCompanyMembers,
    staleTime: CALENDAR_STALE_MS,
  });
  const [open, setOpen] = useState(false);

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };
  const selected = members.filter((m) => value.includes(m.id));

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="w-full justify-between font-normal h-9"
          >
            <span className="flex items-center gap-2 text-sm truncate">
              <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {selected.length > 0
                ? `${selected.length}名に共有`
                : "共有するメンバーを選択"}
            </span>
            <ChevronDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-2" align="start">
          {members.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 px-1">
              共有できるメンバーがいません
            </p>
          ) : (
            <div className="max-h-52 overflow-y-auto space-y-0.5">
              {members.map((m) => (
                <Label
                  key={m.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer font-normal"
                >
                  <Checkbox
                    checked={value.includes(m.id)}
                    onCheckedChange={() => toggle(m.id)}
                  />
                  <span className="text-sm truncate">{m.display_name}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground truncate max-w-[110px]">
                    {m.email}
                  </span>
                </Label>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((m) => (
            <Badge key={m.id} variant="secondary" className="text-[10px] gap-1 pr-1">
              {m.display_name}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => toggle(m.id)}
                  className="rounded-full hover:bg-muted-foreground/20 p-0.5"
                  aria-label={`${m.display_name}の共有を解除`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
