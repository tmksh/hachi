"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Copy } from "lucide-react";
import { getEstimate } from "@/lib/actions/estimates";
import { EstimateDetailView, type EstimateForView } from "@/components/estimate/estimate-detail-view";
import { EstimateApprovalActions } from "@/components/estimate/estimate-approval-actions";

type EstimateDetail = Awaited<ReturnType<typeof getEstimate>>;

export default function QuoteDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState<EstimateDetail | null>(null);
  const [loading, setLoading] = useState(true);

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
        pdfCustomer={data.customer ? { name: data.customer.name, company_name: data.customer.company_name } : null}
        headerExtra={
          <>
            <EstimateApprovalActions
              estimateId={id as string}
              grossProfitRate={data.gross_profit_rate ?? 0}
            />
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
    </div>
  );
}
