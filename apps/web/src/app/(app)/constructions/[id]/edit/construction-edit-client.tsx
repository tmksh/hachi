"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import { updateConstruction } from "@/lib/actions/constructions";
import type { fetchConstruction } from "@/lib/queries/details";

const STATUS_OPTIONS = [{value:"preparing",label:"着工前"},{value:"in_progress",label:"施工中"},{value:"completed",label:"完工"},{value:"suspended",label:"中断"},{value:"delayed",label:"遅延"}];

type Construction = Awaited<ReturnType<typeof fetchConstruction>>;

type ConstructionEditClientProps = {
  id: string;
  initialConstruction: Construction;
  initialDepartments: string[];
  initialLocations: Array<{ id: string; name: string }>;
};

export function ConstructionEditClient({
  id,
  initialConstruction,
  initialDepartments,
  initialLocations,
}: ConstructionEditClientProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(initialConstruction.title);
  const [status, setStatus] = useState(initialConstruction.status);
  const [startDate, setStartDate] = useState(initialConstruction.start_date ?? "");
  const [endDate, setEndDate] = useState(initialConstruction.end_date ?? "");
  const [orderAmount, setOrderAmount] = useState(initialConstruction.order_amount ? String(initialConstruction.order_amount) : "");
  const [budgetCost, setBudgetCost] = useState(initialConstruction.budget_cost ? String(initialConstruction.budget_cost) : "");
  const [progress, setProgress] = useState(String(initialConstruction.progress ?? 0));
  const [departmentName, setDepartmentName] = useState(initialConstruction.department_name ?? "");
  const [locationId, setLocationId] = useState(initialConstruction.location_id ?? "");
  const departments = initialDepartments;
  const locations = initialLocations;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateConstruction(id, {
        title,
        status: status as "preparing"|"in_progress"|"completed"|"suspended"|"delayed",
        start_date: startDate || null,
        end_date: endDate || null,
        order_amount: orderAmount ? Number(orderAmount) : 0,
        budget_cost: budgetCost ? Number(budgetCost) : 0,
        progress: Number(progress),
        department_name: departmentName || null,
        location_id: locationId || null,
      });
      toast.success("更新しました"); router.push(`/constructions/${id}`);
    } catch { toast.error("更新に失敗"); } finally { setSaving(false); }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3"><Link href={`/constructions/${id}`}><Button variant="ghost" size="icon" className="size-8"><ArrowLeft className="size-4" /></Button></Link><h1 className="text-2xl font-semibold tracking-tight text-foreground">工事編集</h1></div>
      <Card><CardHeader className="pb-3"><CardTitle className="text-base">工事情報</CardTitle></CardHeader>
        <CardContent className="space-y-4"><div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2"><Label>名称</Label><Input value={title} onChange={e=>setTitle(e.target.value)} /></div>
          <div className="space-y-2"><Label>ステータス</Label><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUS_OPTIONS.map(s=><SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>部門（BI集計）</Label><Select value={departmentName || "_none"} onValueChange={(v) => setDepartmentName(v === "_none" ? "" : v)}><SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger><SelectContent><SelectItem value="_none">未設定</SelectItem>{departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>拠点（BI集計）</Label><Select value={locationId || "_none"} onValueChange={(v) => setLocationId(v === "_none" ? "" : v)}><SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger><SelectContent><SelectItem value="_none">未設定</SelectItem>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select></div>
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
