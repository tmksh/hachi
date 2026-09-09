"use client";

import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { updateDeal } from "@/lib/actions/deals";
import { fetchProfiles, type DealListRow, type DealStageRow } from "@/lib/queries/lists";
import { fetchDepartmentNames } from "@/lib/queries/portal";
import type { Deal } from "@/lib/database.types";

const PRIORITIES = [
  { key: "high", label: "高" },
  { key: "medium", label: "中" },
  { key: "low", label: "低" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  deal: DealListRow | null;
  stages: DealStageRow[];
  onUpdated: () => void;
}

export function EditDealDialog({ open, onOpenChange, deal, stages, onUpdated }: Props) {
  const [profiles, setProfiles] = useState<{ id: string; display_name: string }[]>([]);
  const [title, setTitle] = useState("");
  const [stage, setStage] = useState("");
  const [value, setValue] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assignedTo, setAssignedTo] = useState("");
  const [expectedClose, setExpectedClose] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [departments, setDepartments] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      Promise.all([fetchProfiles(), fetchDepartmentNames()])
        .then(([p, depts]) => {
          setProfiles(p.map((x) => ({ id: x.id, display_name: x.display_name })));
          setDepartments(depts);
        })
        .catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    if (!deal) return;
    setTitle(deal.title);
    setStage(deal.stage);
    setValue(deal.value ? String(deal.value) : "");
    setPriority(deal.priority || "medium");
    setAssignedTo(deal.assigned_to ?? "");
    setExpectedClose(deal.expected_close_date ?? "");
    setNextAction(deal.next_action ?? "");
    setDepartmentName(deal.department_name ?? "");
  }, [deal]);

  async function handleSave() {
    if (!deal || !title.trim()) return;
    setSaving(true);
    try {
      await updateDeal(deal.id, {
        title: title.trim(),
        stage: stage as Deal["stage"],
        value: value ? Number(value) : null,
        priority,
        assigned_to: assignedTo || null,
        expected_close_date: expectedClose || null,
        next_action: nextAction || null,
        department_name: departmentName || null,
      });
      onUpdated();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>商談を編集</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>商談名</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>ステージ</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {stages.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>優先度</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>金額（税抜）</Label>
              <Input value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ""))} />
            </div>
            <div className="space-y-1.5">
              <Label>クロージング予定日</Label>
              <Input type="date" value={expectedClose} onChange={(e) => setExpectedClose(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>担当者</Label>
            <Select value={assignedTo || "_none"} onValueChange={(v) => setAssignedTo(v === "_none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">未割り当て</SelectItem>
                {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>部門（BI集計）</Label>
            <Select value={departmentName || "_none"} onValueChange={(v) => setDepartmentName(v === "_none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">未設定</SelectItem>
                {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>次のアクション</Label>
            <Input value={nextAction} onChange={(e) => setNextAction(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>キャンセル</Button>
          <Button onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? "保存中..." : "保存する"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
