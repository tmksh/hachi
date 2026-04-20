"use client";

import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Trash2, Plus } from "lucide-react";

/* ─────────────────── types ─────────────────── */
type ContractorRow = {
  id: string;
  status: "発注済" | "未発注";
  name: string;
  work_type: string;
  budget: number;
  add_contract_1: number;
  add_contract_2: number;
  management_budget: number;
  order_amount: number;
  add_order_1: number;
  add_order_2: number;
  add_order_3: number;
  monthly: Partial<Record<string, number>>;
};

type Pattern = { contract_amount: number; rows: ContractorRow[] };

/* ─────────────────── mock data (3パターン) ─────────────────── */
const PATTERNS: Pattern[] = [
  // Pattern A: 外構・植栽工事
  {
    contract_amount: 397_900,
    rows: [
      { id: "a1", status: "発注済", name: "田中建設", work_type: "外構工事",
        budget: 68_500, add_contract_1: 0, add_contract_2: 0, management_budget: 80_000,
        order_amount: 10_000, add_order_1: 20_000, add_order_2: 0, add_order_3: 0,
        monthly: { "2026-04": 0, "2026-05": 0, "2026-06": 30_000, "2026-07": 0 } },
      { id: "a2", status: "発注済", name: "山田内装", work_type: "外構工事2",
        budget: 150_000, add_contract_1: 0, add_contract_2: 0, management_budget: 0,
        order_amount: 0, add_order_1: 0, add_order_2: 0, add_order_3: 0, monthly: {} },
      { id: "a3", status: "発注済", name: "伊藤造園", work_type: "植栽工事",
        budget: 122_500, add_contract_1: 0, add_contract_2: 0, management_budget: 0,
        order_amount: 0, add_order_1: 0, add_order_2: 0, add_order_3: 0, monthly: {} },
    ],
  },
  // Pattern B: 内装リフォーム
  {
    contract_amount: 620_000,
    rows: [
      { id: "b1", status: "発注済", name: "佐藤内装工業", work_type: "内装仕上工事",
        budget: 250_000, add_contract_1: 30_000, add_contract_2: 0, management_budget: 300_000,
        order_amount: 250_000, add_order_1: 25_000, add_order_2: 0, add_order_3: 0,
        monthly: { "2025-10": 120_000, "2025-11": 100_000, "2025-12": 55_000 } },
      { id: "b2", status: "発注済", name: "田辺電設", work_type: "電気工事",
        budget: 85_000, add_contract_1: 0, add_contract_2: 0, management_budget: 0,
        order_amount: 85_000, add_order_1: 0, add_order_2: 0, add_order_3: 0,
        monthly: { "2025-11": 85_000 } },
      { id: "b3", status: "未発注", name: "武田設備", work_type: "管工事（設備）",
        budget: 120_000, add_contract_1: 0, add_contract_2: 0, management_budget: 140_000,
        order_amount: 100_000, add_order_1: 0, add_order_2: 0, add_order_3: 0,
        monthly: { "2025-12": 50_000, "2026-01": 50_000 } },
    ],
  },
  // Pattern C: 新築住宅
  {
    contract_amount: 6_500_000,
    rows: [
      { id: "c1", status: "発注済", name: "基礎工業㈱", work_type: "基礎工事",
        budget: 1_200_000, add_contract_1: 0, add_contract_2: 0, management_budget: 1_300_000,
        order_amount: 1_200_000, add_order_1: 0, add_order_2: 0, add_order_3: 0,
        monthly: { "2025-08": 600_000, "2025-09": 600_000 } },
      { id: "c2", status: "発注済", name: "木造建設", work_type: "木工事",
        budget: 3_500_000, add_contract_1: 200_000, add_contract_2: 50_000, management_budget: 3_900_000,
        order_amount: 3_200_000, add_order_1: 150_000, add_order_2: 0, add_order_3: 0,
        monthly: { "2025-09": 1_000_000, "2025-10": 1_500_000, "2025-11": 850_000 } },
      { id: "c3", status: "発注済", name: "屋根専門工業", work_type: "屋根・板金工事",
        budget: 480_000, add_contract_1: 0, add_contract_2: 0, management_budget: 0,
        order_amount: 480_000, add_order_1: 0, add_order_2: 0, add_order_3: 0,
        monthly: { "2025-10": 480_000 } },
      { id: "c4", status: "未発注", name: "関東塗装", work_type: "塗装工事",
        budget: 320_000, add_contract_1: 0, add_contract_2: 0, management_budget: 350_000,
        order_amount: 280_000, add_order_1: 0, add_order_2: 0, add_order_3: 0,
        monthly: { "2025-12": 150_000, "2026-01": 130_000 } },
    ],
  },
];

