"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchEstimate } from "@/lib/queries/details";
import { EstimateDetailView, type EstimateForView } from "@/components/estimate/estimate-detail-view";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Copy } from "lucide-react";
import { PageLoadingFallback } from "@/components/shared/page-loading-fallback";

type EstimateDetail = Awaited<ReturnType<typeof fetchEstimate>>;

type QuoteDetailClientProps = {
  initialData?: EstimateDetail | null;
};

export function QuoteDetailClient({ initialData }: QuoteDetailClientProps) {
  const { id } = useParams();
  const estimateId = id as string;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isPending, isError } = useQuery({
    queryKey: ["estimate", estimateId],
    queryFn: () => fetchEstimate(estimateId),
    staleTime: 60_000,
    initialData: initialData ?? undefined,
    initialDataUpdatedAt: initialData ? Date.now() : undefined,
    enabled: !!estimateId,
  });

  if (isPending) return <PageLoadingFallback />;

  if (!data || isError) {
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
        onEstimateChange={(est) => {
          queryClient.setQueryData(["estimate", estimateId], (prev: EstimateDetail | undefined) => ({
            ...(prev as EstimateDetail),
            ...(est as unknown as EstimateDetail),
          }));
        }}
        pdfCustomer={data.customer ? {
          name: data.customer.name,
          company_name: data.customer.company_name,
          customer_type: data.customer.customer_type,
          notes: data.customer.notes,
        } : null}
        headerExtra={
          <Button
            variant="outline"
            size="sm"
            title="開いている見積もりをもとに新規見積もりを作成"
            onClick={() => router.push(`/quotes/new?copy_from=${id}`)}
          >
            <Copy className="h-4 w-4 mr-1" />見積書をコピー
          </Button>
        }
      />
    </div>
  );
}
