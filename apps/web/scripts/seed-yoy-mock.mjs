/**
 * 昨対比グラフ検証用：前年度（R7年度＝2025-04〜2026-03）の完工工事モックを投入。
 * BIの実績データソース default（完工工事）に載るよう status='completed' で作成。
 *
 * 実行: node apps/web/scripts/seed-yoy-mock.mjs
 * 取消: node apps/web/scripts/seed-yoy-mock.mjs --clean
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const get = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1] ?? "").trim();
const admin = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"));

const DEMO_COMPANY_ID = "00000000-0000-0000-0000-000000000001";
const DEPTS = ["一般住宅", "新築", "公共工事", "リフォーム"];

const ROWS = [
  { end: "2025-04-20", amount: 2000000 },
  { end: "2025-05-20", amount: 2400000 },
  { end: "2025-06-20", amount: 1800000 },
  { end: "2025-07-20", amount: 3200000 },
  { end: "2025-08-20", amount: 2100000 },
  { end: "2025-09-20", amount: 2600000 },
  { end: "2025-10-20", amount: 3000000 },
  { end: "2025-11-20", amount: 2300000 },
  { end: "2025-12-20", amount: 3500000 },
  { end: "2026-01-20", amount: 1900000 },
  { end: "2026-02-20", amount: 2200000 },
  { end: "2026-03-20", amount: 2000000 },
];

async function resolveCompanyId() {
  const { data } = await admin.from("constructions").select("company_id");
  if (data && data.length > 0) {
    const counts = new Map();
    for (const r of data) counts.set(r.company_id, (counts.get(r.company_id) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }
  const { data: demo } = await admin.from("companies").select("id").eq("id", DEMO_COMPANY_ID).maybeSingle();
  if (demo) return demo.id;
  const { data: first } = await admin.from("companies").select("id").order("created_at").limit(1).maybeSingle();
  return first?.id ?? null;
}

const clean = process.argv.includes("--clean");
const companyId = await resolveCompanyId();
if (!companyId) {
  console.error("会社が見つかりません。先に会社データを作成してください。");
  process.exit(1);
}

if (clean) {
  const { error } = await admin.from("constructions").delete().eq("company_id", companyId).like("construction_no", "MOCK-R7-%");
  if (error) throw error;
  console.log("前年度モック工事を削除しました。");
  process.exit(0);
}

const daysBefore = (dateStr, days) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

const payload = ROWS.map((r, i) => ({
  company_id: companyId,
  construction_no: `MOCK-R7-${String(i + 1).padStart(2, "0")}`,
  customer_id: null,
  title: `（前年度実績モック）${r.end.slice(0, 7)} 完工工事`,
  status: "completed",
  start_date: daysBefore(r.end, 60),
  end_date: r.end,
  order_amount: r.amount,
  budget_cost: Math.round(r.amount * 0.68),
  actual_cost: Math.round(r.amount * 0.68),
  worker_count: 4,
  progress: 100,
  department_name: DEPTS[i % DEPTS.length],
}));

const { error } = await admin
  .from("constructions")
  .upsert(payload, { onConflict: "company_id,construction_no" });
if (error) throw error;

const total = ROWS.reduce((s, r) => s + r.amount, 0);
console.log(`前年度（R7）完工工事 ${ROWS.length}件を投入しました（company_id=${companyId}）。`);
console.log(`前期売上合計: ¥${total.toLocaleString()}（約${Math.round(total / 10000)}万）`);
console.log("BIダッシュボードを開き直すと「売上昨対比」に前期の棒が表示されます。");