/* ─────────────────── helpers ─────────────────── */
function getMonths(startYYYYMM: string): string[] {
  const months: string[] = [];
  const [y, m] = startYYYYMM.split("-").map(Number);
  for (let i = 0; i < 12; i++) {
    const d = new Date(y, m - 1 + i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}
function monthLabel(yyyymm: string) {
  return `${Number(yyyymm.split("-")[1])}月`;
}
function fmtView(n: number): string {
  return n === 0 ? "" : n.toLocaleString();
}
function fmtAlways(n: number): string {
  return n.toLocaleString();
}
function compute(row: ContractorRow) {
  const budget_total = row.budget + row.add_contract_1 + row.add_contract_2;
  const confirmed    = row.order_amount + row.add_order_1 + row.add_order_2 + row.add_order_3;
  const budget_rem   = budget_total - confirmed;
  const total_billed = Object.values(row.monthly).reduce((s, v) => s + (v ?? 0), 0);
  const billing_rem  = confirmed - total_billed;
  return { budget_total, confirmed, budget_rem, total_billed, billing_rem };
}
function newEmptyRow(): ContractorRow {
  return {
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    status: "未発注", name: "", work_type: "",
    budget: 0, add_contract_1: 0, add_contract_2: 0, management_budget: 0,
    order_amount: 0, add_order_1: 0, add_order_2: 0, add_order_3: 0,
    monthly: {},
  };
}

/* ─────────────────── small input components ─────────────────── */
function NumInput({
  value, onChange, bg = "", placeholder = "",
}: {
  value: number; onChange: (v: number) => void; bg?: string; placeholder?: string;
}) {
  return (
    <input
      type="number"
      min={0}
      value={value === 0 ? "" : value}
      onChange={e => onChange(Math.max(0, Number(e.target.value) || 0))}
      placeholder={placeholder}
      className={cn(
        "w-full text-right text-xs tabular-nums bg-transparent",
        "border-0 outline-none focus:ring-1 focus:ring-[#6BC9B3] focus:bg-white focus:rounded px-1 py-0.5",
        "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
        bg,
      )}
    />
  );
}
function TextInput({
  value, onChange, placeholder = "",
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "w-full text-left text-xs bg-transparent",
        "border-0 outline-none focus:ring-1 focus:ring-[#6BC9B3] focus:bg-white focus:rounded px-1 py-0.5",
      )}
    />
  );
}

/* ─────────────────── main component ─────────────────── */
interface Props {
  constructionId: string;
  contractAmount?: number;
}

