import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyCloudSignWebhook, type CloudSignWebhookEvent } from "@/lib/integrations/cloudsign";

/**
 * CloudSign Webhook
 * - 契約書: metadata.contract_id / cloudsign_document_id → contracts
 * - 発注書・請書: metadata.contractor_order_id / cloudsign_document_id → contractor_orders.concluded_at
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-cloudsign-signature");

  let event: CloudSignWebhookEvent;
  try {
    event = JSON.parse(rawBody) as CloudSignWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const contractorOrderId = event.metadata?.contractor_order_id;

  let order: { id: string; company_id: string; title: string | null; po_no?: string | null } | null = null;
  if (contractorOrderId) {
    const { data } = await supabase
      .from("contractor_orders")
      .select("id, company_id, title, po_no")
      .eq("id", contractorOrderId)
      .maybeSingle();
    order = data;
  }
  if (!order && event.document_id) {
    const { data } = await supabase
      .from("contractor_orders")
      .select("id, company_id, title, po_no")
      .eq("cloudsign_document_id", event.document_id)
      .maybeSingle();
    order = data;
  }

  if (order) {
    const { data: company } = await supabase.from("companies").select("settings").eq("id", order.company_id).single();
    const settings = company?.settings as Record<string, unknown> | undefined;
    const cs = (settings?.cloudsign ?? {}) as { enabled?: boolean; api_key?: string };
    if (!verifyCloudSignWebhook(rawBody, signature, { enabled: Boolean(cs.enabled), api_key: cs.api_key })) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    if (event.status === "signed") {
      await supabase.from("contractor_orders").update({
        concluded_at: event.signed_at ?? new Date().toISOString(),
        ledger_status: "ordered",
        updated_at: new Date().toISOString(),
      }).eq("id", order.id);
    }
    return NextResponse.json({ ok: true, kind: "contractor_order" });
  }

  const contractId = event.metadata?.contract_id;
  let contractQuery = supabase.from("contracts").select("id, company_id, title, contract_no");

  if (contractId) {
    contractQuery = contractQuery.eq("id", contractId);
  } else if (event.document_id) {
    contractQuery = contractQuery.eq("cloudsign_document_id", event.document_id);
  } else {
    return NextResponse.json({ error: "Missing document reference" }, { status: 400 });
  }

  const { data: contract } = await contractQuery.maybeSingle();
  if (!contract) {
    return NextResponse.json({ ok: true, message: "Document not found (ignored)" });
  }

  const { data: company } = await supabase.from("companies").select("settings").eq("id", contract.company_id).single();
  const settings = company?.settings as Record<string, unknown> | undefined;
  const cs = (settings?.cloudsign ?? {}) as { enabled?: boolean; api_key?: string };

  if (!verifyCloudSignWebhook(rawBody, signature, { enabled: Boolean(cs.enabled), api_key: cs.api_key })) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event.status === "signed") {
    await supabase.from("contracts").update({
      status: "contracted",
      cloudsign_status: "signed",
      cloudsign_signed_at: event.signed_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", contract.id);

    const { data: assignee } = await supabase
      .from("contracts")
      .select("assigned_to")
      .eq("id", contract.id)
      .single();

    if (assignee?.assigned_to) {
      await supabase.from("todos").insert({
        company_id: contract.company_id,
        assigned_to: assignee.assigned_to,
        title: `電子署名完了: ${contract.contract_no}`,
        description: `「${contract.title}」の電子契約が締結されました`,
        status: "pending",
        priority: "high",
        tags: ["sales_flow", "cloudsign"],
        source: "cloudsign_webhook",
      });
    }
  } else {
    await supabase.from("contracts").update({
      cloudsign_status: event.status,
      updated_at: new Date().toISOString(),
    }).eq("id", contract.id);
  }

  return NextResponse.json({ ok: true, kind: "contract" });
}
