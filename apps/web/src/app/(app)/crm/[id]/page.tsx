"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Pencil, Trash2, Phone, Mail, MapPin, Building2, User } from "lucide-react";
import { toast } from "sonner";
import { getCustomer, deleteCustomer } from "@/lib/actions/customers";
import type { Customer } from "@/lib/database.types";

type CustomerDetail = Customer & { assigned_to_profile: { id: string; display_name: string } | null };

export default function CrmDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (id) getCustomer(id as string).then(d => setData(d as CustomerDetail)).catch(() => {}).finally(() => setLoading(false)); }, [id]);

  const handleDelete = async () => {
    if (!confirm("この顧客を削除しますか？")) return;
    try { await deleteCustomer(id as string); toast.success("削除しました"); router.push("/crm"); } catch { toast.error("削除に失敗しました"); }
  };

  if (loading) return <div className="p-4 md:p-6 space-y-4"><Skeleton className="h-8 w-64" /><div className="grid grid-cols-2 gap-4"><Skeleton className="h-64" /><Skeleton className="h-64" /></div></div>;
  if (!data) return <div className="p-4 md:p-6"><Link href="/crm" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4"><ArrowLeft className="h-4 w-4" />戻る</Link><p>顧客が見つかりません</p></div>;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <Link href="/crm" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />顧客一覧</Link>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center"><span className="text-xl font-bold text-primary">{data.name.charAt(0)}</span></div>
          <div><h1 className="text-xl font-semibold">{data.name}</h1><p className="text-sm text-muted-foreground">{data.company_name || "個人"}</p></div>
          <Badge variant="secondary">{data.status}</Badge>
        </div>
        <div className="flex gap-2">
          <Link href={`/crm/${id}/edit`}><Button variant="outline" size="sm"><Pencil className="h-4 w-4 mr-1" />編集</Button></Link>
          <Button variant="outline" size="sm" onClick={handleDelete} className="text-destructive"><Trash2 className="h-4 w-4 mr-1" />削除</Button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm">連絡先情報</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {data.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{data.phone}</div>}
            {data.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{data.email}</div>}
            {data.address && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{data.address}</div>}
            {data.company_name && <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" />{data.company_name}</div>}
          </CardContent>
        </Card>
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm">詳細情報</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">ソース</span><span>{data.source ?? "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">担当</span><span>{data.assigned_to_profile?.display_name ?? "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">予算</span><span>{data.budget_min || data.budget_max ? `¥${(data.budget_min ?? 0).toLocaleString()} ~ ¥${(data.budget_max ?? 0).toLocaleString()}` : "-"}</span></div>
            {data.tags.length > 0 && <div className="flex gap-1 flex-wrap">{data.tags.map(t => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}</div>}
            {data.notes && <div className="pt-2 border-t"><p className="text-muted-foreground">{data.notes}</p></div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
