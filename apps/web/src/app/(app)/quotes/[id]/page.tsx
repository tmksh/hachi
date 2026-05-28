"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Copy, FileDown } from "lucide-react";
import { getEstimate } from "@/lib/actions/estimates";
import { EstimateDetailView, type EstimateForView } from "@/components/estimate/estimate-detail-view";
import { EstimatePdfPreviewDialog, type EstimatePdfPreviewData } from "@/components/estimate/estimate-pdf-preview-dialog";

type EstimateDetail = Awaited<ReturnType<typeof getEstimate>>;

function toPdfPreviewData(data: EstimateDetail): EstimatePdfPreviewData {
  return {
    estimate_no: data.estimate_no,
    title: data.title,
    customer_name: data.customer?.name ?? null,
    customer_company_name: data.customer?.company_name ?? null,
    notes: data.notes,
    subtotal: data.subtotal ?? 0,
    tax: data.tax ?? 0,
    total: data.total ?? 0,
    categories: (data.categories ?? []).map((cat) => ({ id: cat.id, name: cat.name })),
    items: data.items.map((item) => ({
      id: item.id,
      category_id: item.category_id,
      name: item.name,
      quantity: Number(item.quantity) || 0,
      unit: item.unit,
      selling_price: Number(item.selling_price) || 0,
      selling_amount: Number(item.selling_amount) || 0,
    })),
  };
}

export default function QuoteDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState<EstimateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfOpen, setPdfOpen] = useState(false);

  useEffect(() => {
    if (id) {
      getEstimate(id as string)
        .then(setData)
        .catch(() => { /* 失敗時は data が null のまま */ })
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Link
          href="/quotes"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />戻る
        </Link>
        <p className="mt-4 text-muted-foreground">見つかりません</p>
      </div>
    );
  }

  const backHref = data.customer_id ? `/quotes?customer=${data.customer_id}` : "/quotes";

  return (
    <div className="p-4 md:p-8 space-y-4">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />見積一覧
      </Link>
      <div className="text-xs text-muted-foreground">
        顧客: <span className="text-foreground">{data.customer?.name ?? "-"}</span>
      </div>

      <EstimateDetailView
        estimate={data as unknown as EstimateForView}
        onEstimateChange={(est) => setData((prev) => ({ ...(prev as EstimateDetail), ...(est as unknown as EstimateDetail) }))}
        headerExtra={
          <>
            <Button variant="outline" size="sm" onClick={() => setPdfOpen(true)}>
              <FileDown className="h-4 w-4 mr-1" />PDFプレビュー
            </Button>
            <Button
              variant="outline"
              size="sm"
              title="開いている見積もりをもとに新規見積もりを作成"
              onClick={() => router.push(`/quotes/new?copy_from=${id}`)}
            >
              <Copy className="h-4 w-4 mr-1" />見積書をコピー
            </Button>
          </>
        }
      />

      <EstimatePdfPreviewDialog
        open={pdfOpen}
        onOpenChange={setPdfOpen}
        data={toPdfPreviewData(data)}
      />
    </div>
  );
}
