import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/** 開発用: 問い合わせ自動取り込み（認証不要・デモ会社の inbound_leads に登録） */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_INBOUND !== "true") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Missing Supabase env" }, { status: 500 });
  }

  try {
    const body = await request.json() as {
      name?: string;
      email?: string;
      phone?: string;
      source?: string;
      inquiry_content?: string;
      inquiry_category?: string;
      company_id?: string;
    };

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const admin = createServiceClient(url, serviceKey, { auth: { persistSession: false } });

    let companyId = body.company_id;
    if (!companyId) {
      const { data: demoProfile } = await admin
        .from("profiles")
        .select("company_id")
        .eq("email", "admin@example.com")
        .maybeSingle();
      companyId = demoProfile?.company_id ?? undefined;
    }
    if (!companyId) {
      return NextResponse.json({ error: "Demo company not found" }, { status: 500 });
    }

    const { data: assignee } = await admin
      .from("profiles")
      .select("id")
      .eq("company_id", companyId)
      .eq("role", "hq_admin")
      .limit(1)
      .maybeSingle();

    const assigneeId = assignee?.id ?? null;

    const { data: lead, error: leadErr } = await admin.from("inbound_leads").insert({
      company_id: companyId,
      name: body.name.trim(),
      email: body.email ?? null,
      phone: body.phone ?? null,
      source: body.source ?? "dev_api",
      inquiry_content: body.inquiry_content ?? null,
      inquiry_category: body.inquiry_category ?? null,
      assigned_to: assigneeId,
      status: "new",
    }).select().single();
    if (leadErr) throw leadErr;

    if (assigneeId) {
      await admin.from("todos").insert({
        company_id: companyId,
        assigned_to: assigneeId,
        title: `新規問い合わせ: ${body.name.trim()}`,
        description: body.inquiry_content?.slice(0, 200) ?? "問い合わせが自動登録されました",
        status: "pending",
        priority: "high",
        source: "inbound_lead",
        tags: ["sales_flow", "urgent"],
      });
    }

    return NextResponse.json({
      ok: true,
      leadId: lead.id,
      assigneeId,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 500 },
    );
  }
}
