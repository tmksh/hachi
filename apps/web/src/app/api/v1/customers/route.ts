import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiRequest, hasScope } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const ctx = await authenticateApiRequest(request.headers.get("authorization"));
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasScope(ctx, "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, company_name, email, phone, address, source, status, tags, assigned_to, created_at, updated_at")
    .eq("company_id", ctx.companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}
