"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { ArrowLeft, Pencil, Calendar, Building2, FileText } from "lucide-react";
import { getContract } from "@/lib/actions/contracts";

type ContractDetail = Awaited<ReturnType<typeof getContract>>;

export default function ContractDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (id) getContract(id as string).then(setData).catch(() => {}).finally(() => setLoading(false)); }, [id]);

  if (loading) return <div className="p-4 md:p-6 space-y-4"><Skeleton className="h-8 w-64" /><div className="grid grid-cols-2 gap-4"><Skeleton className="h-64" /><Skeleton className="h-64" /></div></div>;
  if (!data) return <div className="p-4 md:p-6"><Link href="/contracts" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4"><ArrowLeft className="h-4 w-4" />戻る</Link><p className="text-muted-foreground">契約が見つかりません</p></div>;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <Link href="/contracts" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />契約一覧</Link>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-3"><h1 className="text-xl font-semibold">{data.contract_no}</h1><StatusBadge status={data.status} /></div>
          <p className="text-sm text-muted-foreground mt-1">{data.customer?.name ?? "-"} - {data.title}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right"><p className="text-sm text-muted-foreground">契約金額</p><p className="text-xl font-semibold tabular-nums">¥{(data.amount ?? 0).toLocaleString()}</p></div>
          <Link href={`/contracts/${id}/edit`}><Button variant="outline" size="sm" className="gap-1.5"><Pencil className="h-4 w-4" />編集</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm">契約基本情報</CardTitle></CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />件名</dt><dd className="font-medium">{data.title}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />契約日</dt><dd className="tabular-nums">{data.contract_date ?? "-"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />工期</dt><dd className="tabular-nums">{data.start_date ?? "-"} ~ {data.end_date ?? "-"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">進捗</dt><dd>{data.progress ?? 0}%</dd></div>
            </dl>
            {data.notes && <div className="mt-4 pt-4 border-t"><p className="text-sm text-muted-foreground">{data.notes}</p></div>}
          </CardContent>
        </Card>
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm">顧客情報</CardTitle></CardHeader>
          <CardContent>
            {data.customer ? (
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center"><span className="text-lg font-medium text-primary">{data.customer.name.charAt(0)}</span></div>
                <div><p className="font-medium">{data.customer.name}</p><p className="text-sm text-muted-foreground">{data.customer.company_name ?? "個人"}</p></div>
              </div>
            ) : <p className="text-sm text-muted-foreground">顧客情報なし</p>}
          </CardContent>
        </Card>
      </div>

      {data.estimate && (
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm">関連見積</CardTitle></CardHeader>
          <CardContent>
            <Link href={`/quotes/${data.estimate.id}`} className="text-primary hover:underline font-medium">{data.estimate.estimate_no} - {data.estimate.title ?? "無題"}</Link>
            <span className="ml-4 tabular-nums">¥{(data.estimate.total ?? 0).toLocaleString()}</span>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
