"use server";

import { createClient } from "@/lib/supabase/server";
import { getCompany } from "@/lib/actions/profiles";
import { getCloudSignConfig, sendToCloudSign } from "@/lib/integrations/cloudsign";
import type { ChangeOrder } from "@/lib/database.types";

export async function getChangeOrders(constructionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("change_orders")
    .select("*, creator:profiles!change_orders_created_by_fkey(id, display_name)")
    .eq("construction_id", constructionId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createChangeOrder(input: {
  construction_id: string;
  title: string;
  before_amount: number;
  after_amount: number;
  before_items?: unknown[];
  after_items?: unknown[];
  change_reason?: string;
  estimate_id?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const diff = input.after_amount - input.before_amount;

  const { data, error } = await supabase
    .from("change_orders")
    .insert({
      company_id: profile.company_id,
      construction_id: input.construction_id,
      estimate_id: input.estimate_id ?? null,
      title: input.title,
      before_amount: input.before_amount,
      after_amount: input.after_amount,
      diff_amount: diff,
      before_items: input.before_items ?? [],
      after_items: input.after_items ?? [],
      change_reason: input.change_reason ?? null,
      created_by: user.id,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ChangeOrder;
}

export async function updateChangeOrderStatus(
  id: string,
  status: ChangeOrder["status"],
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("change_orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as ChangeOrder;
}

export async function sendChangeOrderToCloudSign(
  changeOrderId: string,
  signers: Array<{ name: string; email: string }>,
) {
  const supabase = await createClient();
  const company = await getCompany();
  const config = getCloudSignConfig(company.settings as Record<string, unknown>);

  const { data: co, error } = await supabase
    .from("change_orders")
    .select("*")
    .eq("id", changeOrderId)
    .single();
  if (error || !co) throw new Error("追加変更が見つかりません");

  const result = await sendToCloudSign(config, {
    title: `追加変更確認書: ${co.title}`,
    signers: signers.map((s, i) => ({ ...s, order: i + 1 })),
    metadata: { change_order_id: co.id, construction_id: co.construction_id },
  });

  const { data: updated, error: updateError } = await supabase
    .from("change_orders")
    .update({
      cloudsign_document_id: result.document_id,
      cloudsign_status: result.status,
      status: result.status === "sent" ? "sent" : co.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", changeOrderId)
    .select()
    .single();
  if (updateError) throw updateError;

  return { changeOrder: updated as ChangeOrder, message: result.message };
}

/** 承認申請（No.14）: 承認者を選択して申請 → status=pending + 承認者へ通知 */
export async function submitChangeOrderApproval(input: {
  changeOrderId: string;
  approverId: string;
  comment: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase
    .from("profiles").select("company_id, display_name").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const { data: co, error } = await supabase
    .from("change_orders")
    .select("id, title, construction_id, diff_amount, status")
    .eq("id", input.changeOrderId)
    .single();
  if (error || !co) throw new Error("追加変更が見つかりません");
  if (co.status !== "draft" && co.status !== "rejected") {
    throw new Error("下書きまたは差戻しの追加変更のみ申請できます");
  }

  const now = new Date().toISOString();
  const fullPatch = {
    status: "pending",
    submitted_to: input.approverId,
    submitted_comment: input.comment,
    submitted_at: now,
    updated_at: now,
  };
  const { error: updateErr } = await supabase
    .from("change_orders").update(fullPatch).eq("id", co.id);
  if (updateErr) {
    // 承認関連カラム未追加（migration 00056 未適用）の環境ではステータスのみ更新
    const { error: fallbackErr } = await supabase
      .from("change_orders")
      .update({ status: "pending", change_reason: input.comment, updated_at: now })
      .eq("id", co.id);
    if (fallbackErr) throw fallbackErr;
  }

  // 承認者へ通知（お知らせ + ToDo）
  try {
    const { notifySalesFlowUser } = await import("@/lib/actions/sales-flow");
    await notifySalesFlowUser(supabase, profile.company_id, input.approverId, {
      title: `追加変更工事の承認依頼: ${co.title}`,
      description: `${profile.display_name ?? "担当者"}から承認申請が届いています。差額 ${co.diff_amount >= 0 ? "+" : ""}¥${Number(co.diff_amount).toLocaleString()}\n申請コメント: ${input.comment}`,
      href: `/constructions/${co.construction_id}?tab=change`,
      urgent: true,
    }, user.id);
  } catch (e) {
    console.error("[submitChangeOrderApproval] notify failed", e);
  }

  return { ok: true };
}

/** 差戻し（No.14）: status=rejected + 申請者へ通知 */
export async function rejectChangeOrder(id: string, reason?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: co, error } = await supabase
    .from("change_orders")
    .select("id, title, construction_id, company_id, created_by")
    .eq("id", id)
    .single();
  if (error || !co) throw new Error("追加変更が見つかりません");

  const { error: updateErr } = await supabase
    .from("change_orders")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (updateErr) throw updateErr;

  if (co.created_by && co.created_by !== user.id) {
    try {
      const { notifySalesFlowUser } = await import("@/lib/actions/sales-flow");
      await notifySalesFlowUser(supabase, co.company_id, co.created_by, {
        title: `追加変更工事が差戻されました: ${co.title}`,
        description: reason ? `差戻し理由: ${reason}` : "内容を修正して再申請してください",
        href: `/constructions/${co.construction_id}?tab=change`,
        urgent: true,
      }, user.id);
    } catch (e) {
      console.error("[rejectChangeOrder] notify failed", e);
    }
  }
  return { ok: true };
}

export async function approveChangeOrder(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: co, error } = await supabase
    .from("change_orders")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !co) throw new Error("追加変更が見つかりません");

  const now = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from("change_orders")
    .update({ status: "approved", approved_by: user.id, approved_at: now, updated_at: now })
    .eq("id", id);
  if (updateErr) {
    // 承認関連カラム未追加の環境ではステータスのみ更新
    const { error: fallbackErr } = await supabase
      .from("change_orders")
      .update({ status: "approved", updated_at: now })
      .eq("id", id);
    if (fallbackErr) throw fallbackErr;
  }

  await supabase
    .from("constructions")
    .update({ order_amount: co.after_amount, updated_at: new Date().toISOString() })
    .eq("id", co.construction_id);

  const { data: construction } = await supabase
    .from("constructions")
    .select("contract_id")
    .eq("id", co.construction_id)
    .single();

  if (construction?.contract_id) {
    await supabase
      .from("contracts")
      .update({ amount: co.after_amount, updated_at: new Date().toISOString() })
      .eq("id", construction.contract_id);
  }

  // 申請者へ承認完了を通知
  if (co.created_by && co.created_by !== user.id) {
    try {
      const { notifySalesFlowUser } = await import("@/lib/actions/sales-flow");
      await notifySalesFlowUser(supabase, co.company_id, co.created_by, {
        title: `追加変更工事が承認されました: ${co.title}`,
        description: `契約金額を ¥${Number(co.after_amount).toLocaleString()} に更新しました`,
        href: `/constructions/${co.construction_id}?tab=change`,
      }, user.id);
    } catch (e) {
      console.error("[approveChangeOrder] notify failed", e);
    }
  }

  return co as ChangeOrder;
}

export async function deleteChangeOrder(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("change_orders").delete().eq("id", id);
  if (error) throw error;
}
