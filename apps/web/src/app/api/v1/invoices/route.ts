import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiRequest, hasScope } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const ctx = await authenticateApiRequest(request.headers.get("authorization"));
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasScope(ctx, "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_no, recipient, customer_id, construction_id, invoice_date, due_date, payment_terms, status, subtotal, tax, total, created_at, updated_at, customer:customers(id, name), construction:constructions(id, title)")
    .eq("company_id", ctx.companyId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}
