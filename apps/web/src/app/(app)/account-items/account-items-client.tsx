"use client";

import { useQuerySeedAt } from "@/hooks/use-query-seed-at";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { confirmAccountItems, type ProcurementOrder } from "@/lib/actions/procurement";
import { suggestAccountItem, yen } from "@/lib/procurement";
import { PageLoadingFallback } from "@/components/shared/page-loading-fallback";
import { fetchProcurementMasters, fetchProcurementOrders, LIST_STALE_MS, MASTER_STALE_MS, QK } from "@/lib/queries/portal";

type Props = {
  initialOrders?: ProcurementOrder[];
  accountItems?: string[];
};

type VendorGroup = {
  key: string;
  vendorName: string;
  orders: ProcurementOrder[];
  amount: number;
  candidate: string;
  basis: { label: string; cls: string };
  breakdown: string;
};

function basisFor(vendorName: string, all: ProcurementOrder[]) {
  const suggested = suggestAccountItem(vendorName, all.map((o) => ({
    vendorName: o.craftsman?.name,
    companyName: o.craftsman && "company_name" in o.craftsman ? (o.craftsman as { company_name?: string | null }).company_name : null,
    accountItem: o.account_item,
    accountItemSource: o.account_item_source,
  })));
  const past = all.filter((o) => o.account_item && (
    o.craftsman?.name === vendorName
    || (o.craftsman && "company_name" in o.craftsman && (o.craftsman as { company_name?: string | null }).company_name === vendorName)
  ));
  if (past.length === 0) return { label: suggested.source === "learned" ? "類似業者の実績" : "実績なし", cls: "bg-gray-100 text-gray-600", item: suggested.item };
  const counts = new Map<string, number>();
  for (const o of past) counts.set(o.account_item!, (counts.get(o.account_item!) ?? 0) + 1);
  const [top, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (n === past.length) return { label: `過去${past.length}件すべて`, cls: "bg-emerald-100 text-emerald-800", item: top };
  return { label: `過去${past.length}件中${n}件`, cls: "bg-orange-100 text-orange-800", item: top };
}

export function AccountItemsClient({ initialOrders, accountItems: initialAccountItems }: Props) {
  const querySeedAt = useQuerySeedAt();
  const queryClient = useQueryClient();
  const { data: orders = [], isPending: ordersPending } = useQuery({
    queryKey: QK.procurementOrders,
    queryFn: fetchProcurementOrders,
    staleTime: LIST_STALE_MS,
    initialData: initialOrders,
    initialDataUpdatedAt: initialOrders ? querySeedAt : undefined,
  });
  const { data: masters, isPending: mastersPending } = useQuery({
    queryKey: QK.procurementMasters,
    queryFn: fetchProcurementMasters,
    staleTime: MASTER_STALE_MS,
  });
  const accountItems = initialAccountItems ?? masters?.accountItems ?? [];
  const setOrders = (updater: ProcurementOrder[] | ((prev: ProcurementOrder[]) => ProcurementOrder[])) => {
    queryClient.setQueryData<ProcurementOrder[]>(QK.procurementOrders, (prev = []) =>
      typeof updater === "function" ? updater(prev) : updater,
    );
  };
  const [selected, setSelected] = useState<string[]>([]);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const unset = orders.filter((o) => !o.account_item);
  const groups: VendorGroup[] = useMemo(() => {
    const map = new Map<string, ProcurementOrder[]>();
    for (const o of unset) {
      const key = o.craftsman?.name ?? "（新規業者）";
      map.set(key, [...(map.get(key) ?? []), o]);
    }
    return [...map.entries()].map(([vendorName, rows]) => {
      const b = basisFor(vendorName, orders);
      const candidate = b.item ?? suggestAccountItem(vendorName).item;
      return {
        key: vendorName,
        vendorName,
        orders: rows,
        amount: rows.reduce((s, r) => s + Number(r.amount ?? 0), 0),
        candidate,
        basis: { label: b.label, cls: b.cls },
        breakdown: `発注書 ${rows.length}`,
      };
    });
  }, [unset, orders]);

  const aiCount = groups.filter((g) => g.basis.label !== "実績なし").length;
  const manualCount = groups.length - aiCount;
  const unsetAmount = unset.reduce((s, o) => s + Number(o.amount ?? 0), 0);

  const toggle = (key: string, on: boolean) => {
    setSelected((prev) => on ? [...new Set([...prev, key])] : prev.filter((k) => k !== key));
    if (on && !choices[key]) {
      const g = groups.find((x) => x.key === key);
      if (g) setChoices((c) => ({ ...c, [key]: g.candidate }));
    }
  };

  const selectedCount = groups
    .filter((g) => selected.includes(g.key))
    .reduce((s, g) => s + g.orders.length, 0);

  const confirm = async () => {
    const items: Array<{ orderId: string; accountItem: string }> = [];
    for (const g of groups) {
      if (!selected.includes(g.key)) continue;
      const item = (choices[g.key] || g.candidate).trim();
      if (!item) continue;
      for (const o of g.orders) items.push({ orderId: o.id, accountItem: item });
    }
    if (items.length === 0) {
      toast.error("確定する行を選んで勘定科目を指定してください");
      return;
    }
    setSaving(true);
    const res = await confirmAccountItems(items);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const ids = new Set(items.map((i) => i.orderId));
    setOrders((prev) => prev.map((o) => {
      const hit = items.find((i) => i.orderId === o.id);
      return hit ? { ...o, account_item: hit.accountItem, account_item_source: "accounting" } : o;
    }));
    setSelected([]);
    toast.success(`${res.updated}件の勘定科目を確定しました`);
    void ids;
  };

  if ((ordersPending && orders.length === 0) || (mastersPending && !masters && !initialAccountItems)) {
    return <PageLoadingFallback />;
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="勘定科目の確定"
        description="担当者が入れられなかったもの、AIが自信のないものをまとめて確定します。"
      >
        <div className="flex items-center gap-2">
          <Badge className="bg-amber-100 text-amber-800">総務・経理ロール</Badge>
          <Badge className="bg-teal-100 text-teal-800">No.137</Badge>
        </div>
      </PageHeader>

      <div className="grid sm:grid-cols-4 gap-3">
        <Summary color="bg-rose-50" title="科目が未確定" value={`${unset.length}件`} />
        <Summary color="bg-violet-50" title="AIが候補を出している" value={`${aiCount}件`} />
        <Summary color="bg-amber-50" title="候補なし、手で選ぶ" value={`${manualCount}件`} />
        <Summary color="bg-slate-50" title="未確定ぶんの金額" value={yen(unsetAmount)} />
      </div>

      <section className="rounded-xl border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b">
          <p className="text-sm font-semibold">業者ごとにまとめて確定する</p>
          <p className="text-xs text-muted-foreground">同じ業者は同じ科目になることが多いので、1件ずつ選ばなくて大丈夫です。</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-[11px] text-muted-foreground">
              <th className="px-3 py-2 w-8" />
              <th className="px-3 py-2 text-left">業者名</th>
              <th className="px-3 py-2 text-right">件数</th>
              <th className="px-3 py-2 text-right">金額</th>
              <th className="px-3 py-2 text-left">AIの候補</th>
              <th className="px-3 py-2 text-left">根拠</th>
              <th className="px-3 py-2 text-left">内訳</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">未確定の勘定科目はありません。</td></tr>
            ) : groups.map((g) => (
              <tr key={g.key} className="border-t">
                <td className="px-3 py-2">
                  <Checkbox checked={selected.includes(g.key)} onCheckedChange={(c) => toggle(g.key, c === true)} />
                </td>
                <td className="px-3 py-2 font-medium">{g.vendorName}</td>
                <td className="px-3 py-2 text-right tabular-nums">{g.orders.length}</td>
                <td className="px-3 py-2 text-right tabular-nums">{yen(g.amount)}</td>
                <td className="px-3 py-2">
                  <Select
                    value={choices[g.key] ?? g.candidate}
                    onValueChange={(v) => setChoices((c) => ({ ...c, [g.key]: v }))}
                  >
                    <SelectTrigger className="h-8 w-44"><SelectValue placeholder="選択してください" /></SelectTrigger>
                    <SelectContent>
                      {accountItems.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2"><Badge className={g.basis.cls}>{g.basis.label}</Badge></td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{g.breakdown}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="text-xs text-muted-foreground">
        確定内容は次回の候補に使います。同じ業者は次回から自動で入りやすくなります。
      </p>

      <div className="flex justify-end gap-2 pb-6">
        <Button variant="outline" asChild><Link href="/ledger">あとで</Link></Button>
        <Button className="bg-emerald-700 hover:bg-emerald-800" disabled={saving || selectedCount === 0} onClick={confirm}>
          選択した{selectedCount}件を確定する
        </Button>
      </div>
    </div>
  );
}

function Summary({ color, title, value }: { color: string; title: string; value: string }) {
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  );
}
