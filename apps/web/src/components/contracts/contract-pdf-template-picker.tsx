"use client";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { FileText } from "lucide-react";
import type { PdfFormTemplate } from "@/lib/pdf-form-template";

export function ContractPdfTemplatePicker({
  open,
  onOpenChange,
  onSelectForm,
  formTemplates,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelectForm: (tpl: PdfFormTemplate) => void;
  formTemplates?: PdfFormTemplate[];
}) {
  const contractFormTemplates = (formTemplates ?? []).filter((t) => t.docType === "contract");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>テンプレートを選択</DialogTitle>
        </DialogHeader>

        {contractFormTemplates.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">契約書テンプレートがありません</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                設定 → PDF編集 → 契約書 からテンプレートを作成してください
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {contractFormTemplates.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => { onOpenChange(false); onSelectForm(tpl); }}
                className="w-full flex items-start gap-3 rounded-xl border border-border bg-card p-3 hover:shadow-md hover:border-primary/40 transition-all text-left group"
              >
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{tpl.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tpl.fileName} ・ {tpl.pageCount}ページ ・ {tpl.fields.length}項目
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
