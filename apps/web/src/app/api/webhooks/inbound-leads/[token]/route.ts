import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  insertInboundLeadFromWebhook,
  normalizeInboundPayload,
  readInboundWebhookSettings,
  verifyInboundSecret,
} from "@/lib/inbound-leads";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

/** 疎通確認用 */
export async function GET(_req: NextRequest, context: RouteContext) {
  const { token } = await context.params;
  const companyId = await findCompanyIdByToken(token);
  if (!companyId) {
    return NextResponse.json({ error: "Unknown webhook" }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    service: "bridge-inbound-leads",
    message: "POST JSON to this URL with X-Bridge-Secret header",
  });
}

/**
 * 問い合わせ自動取り込み（Webフォーム / Zapier / Make 等）
 *
 * POST /api/webhooks/inbound-leads/:token
 * Auth: X-Bridge-Secret / Authorization: Bearer / ?secret=
 */
export async function POST(req: NextRequest, context: RouteContext) {
  const { token } = await context.params;
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const { data: companies, error: companyErr } = await admin
    .from("companies")
    .select("id, settings")
    .filter("settings->inbound_webhook->>token", "eq", token)
    .limit(1);

  if (companyErr) {
    return NextResponse.json({ error: companyErr.message }, { status: 500 });
  }

  const company = companies?.[0];
  if (!company) {
    return NextResponse.json({ error: "Unknown webhook" }, { status: 404 });
  }

  const cfg = readInboundWebhookSettings(company.settings as Record<string, unknown>);
  if (!cfg?.enabled) {
    return NextResponse.json({ error: "Webhook disabled" }, { status: 403 });
  }

  const providedSecret =
    req.headers.get("x-bridge-secret")
    ?? (req.headers.get("authorization")?.startsWith("Bearer ")
      ? req.headers.get("authorization")!.slice(7).trim()
      : null)
    ?? req.nextUrl.searchParams.get("secret");

  if (!verifyInboundSecret(providedSecret, cfg.secret_hash)) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const form = await req.formData();
      body = Object.fromEntries(form.entries()) as Record<string, unknown>;
    } else {
      body = (await req.json()) as Record<string, unknown>;
    }
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const normalized = normalizeInboundPayload(body);
  if (!normalized) {
    return NextResponse.json(
      { error: "name is required", accepted_fields: ["name", "email", "phone", "inquiry_content", "source"] },
      { status: 400 },
    );
  }

  try {
    const lead = await insertInboundLeadFromWebhook(admin, company.id, normalized);
    return NextResponse.json({ ok: true, leadId: lead.id }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 500 },
    );
  }
}

async function findCompanyIdByToken(token: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("companies")
      .select("id, settings")
      .filter("settings->inbound_webhook->>token", "eq", token)
      .limit(1);
    const company = data?.[0];
    if (!company) return null;
    const cfg = readInboundWebhookSettings(company.settings as Record<string, unknown>);
    return cfg?.enabled ? company.id : null;
  } catch {
    return null;
  }
}
