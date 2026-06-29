"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BiSettingsPanel } from "@/components/bi/bi-settings-panel";
import { getCurrentFiscalYear, fiscalYearLabel } from "@/lib/bi-utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fiscalYear?: number;
  onSaved?: () => void;
}

export function BiSettingsDialog({ open, onOpenChange, fiscalYear: fiscalYearProp, onSaved }: Props) {
  const fiscalYear = fiscalYearProp ?? getCurrentFiscalYear();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
          <DialogTitle>BI 期首設定</DialogTitle>
          <DialogDescription>
            {fiscalYearLabel(fiscalYear)} の予算・目標値を設定します
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 px-6 pb-6 min-h-0">
          <BiSettingsPanel
            variant="dialog"
            active={open}
            fiscalYear={fiscalYear}
            onSaved={() => {
              onSaved?.();
              onOpenChange(false);
            }}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
