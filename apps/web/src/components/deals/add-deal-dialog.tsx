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
import { getCustomers } from "@/lib/actions/customers";
import { createDeal } from "@/lib/actions/deals";
import type { Deal } from "@/lib/database.types";

const STAGES: { key: Deal["stage"]; label: string }[] = [
  { key: "inquiry",        label: "問い合わせ" },
  { key: "first_meeting",  label: "初回面談" },
  { key: "materials_sent", label: "資料送付" },
  { key: "quote_submitted",label: "見積提出" },
  { key: "negotiation",    label: "交渉中" },
  { key: "closing",        label: "クロージング" },
];

const PRIORITIES = [
  { key: "high",   label: "高" },
  { key: "medium", label: "中" },
  { key: "low",    label: "低" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}

export function AddDealDialog({ open, onOpenChange, onCreated }: Props) {
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [customerId, setCustomerId]           = useState("");
  const [title, setTitle]                     = useState("");
  const [stage, setStage]                     = useState<Deal["stage"]>("inquiry");
  const [value, setValue]                     = useState("");
  const [priority, setPriority]               = useState("medium");
  const [expectedClose, setExpectedClose]     = useState("");
  const [nextAction, setNextAction]           = useState("");
  const [saving, setSaving]                   = useState(false);

  useEffect(() => {
    if (open) {
      getCustomers().then(c => setCustomers(c.map(x => ({ id: x.id, name: x.name })))).catch(() => {});
    }
  }, [open]);

  function reset() {
    setCustomerId(""); setTitle(""); setStage("inquiry");
    setValue(""); setPriority("medium"); setExpectedClose(""); setNextAction("");
  }

  async function handleSave() {
    if (!title.trim() || !customerId) return;
    setSaving(true);
    try {
      await createDeal({
        customer_id: customerId,
        title: title.trim(),
        stage,
        value: value ? Number(value) : undefined,
        priority,
        expected_close_date: expectedClose || undefined,
        next_action: nextAction || undefined,
      });
      reset();
      onCreated();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>商談を追加</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>顧客 <span className="text-red-500">*</span></Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue placeholder="顧客を選択" /></SelectTrigger>
              <SelectContent>
                {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>商談名 <span className="text-red-500">*</span></Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="例: 田中様邸 リノベーション工事" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>ステージ</Label>
              <Select value={stage} onValueChange={v => setStage(v as Deal["stage"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STAGES.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>優先度</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map(p => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>金額（税抜）</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">¥</span>
                <Input className="pl-7" value={value} onChange={e => setValue(e.target.value.replace(/[^\d]/g, ""))} placeholder="10000000" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>クロージング予定日</Label>
              <Input type="date" value={expectedClose} onChange={e => setExpectedClose(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>次のアクション</Label>
            <Input value={nextAction} onChange={e => setNextAction(e.target.value)} placeholder="例: 現地調査日程調整" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>キャンセル</Button>
          <Button onClick={handleSave} disabled={saving || !title.trim() || !customerId}>
            {saving ? "追加中..." : "追加する"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
