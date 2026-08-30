"use server";

import { createClient } from "@/lib/supabase/server";
import { notifySalesFlowUser } from "@/lib/actions/sales-flow";
import { getCloudSignConfig, sendToCloudSign } from "@/lib/integrations/cloudsign";
import { buildPaymentSchedule } from "@/lib/construction/payment-schedule";
import { suggestAccountItem } from "@/lib/procurement";
import type { ContractorOrder, Craftsman } from "@/lib/database.types";

const ORDER_SELECT = "*, craftsman:craftsmen(id, name)";

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, display_name")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("Profile not found");
  return { supabase, user, companyId: profile.company_id, displayName: profile.display_name };
}

/** 業者マスタに名前だけで新規登録 */
export async function createCraftsmanByName(name: string): Promise<Craftsman> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("業者名が空です");
  const { supabase, companyId } = await getAuthContext();
  const { data, error } = await supabase
    .from("craftsmen")
    .insert({ company_id: companyId, name: trimmed })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Craftsman;
}

/** 発注書を承認申請（draft → submitted）し、承認者へ通知 */
export async function submitContractorOrder(input: {
  orderId: string;
  approverId: string;
  comment?: string;
}) {
  const { supabase, user, companyId, displayName } = await getAuthContext();

  const { data: order, error } = await supabase
    .from("contractor_orders")
    .update({
      status: "submitted",
      submitted_to: input.approverId,
      submitted_by: user.id,
      submitted_comment: input.comment?.trim() || null,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", input.orderId)
    .select(ORDER_SELECT)
    .single();
  if (error) throw new Error(error.message);

  await notifySalesFlowUser(supabase, companyId, input.approverId, {
    title: `発注書の承認申請: ${order.title}`,
    description: `${displayName ?? "担当者"}から発注書（¥${Number(order.amount ?? 0).toLocaleString()}）の承認申請が届きました${input.comment?.trim() ? `\nコメント: ${input.comment.trim()}` : ""}`,
    href: `/constructions/${order.construction_id}?tab=orders`,
    urgent: true,
  }, user.id);

  return order as ContractorOrder;
}

/** 発注書を承認（submitted → approved）し、申請者へ通知 */
export async function approveContractorOrder(orderId: string) {
  const { supabase, user, companyId, displayName } = await getAuthContext();

  const { data: order, error } = await supabase
    .from("contractor_orders")
    .update({
      status: "approved",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .select(ORDER_SELECT)
    .single();
  if (error) throw new Error(error.message);

  const submittedBy = (order as { submitted_by?: string | null }).submitted_by;
  if (submittedBy && submittedBy !== user.id) {
    await notifySalesFlowUser(supabase, companyId, submittedBy, {
      title: `発注書が承認されました: ${order.title}`,
      description: `${displayName ?? "承認者"}が発注書（¥${Number(order.amount ?? 0).toLocaleString()}）を承認しました`,
      href: `/constructions/${order.construction_id}?tab=orders`,
    }, user.id);
  }

  return order as ContractorOrder;
}

/** 発注書を差戻し（submitted → draft）し、申請者へ通知 */
export async function rejectContractorOrder(orderId: string, reason?: string) {
  const { supabase, user, companyId, displayName } = await getAuthContext();

  const { data: order, error } = await supabase
    .from("contractor_orders")
    .update({ status: "draft" })
    .eq("id", orderId)
    .select(ORDER_SELECT)
    .single();
  if (error) throw new Error(error.message);

  const submittedBy = (order as { submitted_by?: string | null }).submitted_by;
  if (submittedBy && submittedBy !== user.id) {
    await notifySalesFlowUser(supabase, companyId, submittedBy, {
      title: `発注書が差戻されました: ${order.title}`,
      description: `${displayName ?? "承認者"}が発注書を差戻しました${reason?.trim() ? `\n理由: ${reason.trim()}` : ""}`,
      href: `/constructions/${order.construction_id}?tab=orders`,
      urgent: true,
    }, user.id);
  }

  return order as ContractorOrder;
}

/** 承認済み発注書を CloudSign へ送信（APIキー未設定時はエラーメッセージを返す） */
export async function sendContractorOrderToCloudSign(orderId: string): Promise<{
  ok: boolean;
  message: string;
}> {
  const { supabase, companyId } = await getAuthContext();

  const { data: order, error } = await supabase
    .from("contractor_orders")
    .select("id, title, status, craftsman:craftsmen(id, name, email)")
    .eq("id", orderId)
    .single();
  if (error) throw new Error(error.message);
  if (order.status !== "approved") {
    return { ok: false, message: "承認済みの発注書のみCloudSign送信できます" };
  }

  const { data: company } = await supabase
    .from("companies")
    .select("settings")
    .eq("id", companyId)
    .single();
  const config = getCloudSignConfig(company?.settings as Record<string, unknown> | null);
  if (!config.enabled || !config.api_key) {
    return { ok: false, message: "CloudSign APIキーが未設定です" };
  }

  const craftsman = Array.isArray(order.craftsman) ? order.craftsman[0] : order.craftsman;
  const result = await sendToCloudSign(config, {
    title: `発注書: ${order.title}`,
    signers: [{ name: craftsman?.name ?? "発注先", email: craftsman?.email ?? "", order: 1 }],
    metadata: { contractor_order_id: order.id },
  });
  const sentAt = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("contractor_orders")
    .update({
      clouds_sign_sent_at: sentAt,
      cloudsign_document_id: result.document_id,
    })
    .eq("id", orderId);
  if (updErr && /cloudsign_document_id/i.test(updErr.message)) {
    await supabase
      .from("contractor_orders")
      .update({ clouds_sign_sent_at: sentAt })
      .eq("id", orderId);
  }
  return { ok: true, message: result.message };
}

/** 紙発注など、電子署名なしで請書を受領済みにする */
export async function markContractorOrderAcknowledged(orderId: string): Promise<ContractorOrder> {
  const { supabase, companyId } = await getAuthContext();
  const now = new Date().toISOString();
  const { data: order, error } = await supabase
    .from("contractor_orders")
    .update({
      concluded_at: now,
      ledger_status: "ordered",
      updated_at: now,
    })
    .eq("id", orderId)
    .eq("company_id", companyId)
    .eq("status", "approved")
    .select(ORDER_SELECT)
    .single();
  if (error && /ledger_status/i.test(error.message)) {
    const retry = await supabase
      .from("contractor_orders")
      .update({ concluded_at: now, updated_at: now })
      .eq("id", orderId)
      .eq("company_id", companyId)
      .eq("status", "approved")
      .select(ORDER_SELECT)
      .single();
    if (retry.error) throw new Error(retry.error.message);
    return retry.data as ContractorOrder;
  }
  if (error) throw new Error(error.message);
  return order as ContractorOrder;
}

/** 工事台帳で選択した複数業者へドラフト発注書を一括生成 */
export async function bulkCreateContractorOrders(
  constructionId: string,
  rows: Array<{ name: string; workType?: string; amount: number; accountItem?: string }>,
) {
  const { supabase, companyId } = await getAuthContext();

  const { data: construction, error: conErr } = await supabase
    .from("constructions")
    .select("title, start_date, end_date")
    .eq("id", constructionId)
    .single();
  if (conErr) throw new Error(conErr.message);

  const { data: craftsmenData, error: craftErr } = await supabase
    .from("craftsmen")
    .select("id, name")
    .eq("company_id", companyId)
    .is("deleted_at", null);
  if (craftErr) throw new Error(craftErr.message);
  const craftsmen = craftsmenData ?? [];

  const { listAccountItemHistory } = await import("@/lib/actions/procurement");
  const past = await listAccountItemHistory();

  const matchId = (name: string): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const exact = craftsmen.find((c) => c.name.trim() === trimmed);
    if (exact) return exact.id;
    const partial = craftsmen.find(
      (c) => c.name.trim().includes(trimmed) || trimmed.includes(c.name.trim()),
    );
    return partial?.id ?? null;
  };

  const today = new Date().toISOString().split("T")[0];
  const payload = rows
    .filter((r) => r.name.trim())
    .map((r) => {
      const chosen = r.accountItem?.trim();
      const suggested = suggestAccountItem(r.name || r.workType, past);
      return {
        company_id: companyId,
        construction_id: constructionId,
        craftsman_id: matchId(r.name),
        title: `${construction.title} ${r.name.trim()}`,
        amount: Math.max(0, Math.round(r.amount)),
        status: "draft" as const,
        order_date: today,
        start_date: construction.start_date,
        end_date: construction.end_date,
        payment_count: "1回",
        work_content: r.workType?.trim() || null,
        account_item: chosen || suggested.item,
        account_item_source: chosen ? "budget" : suggested.source,
        payment_schedule: buildPaymentSchedule(
          Math.max(0, Math.round(r.amount)),
          "1回",
          construction.start_date,
          construction.end_date,
        ),
      };
    });
  if (payload.length === 0) throw new Error("業者名が入力された行を選択してください");

  let { data, error } = await supabase
    .from("contractor_orders")
    .insert(payload)
    .select(ORDER_SELECT);
  if (error && /account_item/i.test(error.message)) {
    const fallback = payload.map((row) => {
      const { account_item, account_item_source, ...rest } = row;
      void account_item;
      void account_item_source;
      return rest;
    });
    ({ data, error } = await supabase.from("contractor_orders").insert(fallback).select(ORDER_SELECT));
  }
  if (error) throw new Error(error.message);
  const { ensurePartnerTokenForOrder } = await import("@/lib/actions/partner-portal");
  await Promise.all(
    (data ?? []).map((order) =>
      ensurePartnerTokenForOrder({
        companyId,
        constructionId,
        orderId: order.id,
        label: order.title,
      }).catch(() => {}),
    ),
  );
  return (data ?? []) as ContractorOrder[];
}
