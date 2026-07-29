import { createClient } from "@/lib/supabase/server";
import { getCompanySettings } from "@/lib/actions/profiles";

type ClosingDaySetting = "20" | "end_of_month";

export type MonthlyInvoiceBulkResult = {
  created: number;
  skipped: number;
  failures: string[];
  invoiceDate: string;
  periodLabel: string;
};

function getClosingDay(settings: Record<string, unknown> | null | undefined): ClosingDaySetting {
  const day = settings?.invoice_closing_day;
  return day === "20" ? "20" : "end_of_month";
}

function getBillingPeriod(reference: Date, closingDay: ClosingDaySetting) {
  const y = reference.getFullYear();
  const m = reference.getMonth();
  if (closingDay === "20") {
    const end = new Date(y, m, 20);
    const start = new Date(y, m - 1, 21);
    return { start, end, label: `${start.getFullYear()}年${start.getMonth() + 1}月21日〜${end.getFullYear()}年${end.getMonth() + 1}月20日` };
  }
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  return { start, end, label: `${y}年${m + 1}月（月末締め）` };
}

function monthsBetween(start: string, end: string): number {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  return Math.max(1, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1);
}

function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function errMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  return fallback;
}

async function allocateInvoiceNo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
): Promise<string> {
  const { data: seq, error } = await supabase.rpc("next_document_number", { p_kind: "invoice" });
  if (!error && typeof seq === "number" && seq > 0) {
    return `INV-${String(seq).padStart(4, "0")}`;
  }
  const { count } = await supabase
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId);
  return `INV-${String((count || 0) + 1).padStart(4, "0")}`;
}

/** 指定月（YYYY-MM）の締日ベースで月次請求書を一括生成（throw しない） */
export async function runMonthlyInvoiceBulkGeneration(
  month: string,
): Promise<MonthlyInvoiceBulkResult | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "ログインが必要です" };

  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) return { error: "プロフィールが見つかりません" };

  const match = /^(\d{4})-(\d{2})$/.exec(month.trim());
  if (!match) return { error: "対象月の形式が不正です（YYYY-MM）" };
  const y = Number(match[1]);
  const m = Number(match[2]);
  if (!y || m < 1 || m > 12) return { error: "対象月の形式が不正です" };

  const settings = await getCompanySettings().catch(() => null);
  const closingDay = getClosingDay(settings);
  const period = getBillingPeriod(new Date(y, m - 1, 15), closingDay);

  const invoiceDate = toLocalDateString(period.end);
  const dueDate = toLocalDateString(new Date(period.end.getFullYear(), period.end.getMonth() + 2, 0));

  const monthStart = toLocalDateString(new Date(y, m - 1, 1));
  const monthEnd = toLocalDateString(new Date(y, m, 0));

  const { data: constructions, error: conErr } = await supabase
    .from("constructions")
    .select("id, title, customer_id, order_amount, start_date, end_date, status")
    .eq("company_id", profile.company_id)
    .in("status", ["preparing", "in_progress", "completed"])
    .gt("order_amount", 0);
  if (conErr) return { error: `工事一覧の取得に失敗しました: ${conErr.message}` };

  const inPeriod = (constructions ?? []).filter((c) => {
    if (!c.start_date && !c.end_date) return true;
    const start = c.start_date ?? "1900-01-01";
    const end = c.end_date ?? "2999-12-31";
    return start <= monthEnd && end >= monthStart;
  });

  const { data: existingInvoices, error: existErr } = await supabase
    .from("invoices")
    .select("construction_id")
    .eq("company_id", profile.company_id)
    .eq("invoice_date", invoiceDate)
    .not("construction_id", "is", null);
  if (existErr) return { error: `既存請求書の確認に失敗しました: ${existErr.message}` };

  const invoicedIds = new Set((existingInvoices ?? []).map((r) => r.construction_id as string));
  const targets = inPeriod.filter((c) => !invoicedIds.has(c.id));
  const skipped = inPeriod.length - targets.length;

  let created = 0;
  const failures: string[] = [];

  for (const con of targets) {
    try {
      const orderAmount = Number(con.order_amount ?? 0);
      if (!Number.isFinite(orderAmount) || orderAmount <= 0) {
        failures.push(`${con.title}: 受注金額が不正です`);
        continue;
      }

      let subtotal = orderAmount;
      if (con.start_date && con.end_date) {
        const monthCount = monthsBetween(con.start_date, con.end_date);
        const monthly = Math.floor(orderAmount / monthCount);
        const endMonth = (con.end_date as string).slice(0, 7);
        subtotal = endMonth === month ? orderAmount - monthly * (monthCount - 1) : monthly;
      }
      subtotal = Math.max(0, Math.round(subtotal));
      const tax = Math.floor(subtotal * 0.1);
      const invoiceNo = await allocateInvoiceNo(supabase, profile.company_id);

      const { data: invoice, error } = await supabase
        .from("invoices")
        .insert({
          company_id: profile.company_id,
          invoice_no: invoiceNo,
          construction_id: con.id,
          customer_id: con.customer_id,
          invoice_date: invoiceDate,
          due_date: dueDate,
          payment_terms: closingDay === "20" ? "20日締め翌月末払い" : "月末締め翌月末払い",
          subtotal,
          tax,
          total: subtotal + tax,
          status: "draft",
          created_by: user.id,
        })
        .select("id")
        .single();
      if (error || !invoice) {
        throw new Error(error?.message ?? "請求書の作成に失敗しました");
      }

      const { error: itemErr } = await supabase.from("invoice_items").insert({
        company_id: profile.company_id,
        invoice_id: invoice.id,
        description: `${con.title ?? "工事"}（${period.label}）`,
        quantity: 1,
        unit_price: subtotal,
        amount: subtotal,
        sort_order: 0,
      });
      if (itemErr) {
        await supabase.from("invoices").delete().eq("id", invoice.id);
        throw new Error(itemErr.message);
      }

      created += 1;
    } catch (e) {
      failures.push(`${con.title ?? con.id}: ${errMessage(e, "作成失敗")}`);
    }
  }

  return {
    created,
    skipped,
    failures,
    invoiceDate,
    periodLabel: period.label,
  };
}