export function CostBudgetTab({ constructionId, contractAmount: propAmount }: Props) {
  const patternIndex =
    constructionId.split("").reduce((s, c) => s + c.charCodeAt(0), 0) % PATTERNS.length;
  const initial = PATTERNS[patternIndex];

  const [rows, setRows] = useState<ContractorRow[]>(() =>
    initial.rows.map(r => ({ ...r, monthly: { ...r.monthly } }))
  );
  const [saved, setSaved] = useState(false);

  const contractAmount =
    propAmount && propAmount > 0 ? propAmount : initial.contract_amount;

  const months = getMonths("2025-08");

  /* ── row update helpers ── */
  const updateField = useCallback(
    <K extends keyof ContractorRow>(id: string, field: K, value: ContractorRow[K]) => {
      setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
      setSaved(false);
    }, []
  );
  const updateMonthly = useCallback((id: string, month: string, value: number) => {
    setRows(prev => prev.map(r =>
      r.id === id ? { ...r, monthly: { ...r.monthly, [month]: value } } : r
    ));
    setSaved(false);
  }, []);
  const addRow    = () => { setRows(prev => [...prev, newEmptyRow()]); setSaved(false); };
  const deleteRow = (id: string) => { setRows(prev => prev.filter(r => r.id !== id)); setSaved(false); };
  const toggleStatus = (id: string) =>
    setRows(prev => prev.map(r =>
      r.id === id ? { ...r, status: r.status === "発注済" ? "未発注" : "発注済" } : r
    ));

  /* ── totals ── */
  const totals = useMemo(() => {
    const t = {
      budget: 0, add_contract_1: 0, add_contract_2: 0,
      budget_total: 0, management_budget: 0,
      order_amount: 0, add_order_1: 0, add_order_2: 0, add_order_3: 0,
      confirmed: 0, budget_rem: 0, billing_rem: 0,
      monthly: {} as Record<string, number>,
    };
    for (const row of rows) {
      const c = compute(row);
      t.budget            += row.budget;
      t.add_contract_1    += row.add_contract_1;
      t.add_contract_2    += row.add_contract_2;
      t.budget_total      += c.budget_total;
      t.management_budget += row.management_budget;
      t.order_amount      += row.order_amount;
      t.add_order_1       += row.add_order_1;
      t.add_order_2       += row.add_order_2;
      t.add_order_3       += row.add_order_3;
      t.confirmed         += c.confirmed;
      t.budget_rem        += c.budget_rem;
      t.billing_rem       += c.billing_rem;
      for (const [k, v] of Object.entries(row.monthly))
        t.monthly[k] = (t.monthly[k] ?? 0) + (v ?? 0);
    }
    return t;
  }, [rows]);

  const gpBudget    = contractAmount - totals.budget_total;
  const gpConfirmed = contractAmount - totals.confirmed;
  const grBudget    = contractAmount > 0 ? gpBudget    / contractAmount * 100 : 0;
  const grConfirmed = contractAmount > 0 ? gpConfirmed / contractAmount * 100 : 0;

  /* ── style helpers ── */
  const th  = "px-2 py-1.5 text-center text-[11px] font-semibold whitespace-nowrap border-r border-b border-gray-200";
  const tdc = "px-1 py-1 text-right text-xs tabular-nums whitespace-nowrap border-r border-b border-gray-200";
  const tdl = "px-1 py-1 text-left  text-xs whitespace-nowrap border-r border-b border-gray-200";
  const tcc = "px-1 py-1 text-center text-xs whitespace-nowrap border-r border-b border-gray-200";

  return (
    <div className="space-y-3">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800">工事原価管理表</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            緑色のセルは自動計算 — 白いセルをクリックして入力できます
          </p>
        </div>
        <button
          onClick={() => setSaved(true)}
          className={cn(
            "text-xs font-semibold px-3 py-1.5 rounded-md transition-colors",
            saved
              ? "bg-green-100 text-green-700 cursor-default"
              : "bg-[#6BC9B3] text-white hover:bg-[#4aab96]"
          )}
        >
          {saved ? "保存済み" : "保存する"}
        </button>
      </div>

      {/* テーブル */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="border-collapse text-sm" style={{ minWidth: "1750px" }}>
          <colgroup>
            <col style={{ width: 32 }} /><col style={{ width: 62 }} />
            <col style={{ width: 130 }} /><col style={{ width: 115 }} />
            <col style={{ width: 92 }} /><col style={{ width: 92 }} /><col style={{ width: 92 }} />
            <col style={{ width: 100 }} /><col style={{ width: 92 }} />
            <col style={{ width: 92 }} /><col style={{ width: 92 }} /><col style={{ width: 92 }} /><col style={{ width: 92 }} />
            <col style={{ width: 92 }} /><col style={{ width: 86 }} />
            {months.map(m => <col key={m} style={{ width: 78 }} />)}
            <col style={{ width: 86 }} />
            <col style={{ width: 48 }} />
          </colgroup>

          <thead>
            <tr>
              <th colSpan={4} className={cn(th, "bg-gray-100 text-left text-gray-600")}>基本情報</th>
              <th colSpan={3} className={cn(th, "bg-blue-100 text-blue-800")}>実行予算・追加契約</th>
              <th className={cn(th, "bg-green-100 text-green-800")}>合算</th>
              <th className={cn(th, "bg-violet-100 text-violet-800")}>管理</th>
              <th colSpan={4} className={cn(th, "bg-amber-100 text-amber-800")}>発注</th>
              <th className={cn(th, "bg-sky-100 text-sky-800")}>確定</th>
              <th className={cn(th, "bg-rose-100 text-rose-700")}>予算残</th>
              <th colSpan={months.length} className={cn(th, "bg-sky-50 text-sky-700")}>請求（月次入力）</th>
              <th className={cn(th, "bg-rose-100 text-rose-700")}>請求残</th>
              <th className={cn(th, "bg-gray-100")} />
            </tr>
            <tr className="bg-gray-50">
              <th className={cn(th, "bg-gray-100")}>#</th>
              <th className={cn(th, "bg-gray-100")}>発注</th>
              <th className={cn(th, "bg-gray-100 text-left")}>施工業者名</th>
              <th className={cn(th, "bg-gray-100 text-left")}>工種</th>
              <th className={cn(th, "bg-blue-50")}>実行予算</th>
              <th className={cn(th, "bg-blue-50")}>追加契約①</th>
              <th className={cn(th, "bg-blue-50")}>追加契約②</th>
              <th className={cn(th, "bg-green-50 text-[10px] leading-tight")}>追加含む<br/>実行予算</th>
              <th className={cn(th, "bg-violet-50")}>管理用予算</th>
              <th className={cn(th, "bg-amber-50")}>発注額</th>
              <th className={cn(th, "bg-amber-50")}>追加発注①</th>
              <th className={cn(th, "bg-amber-50")}>追加発注②</th>
              <th className={cn(th, "bg-amber-50")}>追加発注③</th>
              <th className={cn(th, "bg-sky-100")}>確定額</th>
              <th className={cn(th, "bg-rose-50")}>予算残</th>
              {months.map(m => (
                <th key={m} className={cn(th, "bg-sky-50")}>{monthLabel(m)}</th>
              ))}
              <th className={cn(th, "bg-rose-100")}>請求残</th>
              <th className={cn(th, "bg-gray-100")} />
            </tr>
          </thead>

          <tbody>
            {rows.map((row, idx) => {
              const c = compute(row);
              return (
                <tr key={row.id} className="hover:bg-gray-50/40 transition-colors group/row">
                  <td className={cn(tcc, "bg-gray-50 text-gray-400 text-[11px]")}>{idx + 1}</td>
                  {/* 発注ステータス (クリックで切替) */}
                  <td className={cn(tcc)}>
                    <button
                      onClick={() => toggleStatus(row.id)}
                      className={cn(
                        "inline-block px-1.5 py-0.5 rounded text-[10px] font-bold leading-tight cursor-pointer transition-colors",
                        row.status === "発注済"
                          ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      )}
                    >
                      {row.status}
                    </button>
                  </td>
                  {/* 施工業者名 */}
                  <td className={cn(tdl, "font-medium")}>
                    <TextInput
                      value={row.name}
                      onChange={v => updateField(row.id, "name", v)}
                      placeholder="業者名"
                    />
                  </td>
                  {/* 工種 */}
                  <td className={cn(tdl)}>
                    <TextInput
                      value={row.work_type}
                      onChange={v => updateField(row.id, "work_type", v)}
                      placeholder="工種"
                    />
                  </td>
                  {/* 実行予算 */}
                  <td className={cn(tdc, "bg-blue-50/30")}>
                    <NumInput value={row.budget} onChange={v => updateField(row.id, "budget", v)} />
                  </td>
                  <td className={cn(tdc, "bg-blue-50/30")}>
                    <NumInput value={row.add_contract_1} onChange={v => updateField(row.id, "add_contract_1", v)} />
                  </td>
                  <td className={cn(tdc, "bg-blue-50/30")}>
                    <NumInput value={row.add_contract_2} onChange={v => updateField(row.id, "add_contract_2", v)} />
                  </td>
                  {/* 追加含む実行予算（自動計算） */}
                  <td className={cn(tdc, "bg-green-50 font-semibold text-gray-800")}>
                    {fmtAlways(c.budget_total)}
                  </td>
                  {/* 管理用予算 */}
                  <td className={cn(tdc, "bg-violet-50/40")}>
                    <NumInput value={row.management_budget} onChange={v => updateField(row.id, "management_budget", v)} />
                  </td>
                  {/* 発注 */}
                  <td className={cn(tdc, "bg-amber-50/40")}>
                    <NumInput value={row.order_amount} onChange={v => updateField(row.id, "order_amount", v)} />
                  </td>
                  <td className={cn(tdc, "bg-amber-50/40")}>
                    <NumInput value={row.add_order_1} onChange={v => updateField(row.id, "add_order_1", v)} />
                  </td>
                  <td className={cn(tdc, "bg-amber-50/40")}>
                    <NumInput value={row.add_order_2} onChange={v => updateField(row.id, "add_order_2", v)} />
                  </td>
                  <td className={cn(tdc, "bg-amber-50/40")}>
                    <NumInput value={row.add_order_3} onChange={v => updateField(row.id, "add_order_3", v)} />
                  </td>
                  {/* 確定額（自動計算） */}
                  <td className={cn(tdc, "bg-sky-100/50 font-semibold")}>{fmtView(c.confirmed)}</td>
                  {/* 予算残（自動計算） */}
                  <td className={cn(tdc,
                    c.budget_rem < 0  ? "bg-rose-50 text-red-600 font-semibold" :
                    c.budget_rem > 0  ? "bg-green-50 text-emerald-700" : ""
                  )}>
                    {c.budget_total > 0 ? fmtAlways(c.budget_rem) : ""}
                  </td>
                  {/* 月次請求 */}
                  {months.map(m => (
                    <td key={m} className={cn(tdc, "bg-sky-50/20")}>
                      <NumInput
                        value={row.monthly[m] ?? 0}
                        onChange={v => updateMonthly(row.id, m, v)}
                      />
                    </td>
                  ))}
                  {/* 請求残（自動計算） */}
                  <td className={cn(tdc,
                    c.billing_rem > 0 ? "bg-rose-50 text-red-600 font-semibold" :
                    c.billing_rem < 0 ? "bg-green-50 text-emerald-700 font-semibold" : ""
                  )}>
                    {c.confirmed > 0 ? fmtAlways(c.billing_rem) : ""}
                  </td>
                  {/* 削除 */}
                  <td className={cn(tcc, "bg-gray-50/60")}>
                    <button
                      onClick={() => deleteRow(row.id)}
                      className="opacity-0 group-hover/row:opacity-100 transition-opacity text-gray-300 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}

            {/* 行を追加 */}
            <tr className="border-b border-gray-200">
              <td colSpan={16 + months.length + 1} className="py-1.5 px-3 bg-gray-50/60">
                <button
                  onClick={addRow}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#4aab96] transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  行を追加
                </button>
              </td>
            </tr>

            {/* スペーサー */}
            <tr className="bg-gray-100 border-b border-gray-300">
              <td colSpan={16 + months.length + 1} className="h-1.5" />
            </tr>

            {/* 合計行 */}
            <tr className="bg-blue-50/20 font-semibold border-b-2 border-gray-300">
              <td colSpan={2} className={cn(tcc, "bg-gray-100")} />
              <td colSpan={2} className={cn(tdl, "bg-gray-50 font-bold")}>合計</td>
              <td className={cn(tdc, "bg-blue-50 font-bold")}>{fmtAlways(totals.budget)}</td>
              <td className={cn(tdc, "bg-blue-50 font-bold")}>{fmtView(totals.add_contract_1)}</td>
              <td className={cn(tdc, "bg-blue-50 font-bold")}>{fmtView(totals.add_contract_2)}</td>
              <td className={cn(tdc, "bg-green-100 font-bold")}>{fmtAlways(totals.budget_total)}</td>
              <td className={cn(tdc, "bg-violet-50 font-bold")}>{fmtView(totals.management_budget)}</td>
              <td className={cn(tdc, "bg-amber-50 font-bold")}>{fmtView(totals.order_amount)}</td>
              <td className={cn(tdc, "bg-amber-50 font-bold")}>{fmtView(totals.add_order_1)}</td>
              <td className={cn(tdc, "bg-amber-50 font-bold")}>{fmtView(totals.add_order_2)}</td>
              <td className={cn(tdc, "bg-amber-50 font-bold")}>{fmtView(totals.add_order_3)}</td>
              <td className={cn(tdc, "bg-sky-100 font-bold")}>{fmtView(totals.confirmed)}</td>
              <td className={cn(tdc, totals.budget_rem < 0 ? "bg-rose-100 text-red-600 font-bold" : "bg-green-100 text-emerald-700 font-bold")}>
                {fmtAlways(totals.budget_rem)}
              </td>
              {months.map(m => (
                <td key={m} className={cn(tdc, "bg-sky-50 font-bold")}>{fmtView(totals.monthly[m] ?? 0)}</td>
              ))}
              <td className={cn(tdc, totals.billing_rem > 0 ? "bg-rose-100 text-red-600 font-bold" : "bg-green-100 text-emerald-700 font-bold")}>
                {totals.billing_rem !== 0 ? fmtAlways(totals.billing_rem) : ""}
              </td>
              <td className={cn(tcc, "bg-gray-100")} />
            </tr>
          </tbody>

          {/* ── サマリーフッター ── */}
          <tfoot className="border-t-2 border-gray-400">
            <tr className="bg-gray-50 text-[11px] text-gray-500">
              <td colSpan={4} className={cn(tdl, "bg-gray-100")} />
              <td colSpan={4} className={cn(tdc, "text-center bg-blue-50/60 font-semibold text-blue-700")}>実行予算（暫定）</td>
              <td className={cn(tdc, "bg-violet-50")} />
              <td colSpan={4} className={cn(tdc, "text-center bg-amber-50 font-semibold text-amber-700")}>暫定合計</td>
              <td colSpan={2} className={cn(tdc, "text-center bg-sky-50 font-semibold text-sky-700")}>確定額</td>
              <td colSpan={months.length + 2} className={cn(tdc)} />
            </tr>
            {[
              { label: "契約金額",   vBudget: contractAmount, vConfirmed: contractAmount, isRate: false },
              { label: "工事粗利額", vBudget: gpBudget,       vConfirmed: gpConfirmed,   isRate: false },
              { label: "工事粗利率", vBudget: grBudget,       vConfirmed: grConfirmed,   isRate: true  },
            ].map(({ label, vBudget, vConfirmed, isRate }) => (
              <tr key={label} className="bg-white border-b border-gray-200">
                <td colSpan={4} className={cn(tdl, "bg-gray-100 font-semibold text-gray-700")}>{label}</td>
                <td colSpan={4} className={cn(tdc, "bg-blue-50 font-bold",
                  !isRate && vBudget < 0 ? "text-red-600" : !isRate ? "text-gray-800" : vBudget < 0 ? "text-red-600" : "text-emerald-700"
                )}>
                  {isRate ? `${vBudget.toFixed(1)}%` : fmtAlways(vBudget)}
                </td>
                <td className={cn(tdc, "bg-violet-50")} />
                <td colSpan={4} className={cn(tdc, "bg-amber-50 text-gray-400")}>—</td>
                <td colSpan={2} className={cn(tdc, "bg-sky-50 font-bold",
                  !isRate && vConfirmed < 0 ? "text-red-600" : !isRate ? "text-gray-800" : vConfirmed < 0 ? "text-red-600" : "text-emerald-700"
                )}>
                  {isRate ? `${vConfirmed.toFixed(1)}%` : fmtAlways(vConfirmed)}
                </td>
                <td colSpan={months.length + 2} className={cn(tdc)} />
              </tr>
            ))}
          </tfoot>
        </table>
      </div>
    </div>
  );
}
