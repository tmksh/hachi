"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { type RenderContext } from "@/lib/contract-templates";
import { getPdfFormTemplates } from "@/lib/actions/pdf-form-templates";
import type { FillContext, PdfFormTemplate } from "@/lib/pdf-form-template";
import { PdfFormFiller } from "@/components/settings/pdf-form-filler";
import { ContractPdfTemplatePicker } from "@/components/contracts/contract-pdf-template-picker";

type ContractDoc = {
  id: string;
  contract_no: string;
  title: string;
  status: string;
  amount: number;
  contract_date: string | null;
  template_id: string | null;
  form: Record<string, string | number> | null;
  created_at: string;
  updated_at: string;
};

interface Props {
  constructionId: string;
  initialDocs: ContractDoc[];
  ctx: RenderContext;
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  preparing:  { label: "下書き",   cls: "bg-amber-100 text-amber-700"   },
  contracted: { label: "確定済み", cls: "bg-green-100 text-green-700"   },
  executing:  { label: "実行中",   cls: "bg-blue-100 text-blue-700"     },
  completed:  { label: "完了",     cls: "bg-slate-200 text-slate-700"   },
  cancelled:  { label: "キャンセル", cls: "bg-red-100 text-red-600"     },
};

export function ContractTab({ constructionId: _constructionId, initialDocs, ctx }: Props) {
  const [docs] = useState<ContractDoc[]>(initialDocs);
  const [picker, setPicker] = useState(false);
  const [formTemplates, setFormTemplates] = useState<PdfFormTemplate[]>([]);
  const [fillerTpl, setFillerTpl] = useState<PdfFormTemplate | null>(null);

  useEffect(() => {
    getPdfFormTemplates().then(setFormTemplates).catch(() => {});
  }, []);

  const fillCtx: FillContext = useMemo(() => ({
    constructionTitle: ctx.construction?.title ?? null,
    orderAmount: ctx.construction?.order_amount ?? null,
    startDate: ctx.construction?.start_date ?? null,
    endDate: ctx.construction?.end_date ?? null,
    customerName: ctx.customer?.name ?? null,
    customerAddress: ctx.customer?.address ?? null,
  }), [ctx]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">契約書</span>
          <span className="text-muted-foreground">{docs.length}</span>
        </div>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setPicker(true)}>
          <Plus className="h-3.5 w-3.5" />契約書を作成する
        </Button>
      </div>

      {docs.length === 0 ? (
        <div className="py-14 text-center text-sm text-muted-foreground rounded-xl border border-dashed border-border">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>契約書がまだありません</p>
          <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => setPicker(true)}>
            <Plus className="h-4 w-4" />契約書を作成
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => {
            const st = STATUS_LABELS[doc.status] ?? STATUS_LABELS.preparing;
            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{doc.title}</p>
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0", st.cls)}>{st.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    ¥{doc.amount.toLocaleString()}
                    {doc.contract_date ? ` ・ 契約日 ${doc.contract_date}` : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ContractPdfTemplatePicker
        open={picker}
        onOpenChange={setPicker}
        onSelectForm={(tpl) => setFillerTpl(tpl)}
        formTemplates={formTemplates}
      />

      <PdfFormFiller
        open={!!fillerTpl}
        onOpenChange={(o) => !o && setFillerTpl(null)}
        template={fillerTpl}
        ctx={fillCtx}
      />
    </div>
  );
}
