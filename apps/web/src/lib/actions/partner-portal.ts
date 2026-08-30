"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";

export type PartnerPortalOrder = {
  token: string;
  label: string;
  accepted: boolean;
  acceptedAt: string | null;
  constructionTitle: string;
  startDate: string | null;
  endDate: string | null;
  orderTitle: string;
  amount: number;
  workContent: string | null;
  craftsmanName: string | null;
  orderDate: string | null;
  specialNotes: string | null;
};

export async function getPartnerPortalOrder(token: string): Promise<PartnerPortalOrder | null> {
  const raw = token.trim();
  if (!raw) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lookup_partner_access_token", { p_token: raw });
  const row = Array.isArray(data) ? data[0] : data;
  if (!error && row) {
    return {
      token: row.token,
      label: row.label,
      accepted: Boolean(row.accepted_at) || String(row.label ?? "").startsWith("[accepted]"),
      acceptedAt: row.accepted_at ?? null,
      constructionTitle: row.construction_title ?? row.label,
      startDate: row.start_date ?? null,
      endDate: row.end_date ?? null,
      orderTitle: row.order_title ?? "発注書",
      amount: Number(row.amount ?? 0),
      workContent: row.work_content ?? null,
      craftsmanName: row.craftsman_name ?? null,
      orderDate: row.order_date ?? null,
      specialNotes: row.special_notes ?? null,
    };
  }

  try {
    const admin = createAdminClient();
    const { data: access } = await admin
      .from("partner_access_tokens")
      .select("token, label, construction_id, contractor_order_id, expires_at")
      .eq("token", raw)
      .maybeSingle();
    if (!access) return null;
    if (access.expires_at && new Date(access.expires_at) < new Date()) return null;
    const { data: acceptedRow } = await admin
      .from("partner_access_tokens")
      .select("accepted_at")
      .eq("token", raw)
      .maybeSingle();
    const acceptedAt = (acceptedRow as { accepted_at?: string | null } | null)?.accepted_at;

    const [{ data: construction }, { data: order }] = await Promise.all([
      access.construction_id
        ? admin.from("constructions").select("title, start_date, end_date").eq("id", access.construction_id).maybeSingle()
        : Promise.resolve({ data: null }),
      access.contractor_order_id
        ? admin
            .from("contractor_orders")
            .select("title, amount, work_content, order_date, special_notes, craftsman:craftsmen(name, company_name)")
            .eq("id", access.contractor_order_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const craftsman = order && "craftsman" in order
      ? (Array.isArray(order.craftsman) ? order.craftsman[0] : order.craftsman)
      : null;
    const company = craftsman && "company_name" in craftsman ? (craftsman as { company_name?: string | null }).company_name : null;
    return {
      token: access.token,
      label: access.label,
      accepted: Boolean(acceptedAt) || String(access.label ?? "").startsWith("[accepted]"),
      acceptedAt: acceptedAt ?? null,
      constructionTitle: construction?.title ?? access.label,
      startDate: construction?.start_date ?? null,
      endDate: construction?.end_date ?? null,
      orderTitle: order?.title ?? "発注書",
      amount: Number(order?.amount ?? 0),
      workContent: order?.work_content ?? null,
      craftsmanName: (company && company !== craftsman?.name) ? `${company}（${craftsman?.name}）` : (craftsman?.name ?? null),
      orderDate: order && "order_date" in order ? (order.order_date as string | null) : null,
      specialNotes: order && "special_notes" in order ? (order.special_notes as string | null) : null,
    };
  } catch {
    return null;
  }
}

export async function acceptPartnerOrder(token: string): Promise<ActionResult<{ accepted: true }>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("accept_partner_order_by_token", { p_token: token.trim() });
    if (!error && data === true) {
      try {
        const admin = createAdminClient();
        const { data: access } = await admin
          .from("partner_access_tokens")
          .select("contractor_order_id")
          .eq("token", token.trim())
          .maybeSingle();
        if (access?.contractor_order_id) {
          await admin
            .from("contractor_orders")
            .update({
              concluded_at: new Date().toISOString(),
              ledger_status: "ordered",
            })
            .eq("id", access.contractor_order_id);
        }
      } catch { /* 受領自体は成功扱い */ }
      return actionOk({ accepted: true as const });
    }

    const admin = createAdminClient();
    const { data: access } = await admin
      .from("partner_access_tokens")
      .select("id")
      .eq("token", token.trim())
      .maybeSingle();
    if (!access?.id) {
      return actionFail("発注書が見つかりません", "発注書が見つかりません");
    }
    const { error: updErr } = await admin
      .from("partner_access_tokens")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", access.id);
    if (updErr) {
      const { data: tok } = await admin
        .from("partner_access_tokens")
        .select("label")
        .eq("id", access.id)
        .maybeSingle();
      const label = tok?.label ?? "";
      if (!label.startsWith("[accepted]")) {
        await admin
          .from("partner_access_tokens")
          .update({ label: `[accepted] ${label}` })
          .eq("id", access.id);
      }
    }
    const { data: tokenRow } = await admin
      .from("partner_access_tokens")
      .select("contractor_order_id")
      .eq("id", access.id)
      .maybeSingle();
    if (tokenRow?.contractor_order_id) {
      await admin
        .from("contractor_orders")
        .update({
          concluded_at: new Date().toISOString(),
          ledger_status: "ordered",
        })
        .eq("id", tokenRow.contractor_order_id);
    }
    return actionOk({ accepted: true as const });
  } catch (e) {
    return actionFail(e, "受領に失敗しました");
  }
}

/** 社内向け: 発注書の協力業者URLを発行または取得 */
export async function getOrCreatePartnerOrderLink(orderId: string): Promise<ActionResult<{ url: string }>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return actionFail("認証が必要です", "認証が必要です");

    const { data: order } = await supabase
      .from("contractor_orders")
      .select("id, company_id, construction_id, title")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) return actionFail("発注書が見つかりません", "発注書が見つかりません");

    const { data: existing } = await supabase
      .from("partner_access_tokens")
      .select("token")
      .eq("contractor_order_id", orderId)
      .maybeSingle();

    const token = existing?.token ?? crypto.randomUUID().replace(/-/g, "");
    if (!existing) {
      const { error } = await supabase.from("partner_access_tokens").insert({
        company_id: order.company_id,
        token,
        label: order.title,
        construction_id: order.construction_id,
        contractor_order_id: order.id,
      });
      if (error) return actionFail(error.message, "URLの発行に失敗しました");
    }

    return actionOk({ url: `/partner/${token}` });
  } catch (e) {
    return actionFail(e, "URLの発行に失敗しました");
  }
}

export async function ensurePartnerTokenForOrder(input: {
  companyId: string;
  constructionId: string;
  orderId: string;
  label: string;
}): Promise<void> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("partner_access_tokens")
    .select("id")
    .eq("contractor_order_id", input.orderId)
    .maybeSingle();
  if (existing) return;
  await supabase.from("partner_access_tokens").insert({
    company_id: input.companyId,
    token: crypto.randomUUID().replace(/-/g, ""),
    label: input.label,
    construction_id: input.constructionId,
    contractor_order_id: input.orderId,
  });
}
