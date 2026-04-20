"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { ArrowLeft, Pencil } from "lucide-react";
import { getConstruction } from "@/lib/actions/constructions";
import { CostBudgetTab } from "@/components/constructions/cost-budget-tab";
import { TasksTab } from "@/components/constructions/tasks-tab";

type Detail = Awaited<ReturnType<typeof getConstruction>>;

export default function ConstructionDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (id) getConstruction(id as string).then(setData).catch(() => {}).finally(() => setLoading(false)); }, [id]);

  if (loading) return <div className="p-4 md:p-6 space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64" /></div>;
  if (!data) return <div className="p-4 md:p-6"><Link href="/constructions" className="text-sm text-muted-foreground flex items-center gap-1"><ArrowLeft className="h-4 w-4" />戻る</Link><p className="mt-4">見つかりません</p></div>;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <Link href="/constructions" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />工事一覧</Link>
      <div className="flex items-center justify-between">
        <div><div className="flex items-center gap-3"><h1 className="text-xl font-semibold">{data.construction_no}</h1><StatusBadge status={data.status} /></div><p className="text-sm text-muted-foreground mt-1">{data.title}</p></div>
        <Link href={`/constructions/${id}/edit`}><Button variant="outline" size="sm"><Pencil className="h-4 w-4 mr-1" />編集</Button></Link>
      </div>
      <div className="flex items-center gap-4"><span className="text-sm font-medium">{data.progress}%</span><Progress value={data.progress} className="flex-1 h-2" /></div>
      <Tabs defaultValue="overview">
        <TabsList><TabsTrigger value="overview">概要</TabsTrigger><TabsTrigger value="tasks">工程</TabsTrigger><TabsTrigger value="cost">原価</TabsTrigger></TabsList>
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card><CardHeader className="pb-3"><CardTitle className="text-sm">基本情報</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">顧客</span><span>{data.customer?.name ?? "-"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">工期</span><span>{data.start_date ?? "-"} ~ {data.end_date ?? "-"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">担当</span><span>{data.assignee?.display_name ?? "-"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">作業員数</span><span>{data.worker_count}人</span></div>
            </CardContent></Card>
            <Card><CardHeader className="pb-3"><CardTitle className="text-sm">金額</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">受注額</span><span className="font-medium tabular-nums">¥{(data.order_amount??0).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">予算原価</span><span className="tabular-nums">¥{(data.budget_cost??0).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">実績原価</span><span className="tabular-nums">¥{(data.actual_cost??0).toLocaleString()}</span></div>
            </CardContent></Card>
          </div>
        </TabsContent>
        <TabsContent value="tasks" className="mt-4">
          <TasksTab
            constructionId={id as string}
            initialTasks={(data.tasks ?? []) as { id: string; name: string; start_date: string | null; end_date: string | null; progress: number; status: string }[]}
          />
        </TabsContent>
        <TabsContent value="cost" className="mt-4">
          <CostBudgetTab
            constructionId={id as string}
            contractAmount={data.order_amount ?? undefined}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
