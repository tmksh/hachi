"use client";

import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCraftsmenMasterOptions } from "@/hooks/use-craftsmen-master-options";
import { cn } from "@/lib/utils";

const NONE = "__none__";

export function CraftsmanMasterFields({
  specialty,
  onSpecialtyChange,
  qualifications,
  onQualificationsChange,
}: {
  specialty: string;
  onSpecialtyChange: (value: string) => void;
  qualifications: string[];
  onQualificationsChange: (values: string[]) => void;
}) {
  const { specialties, qualifications: masterQuals, isPending } = useCraftsmenMasterOptions();

  const specialtyOptions = useMemo(() => {
    const labels = specialties.map((s) => s.label);
    if (specialty && !labels.includes(specialty)) labels.push(specialty);
    return labels;
  }, [specialties, specialty]);

  const qualificationOptions = useMemo(() => {
    const labels = masterQuals.map((q) => q.label);
    for (const q of qualifications) {
      if (q && !labels.includes(q)) labels.push(q);
    }
    return labels;
  }, [masterQuals, qualifications]);

  const toggleQualification = (label: string) => {
    onQualificationsChange(
      qualifications.includes(label)
        ? qualifications.filter((x) => x !== label)
        : [...qualifications, label],
    );
  };

  return (
    <>
      <div className="space-y-2">
        <Label>職種区分</Label>
        <Select
          value={specialty || NONE}
          onValueChange={(v) => onSpecialtyChange(v === NONE ? "" : v)}
          disabled={isPending && specialtyOptions.length === 0}
        >
          <SelectTrigger><SelectValue placeholder={isPending ? "読み込み中…" : "選択"} /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>未設定</SelectItem>
            {specialtyOptions.map((label) => (
              <SelectItem key={label} value={label}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!isPending && specialties.length === 0 && (
          <p className="text-[11px] text-muted-foreground">設定 › マスタ › 職人マスタで職種区分を追加できます。</p>
        )}
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label>資格・保有免許</Label>
        {qualificationOptions.length === 0 ? (
          <p className="text-xs text-muted-foreground rounded-lg border border-dashed px-3 py-3">
            {isPending ? "読み込み中…" : "設定 › マスタ › 職人マスタで資格を追加できます。"}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {qualificationOptions.map((label) => {
              const on = qualifications.includes(label);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleQualification(label)}
                  className="rounded-full"
                >
                  <Badge
                    variant={on ? "default" : "outline"}
                    className={cn("cursor-pointer font-normal", on && "bg-emerald-700 hover:bg-emerald-700")}
                  >
                    {label}
                  </Badge>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
