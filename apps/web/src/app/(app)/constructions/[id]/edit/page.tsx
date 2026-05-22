"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import { getConstruction, updateConstruction } from "@/lib/actions/constructions";
import { getBiDepartmentNames } from "@/lib/actions/bi";

const STATUS_OPTIONS = [{value:"preparing",label:"着工前"},{value:"in_progress",label:"施工中"},{value:"completed",label:"完工"},{value:"suspended",label:"中断"},{value:"delayed",label:"遅延"}];

export default function ConstructionEditPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("preparing");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [orderAmount, setOrderAmount] = useState("");
  const [budgetCost, setBudgetCost] = useState("");
  const [progress, setProgress] = useState("0");
  const [departmentName, setDepartmentName] = useState("");
  const [departments, setDepartments] = useState<string[]>([]);

  useEffect(() => {
    if (!id) return;
    Promise.all([getConstruction(id as string), getBiDepartmentNames()])
      .then(([c, depts]) => {
        setTitle(c.title);
        setStatus(c.status);
        setStartDate(c.start_date ?? "");
        setEndDate(c.end_date ?? "");
        setOrderAmount(c.order_amount ? String(c.order_amount) : "");
        setBudgetCost(c.budget_cost ? String(c.budget_cost) : "");
        setProgress(String(c.progress ?? 0));
        setDepartmentName(c.department_name ?? "");
        setDepartments(depts);
      })
      .catch(() => toast.error("取得に失敗"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateConstruction(id as string, { title, status: status as "preparing"|"in_progress"|"completed"|"suspended"|"delayed", start_date: startDate || null, end_date: endDate || null, order_amount: orderAmount ? Number(orderAmount) : 0, budget_cost: budgetCost ? Number(budgetCost) : 0, progress: Number(progress), department_name: departmentName || null });
      toast.success("更新しました"); router.push(`/constructions/${id}`);
    } catch { toast.error("更新に失敗"); } finally { setSaving(false); }
  };

  if (loading) return <div className="p-4 md:p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3"><Link href={`/constructions/${id}`}><Button variant="ghost" size="icon" className="size-8"><ArrowLeft className="size-4" /></Button></Link><h1 className="text-xl font-semibold">工事編集</h1></div>
      <Card><CardHeader className="pb-3"><CardTitle className="text-base">工事情報</CardTitle></CardHeader>
        <CardContent className="space-y-4"><div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2"><Label>工事名</Label><Input value={title} onChange={e=>setTitle(e.target.value)} /></div>
          <div className="space-y-2"><Label>ステータス</Label><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUS_OPTIONS.map(s=><SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>部門（BI集計）</Label><Select value={departmentName || "_none"} onValueChange={(v) => setDepartmentName(v === "_none" ? "" : v)}><SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger><SelectContent><SelectItem value="_none">未設定</SelectItem>{departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>進捗 (%)</Label><Input type="number" min={0} max={100} value={progress} onChange={e=>setProgress(e.target.value)} /></div>
          <div className="space-y-2"><Label>着工日</Label><Input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} /></div>
          <div className="space-y-2"><Label>竣工日</Label><Input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} /></div>
          <div className="space-y-2"><Label>受注額</Label><Input type="number" value={orderAmount} onChange={e=>setOrderAmount(e.target.value)} /></div>
          <div className="space-y-2"><Label>予算原価</Label><Input type="number" value={budgetCost} onChange={e=>setBudgetCost(e.target.value)} /></div>
        </div></CardContent>
      </Card>
      <div className="flex justify-end gap-3"><Link href={`/constructions/${id}`}><Button variant="outline">キャンセル</Button></Link><Button onClick={handleSave} disabled={saving}><Save className="size-4 mr-1" />{saving?"保存中...":"保存"}</Button></div>
    </div>
  );
}
