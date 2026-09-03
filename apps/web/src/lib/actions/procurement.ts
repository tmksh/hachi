"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { getCompanyLocations } from "@/lib/actions/bi";
import { uploadToStorage, uploadToStorageAsAdmin, getSignedStorageUrlAsAdmin } from "@/lib/storage-server";
import { getPublicAppOrigin } from "@/lib/public-app-origin";
import type { ContractorOrder } from "@/lib/database.types";
import {
  PROCUREMENT_ACCOUNT_ITEMS,
  addDaysIso,
  isPaperInvoice,
  parseTransferSender,
  todayIso,
} from "@/lib/procurement";
import type { TransferSender } from "@/lib/procurement";
import { canAccessFeature, mergeRolePermissions, type RolePermissions } from "@/lib/role-permissions";
import {
  generateInvoiceAuthCode,
  isInvoiceAuthVerified,
  markInvoiceAuthVerified,
  maskEmail,
  setInvoiceAuthChallenge,
  verifyInvoiceAuthChallenge,
} from "@/lib/vendor-invoice-auth";

export type ProcurementAttachment = {
  path: string;
  name: string;
  contentType?: string;
  size?: number;
};

const ORDER_SELECT = `
  *,
  craftsman:craftsmen(*),
  construction:constructions(id, title, construction_no)
`;

export type ProcurementOrder = ContractorOrder & {
  construction?: { id: string; title: string; construction_no: string } | null;
};

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, display_name, role")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("Profile not found");
  return {
    supabase,
    user,
    companyId: profile.company_id as string,
    displayName: profile.display_name as string | null,
    role: profile.role as string,
  };
}

const DELIVERY_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function safeFileName(name: string): string {
  return name.replace(/[^\w.\-()\u3000-\u9fff]/g, "_").slice(0, 80) || "file";
}

async function resolveAppOrigin(): Promise<string> {
  const pub = getPublicAppOrigin();
  if (pub) return pub;
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
    if (host) return `${proto}://${host}`;
  } catch {
    /* ignore */
  }
  return (process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

async function sendVendorInvoiceRequestEmail(input: {
  userId: string;
  to: string | null | undefined;
  vendorName: string;
  companyName: string;
  poNo: string;
  invoicePath?: string;
  expiresYmd?: string;
  mode?: "url" | "paper";
}): Promise<{ sent: boolean; to?: string; error?: string }> {
  const to = input.to?.trim();
  if (!to) return { sent: false, error: "業者マスタにメールアドレスがありません" };

  const paper = input.mode === "paper";
  const origin = await resolveAppOrigin();
  const url = !paper && input.invoicePath
    ? `${origin}${input.invoicePath.startsWith("/") ? "" : "/"}${input.invoicePath}`
    : "";
  const subject = paper
    ? `[BRIDGE Linq] 検収完了 — ${input.poNo} 請求書（紙／PDF）をご送付ください`
    : `[BRIDGE Linq] 検収完了 — ${input.poNo} 請求書をご送付ください`;
  const text = paper
    ? [
        `${input.vendorName} 御中`,
        "",
        `${input.companyName} です。検収が完了しました。`,
        "紙の請求書、またはPDFを発注元へご送付ください（ログイン用の画面はございません）。",
        "",
        `発注番号: ${input.poNo}`,
        "",
        "本メールに心当たりがない場合は破棄してください。",
      ].join("\n")
    : [
        `${input.vendorName} 御中`,
        "",
        `${input.companyName} です。検収が完了しました。`,
        "下記URLから請求書をご送付ください（メール認証・ログイン不要）。",
        "",
        url,
        "",
        `有効期限: ${input.expiresYmd}（30日）`,
        "",
        "本メールに心当たりがない場合は破棄してください。",
      ].join("\n");
  const html = paper
    ? `<div style="font-family:sans-serif;font-size:14px;line-height:1.7;color:#111827">
<p>${input.vendorName} 御中</p>
<p>${input.companyName} です。検収が完了しました。<br/>紙の請求書、またはPDFを発注元へご送付ください（ログイン用の画面はございません）。</p>
<p>発注番号: ${input.poNo}</p>
</div>`
    : `<div style="font-family:sans-serif;font-size:14px;line-height:1.7;color:#111827">
<p>${input.vendorName} 御中</p>
<p>${input.companyName} です。検収が完了しました。<br/>下記ボタンから請求書をご送付ください（メール認証・ログイン不要）。</p>
<p style="margin:24px 0"><a href="${url}" style="background:#047857;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">請求書を送る</a></p>
<p style="font-size:12px;color:#64748b;word-break:break-all">${url}</p>
<p style="font-size:12px;color:#64748b">有効期限: ${input.expiresYmd}（30日）</p>
</div>`;

  if (process.env.RESEND_API_KEY) {
    try {
      const { getResend, CUSTOMER_FROM_EMAIL } = await import("@/lib/resend");
      const { error } = await getResend().emails.send({
        from: CUSTOMER_FROM_EMAIL,
        to,
        subject,
        html,
        text,
      });
      if (!error) return { sent: true, to };
      console.error("[procurement] resend failed", error);
    } catch (e) {
      console.error("[procurement] resend threw", e);
    }
  }

  try {
    const { sendViaGmailAccount } = await import("@/lib/gmail-send");
    await sendViaGmailAccount({
      userId: input.userId,
      to: [{ name: input.vendorName, address: to }],
      subject,
      bodyText: text,
      bodyHtml: html,
    });
    return { sent: true, to };
  } catch (e) {
    return {
      sent: false,
      to,
      error: e instanceof Error ? e.message : "メール送信に失敗しました",
    };
  }
}

async function notifyVendorInvoiceUrl(
  order: ProcurementOrder,
  invoicePath: string,
  expiresYmd: string,
  userId: string,
): Promise<{ sent: boolean; to?: string; error?: string }> {
  const { supabase } = await getAuthContext();
  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", order.company_id)
    .maybeSingle();
  return sendVendorInvoiceRequestEmail({
    userId,
    to: order.craftsman?.email,
    vendorName: order.craftsman?.name ?? "業者",
    companyName: company?.name ?? "発注元",
    poNo: order.po_no ?? order.id.slice(0, 8),
    invoicePath,
    expiresYmd,
    mode: "url",
  });
}

async function notifyVendorPaperInvoice(
  order: ProcurementOrder,
  userId: string,
): Promise<{ sent: boolean; to?: string; error?: string }> {
  const { supabase } = await getAuthContext();
  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", order.company_id)
    .maybeSingle();
  return sendVendorInvoiceRequestEmail({
    userId,
    to: order.craftsman?.email,
    vendorName: order.craftsman?.name ?? "業者",
    companyName: company?.name ?? "発注元",
    poNo: order.po_no ?? order.id.slice(0, 8),
    mode: "paper",
  });
}

export async function nextPoNo(companyId?: string): Promise<string> {
  const { supabase, companyId: cid } = companyId
    ? { supabase: await createClient(), companyId }
    : await getAuthContext();
  const { data } = await supabase
    .from("contractor_orders")
    .select("po_no")
    .eq("company_id", cid)
    .not("po_no", "is", null)
    .limit(500);
  if (!data) return "PO-0001";
  let max = 0;
  for (const row of data ?? []) {
    const m = String(row.po_no ?? "").match(/PO-(\d+)/i);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `PO-${String(max + 1).padStart(4, "0")}`;
}

export async function getProcurementMasters(): Promise<{
  departments: string[];
  accountItems: string[];
  sender: TransferSender;
}> {
  const { supabase, companyId } = await getAuthContext();
  const [locations, { data: company }] = await Promise.all([
    getCompanyLocations().catch(() => []),
    supabase.from("companies").select("name, settings").eq("id", companyId).maybeSingle(),
  ]);
  const settings = (company?.settings ?? {}) as Record<string, unknown>;
  return {
    departments: locations.map((l) => l.name),
    accountItems: PROCUREMENT_ACCOUNT_ITEMS.map((i) => i.name),
    sender: parseTransferSender(settings, company?.name ?? ""),
  };
}

export type AccountItemHistory = {
  vendorName: string | null;
  companyName: string | null;
  accountItem: string | null;
  accountItemSource: string | null;
};

/** 経理確定の発注と、実行予算で入力した科目を学習用に返す */
export async function listAccountItemHistory(): Promise<AccountItemHistory[]> {
  const { supabase, companyId } = await getAuthContext();
  const past: AccountItemHistory[] = [];

  const { data: orders } = await supabase
    .from("contractor_orders")
    .select("account_item, account_item_source, craftsman:craftsmen(name, company_name)")
    .eq("company_id", companyId)
    .not("account_item", "is", null)
    .limit(400);
  for (const o of orders ?? []) {
    if (o.account_item_source === "ai" || o.account_item_source === "learned") continue;
    const craftsman = Array.isArray(o.craftsman) ? o.craftsman[0] : o.craftsman;
    past.push({
      vendorName: craftsman?.name ?? null,
      companyName: craftsman?.company_name ?? null,
      accountItem: o.account_item,
      accountItemSource: o.account_item_source,
    });
  }

  const { data: budgets } = await supabase
    .from("construction_cost_budgets")
    .select("rows")
    .eq("company_id", companyId)
    .limit(80);
  for (const budget of budgets ?? []) {
    const rows = Array.isArray(budget.rows) ? budget.rows : [];
    for (const raw of rows) {
      const row = raw as { name?: string; account_item?: string; account_item_source?: string };
      if (!row.account_item?.trim() || !row.name?.trim()) continue;
      if (row.account_item_source === "ai" || row.account_item_source === "learned") continue;
      past.push({
        vendorName: row.name.trim(),
        companyName: null,
        accountItem: row.account_item.trim(),
        accountItemSource: row.account_item_source || "budget",
      });
    }
  }
  return past;
}

export async function getCompanyOrders(): Promise<ProcurementOrder[]> {
  const { supabase, companyId } = await getAuthContext();
  const { data, error } = await supabase
    .from("contractor_orders")
    .select(ORDER_SELECT)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) {
    const { data: fallback, error: fallbackErr } = await supabase
      .from("contractor_orders")
      .select("*, craftsman:craftsmen(id, name, company_name, email, kind, invoice_channel), construction:constructions(id, title, construction_no)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (fallbackErr) throw new Error(error.message);
    return (fallback ?? []) as ProcurementOrder[];
  }
  return (data ?? []) as ProcurementOrder[];
}

export async function updateOrderProcurement(
  orderId: string,
  patch: Record<string, unknown>,
): Promise<ProcurementOrder> {
  const { supabase, companyId } = await getAuthContext();
  const { data, error } = await supabase
    .from("contractor_orders")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("company_id", companyId)
    .select(ORDER_SELECT)
    .single();
  if (error) {
    const { data: fallback, error: fallbackErr } = await supabase
      .from("contractor_orders")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", orderId)
      .eq("company_id", companyId)
      .select("*, craftsman:craftsmen(id, name, company_name, email, kind, invoice_channel), construction:constructions(id, title, construction_no)")
      .single();
    if (fallbackErr) {
      throw new Error(
        /schema cache|column/i.test(error.message)
          ? "納品・検収用の列が未作成です。マイグレーション 00076_sheet9_procurement_ledger.sql を適用してください。"
          : error.message,
      );
    }
    return fallback as ProcurementOrder;
  }
  return data as ProcurementOrder;
}

export async function uploadDeliveryAttachments(
  orderId: string,
  formData: FormData,
): Promise<ActionResult<{ files: ProcurementAttachment[] }>> {
  try {
    const { companyId } = await getAuthContext();
    const incoming = formData.getAll("files").filter((v): v is File => v instanceof File);
    if (incoming.length === 0) return actionOk({ files: [] });
    if (incoming.length > 5) return actionFail("添付は5ファイルまでです", "添付は5ファイルまでです");

    const files: ProcurementAttachment[] = [];
    for (const file of incoming) {
      if (file.size > 10 * 1024 * 1024) {
        return actionFail(`${file.name} は10MBを超えています`, "ファイルサイズが大きすぎます");
      }
      const type = file.type || "application/octet-stream";
      if (!DELIVERY_MIME.has(type) && !file.name.toLowerCase().endsWith(".pdf")) {
        return actionFail(`${file.name} はPDFまたは画像のみ添付できます`, "添付できる形式ではありません");
      }
      const path = `procurement/${companyId}/${orderId}/delivery/${Date.now()}-${safeFileName(file.name)}`;
      await uploadToStorage("documents", path, file, { contentType: type, upsert: false });
      files.push({ path, name: file.name, contentType: type, size: file.size });
    }
    return actionOk({ files });
  } catch (e) {
    return actionFail(e, "添付のアップロードに失敗しました");
  }
}

export async function attachStaffInvoicePdf(
  orderId: string,
  formData: FormData,
): Promise<ActionResult<{ order: ProcurementOrder }>> {
  try {
    const { supabase, companyId } = await getAuthContext();
    const { data: current } = await supabase
      .from("contractor_orders")
      .select("id, ledger_status, vendor_invoice_submitted_at")
      .eq("id", orderId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!current) return actionFail("発注が見つかりません", "発注が見つかりません");
    if (current.ledger_status !== "inspected") {
      return actionFail("検収完了（請求待ち）の行だけ添付できます", "検収完了（請求待ち）の行だけ添付できます");
    }
    if (current.vendor_invoice_submitted_at) {
      return actionFail("すでに請求書を受領しています", "すでに請求書を受領しています");
    }

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return actionFail("PDFまたは画像を選んでください", "PDFまたは画像を選んでください");
    }
    if (file.size > 10 * 1024 * 1024) {
      return actionFail("ファイルは10MBまでです", "ファイルは10MBまでです");
    }
    const name = file.name.toLowerCase();
    const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
    const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|heic|heif)$/.test(name);
    if (!isPdf && !isImage) {
      return actionFail("PDFまたは画像を添付してください", "PDFまたは画像を添付してください");
    }

    const path = `procurement/${companyId}/${orderId}/vendor-invoice/${Date.now()}-${safeFileName(file.name)}`;
    await uploadToStorage("documents", path, file, {
      contentType: file.type || (isPdf ? "application/pdf" : "application/octet-stream"),
      upsert: false,
    });

    const invoiceDate = String(formData.get("invoiceDate") ?? "").trim();
    const invoiceNo = String(formData.get("invoiceNo") ?? "").trim();
    const rawAmount = String(formData.get("invoiceAmount") ?? "").trim();
    const invoiceAmount = rawAmount === "" ? null : Number(rawAmount);
    const patch: Record<string, unknown> = {
      vendor_invoice_pdf_path: path,
      vendor_invoice_date: invoiceDate || todayIso(),
      vendor_invoice_no: invoiceNo || null,
      vendor_invoice_submitted_at: new Date().toISOString(),
      ledger_status: "invoice_received",
    };
    if (invoiceAmount != null && Number.isFinite(invoiceAmount)) {
      patch.vendor_invoice_amount = invoiceAmount;
    }
    let order: ProcurementOrder;
    try {
      order = await updateOrderProcurement(orderId, patch);
    } catch (e) {
      if (invoiceAmount != null && /vendor_invoice_amount/i.test(e instanceof Error ? e.message : "")) {
        delete patch.vendor_invoice_amount;
        order = await updateOrderProcurement(orderId, patch);
      } else {
        throw e;
      }
    }
    return actionOk({ order });
  } catch (e) {
    return actionFail(e, "PDFの添付に失敗しました");
  }
}

export async function getProcurementFileUrl(path: string): Promise<ActionResult<{ url: string }>> {
  try {
    await getAuthContext();
    if (!path.startsWith("procurement/")) {
      return actionFail("不正なパスです", "不正なパスです");
    }
    const url = await getSignedStorageUrlAsAdmin("documents", path, 3600);
    return actionOk({ url });
  } catch (e) {
    return actionFail(e, "ファイルURLの取得に失敗しました");
  }
}

export async function registerDelivery(input: {
  orderId: string;
  deliveryDate: string;
  content: string;
  partial: string;
  attachments?: ProcurementAttachment[];
  lotAmount?: number | null;
}): Promise<ActionResult<{ order: ProcurementOrder; remainingOrder?: ProcurementOrder }>> {
  try {
    const { supabase, companyId } = await getAuthContext();
    const { data: before } = await supabase
      .from("contractor_orders")
      .select("id, amount, parent_order_id, lot_no, company_id, concluded_at")
      .eq("id", input.orderId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!before) return actionFail("発注が見つかりません", "発注が見つかりません");
    if (!before.concluded_at) {
      return actionFail("請書の受領後に納品できます", "請書の受領後に納品できます");
    }

    const originalAmount = Number(before.amount ?? 0);
    const lotAmount = input.lotAmount != null && Number.isFinite(input.lotAmount) ? Number(input.lotAmount) : null;
    if (input.partial === "partial") {
      if (lotAmount == null || lotAmount <= 0) {
        return actionFail("分納の金額を入力してください", "分納の金額を入力してください");
      }
      if (lotAmount >= originalAmount) {
        return actionFail("分納の金額は発注額未満にしてください", "分納の金額は発注額未満にしてください");
      }
    }
    const patch: Record<string, unknown> = {
      delivery_date: input.deliveryDate || todayIso(),
      delivery_content: input.content.trim() || null,
      delivery_partial: input.partial || "none",
      ledger_status: "delivered",
    };
    if (input.attachments && input.attachments.length > 0) {
      patch.delivery_attachments = input.attachments;
    }
    if (input.partial === "partial" && lotAmount != null) {
      patch.amount = lotAmount;
    }

    const order = await updateOrderProcurement(input.orderId, patch);
    let remainingOrder: ProcurementOrder | undefined;
    if (input.partial === "partial") {
      remainingOrder = await createRemainingLot(order, {
        originalAmount,
        lotAmount,
        rootId: before.parent_order_id ?? before.id,
      });
    }
    return actionOk({ order, remainingOrder });
  } catch (e) {
    return actionFail(e, "納品の登録に失敗しました");
  }
}

async function createRemainingLot(
  order: ProcurementOrder,
  opts: { originalAmount: number; lotAmount: number | null; rootId: string },
): Promise<ProcurementOrder | undefined> {
  const { supabase, companyId } = await getAuthContext();
  const { data: siblings } = await supabase
    .from("contractor_orders")
    .select("lot_no")
    .eq("company_id", companyId)
    .or(`id.eq.${opts.rootId},parent_order_id.eq.${opts.rootId}`);
  const nextLot = Math.max(1, ...(siblings ?? []).map((s) => Number(s.lot_no ?? 1))) + 1;
  const remainingAmount = opts.lotAmount != null
    ? Math.max(0, opts.originalAmount - opts.lotAmount)
    : 0;
  if (remainingAmount <= 0) return undefined;

  const payload: Record<string, unknown> = {
    company_id: order.company_id,
    construction_id: order.construction_id,
    craftsman_id: order.craftsman_id,
    title: /分納残/.test(order.title) ? order.title : `${order.title}（分納残）`,
    amount: remainingAmount,
    status: "approved",
    approved_by: order.approved_by,
    approved_at: order.approved_at,
    notes: order.notes,
    order_date: order.order_date,
    start_date: order.start_date,
    end_date: order.end_date,
    completion_date: order.completion_date,
    payment_date: order.payment_date,
    payment_count: order.payment_count,
    work_content: order.work_content,
    special_notes: order.special_notes,
    payment_schedule: order.payment_schedule,
    po_no: order.po_no,
    department: order.department,
    account_item: order.account_item,
    account_item_source: order.account_item_source,
    ledger_status: "ordered",
    parent_order_id: opts.rootId,
    lot_no: nextLot,
    concluded_at: order.concluded_at ?? new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("contractor_orders")
    .insert(payload)
    .select(ORDER_SELECT)
    .single();
  if (error) {
    const { parent_order_id: _p, lot_no: _l, ...fallbackPayload } = payload;
    void _p;
    void _l;
    const retry = await supabase
      .from("contractor_orders")
      .insert(fallbackPayload)
      .select(ORDER_SELECT)
      .single();
    if (retry.error) throw new Error(retry.error.message);
    return retry.data as ProcurementOrder;
  }
  return data as ProcurementOrder;
}

export async function completeInspection(input: {
  orderId: string;
  result: "pass" | "reject";
  inspectionDate: string;
  comment: string;
  sendEmail: boolean;
}): Promise<ActionResult<{
  order: ProcurementOrder;
  invoiceUrl?: string;
  emailSent?: boolean;
  emailTo?: string;
  emailError?: string;
}>> {
  try {
    const { displayName, user } = await getAuthContext();
    if (input.result === "reject") {
      const order = await updateOrderProcurement(input.orderId, {
        inspection_result: "reject",
        inspection_date: input.inspectionDate || todayIso(),
        inspection_comment: input.comment.trim() || null,
        inspector_name: displayName,
        ledger_status: "ordered",
        delivery_date: null,
        delivery_content: null,
        delivery_attachments: [],
      });
      return actionOk({ order });
    }

    const token = crypto.randomUUID().replace(/-/g, "");
    const expires = addDaysIso(todayIso(), 30);
    const invoiceUrl = `/partner/invoice/${token}`;
    const order = await updateOrderProcurement(input.orderId, {
      inspection_result: "pass",
      inspection_date: input.inspectionDate || todayIso(),
      inspection_comment: input.comment.trim() || null,
      inspector_name: displayName,
      ledger_status: "inspected",
      invoice_token: token,
      invoice_token_expires_at: `${expires}T23:59:59.000Z`,
    });

    let mail: { sent: boolean; to?: string; error?: string } = { sent: false };
    if (input.sendEmail) {
      mail = isPaperInvoice(order.craftsman)
        ? await notifyVendorPaperInvoice(order, user.id)
        : await notifyVendorInvoiceUrl(order, invoiceUrl, expires, user.id);
    }
    return actionOk({
      order,
      invoiceUrl,
      emailSent: mail.sent,
      emailTo: mail.to,
      emailError: mail.error,
    });
  } catch (e) {
    return actionFail(e, "検収の更新に失敗しました");
  }
}

export async function resendInvoiceUrl(orderId: string): Promise<ActionResult<{
  url: string;
  emailSent?: boolean;
  emailTo?: string;
  emailError?: string;
}>> {
  try {
    const { supabase, companyId, user } = await getAuthContext();
    const { data: current } = await supabase
      .from("contractor_orders")
      .select("invoice_token, invoice_token_expires_at")
      .eq("id", orderId)
      .eq("company_id", companyId)
      .maybeSingle();
    const expired = current?.invoice_token_expires_at
      ? new Date(current.invoice_token_expires_at) < new Date()
      : true;
    const token = !expired && current?.invoice_token
      ? current.invoice_token
      : crypto.randomUUID().replace(/-/g, "");
    const expires = addDaysIso(todayIso(), 30);
    const order = await updateOrderProcurement(orderId, {
      invoice_token: token,
      invoice_token_expires_at: `${expires}T23:59:59.000Z`,
    });
    const url = `/partner/invoice/${token}`;
    const mail = await notifyVendorInvoiceUrl(order, url, expires, user.id);
    return actionOk({
      url,
      emailSent: mail.sent,
      emailTo: mail.to,
      emailError: mail.error,
    });
  } catch (e) {
    return actionFail(e, "URLの再発行に失敗しました");
  }
}

export async function confirmVendorInvoice(orderId: string): Promise<ProcurementOrder> {
  const { supabase, companyId } = await getAuthContext();
  const { data: current } = await supabase
    .from("contractor_orders")
    .select("ledger_status")
    .eq("id", orderId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!current) throw new Error("発注が見つかりません");
  if (current.ledger_status !== "invoice_received") {
    throw new Error("請求書受領の行だけ確認できます");
  }
  return updateOrderProcurement(orderId, {
    director_confirmed_at: new Date().toISOString(),
    ledger_status: "confirmed",
  });
}

async function assertCanApproveVendorInvoice() {
  const { supabase, companyId, role } = await getAuthContext();
  const { data: company } = await supabase
    .from("companies")
    .select("settings")
    .eq("id", companyId)
    .maybeSingle();
  const raw = (company?.settings as { role_permissions?: RolePermissions } | null)?.role_permissions;
  const perms = mergeRolePermissions(raw ?? null);
  if (!canAccessFeature("fulfillment_approve", [role], perms)) {
    throw new Error("経理承認の権限がありません。設定のロール・権限で「納品・検収の経理承認」を有効にしてください。");
  }
}

export async function approveVendorInvoice(orderId: string): Promise<ProcurementOrder> {
  await assertCanApproveVendorInvoice();
  const { supabase, companyId } = await getAuthContext();
  const { data: current } = await supabase
    .from("contractor_orders")
    .select("ledger_status, director_confirmed_at")
    .eq("id", orderId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!current) throw new Error("発注が見つかりません");
  if (current.ledger_status !== "confirmed" || !current.director_confirmed_at) {
    throw new Error("ディレクター確認のあとで経理承認できます");
  }
  return updateOrderProcurement(orderId, {
    accounting_approved_at: new Date().toISOString(),
    ledger_status: "payment_approved",
  });
}

export async function confirmAccountItems(
  items: Array<{ orderId: string; accountItem: string }>,
): Promise<ActionResult<{ updated: number }>> {
  try {
    const { supabase, companyId, user } = await getAuthContext();
    let updated = 0;
    for (const item of items) {
      const name = item.accountItem.trim();
      if (!name) continue;
      const { error } = await supabase
        .from("contractor_orders")
        .update({
          account_item: name,
          account_item_source: "accounting",
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.orderId)
        .eq("company_id", companyId);
      if (!error) updated += 1;
    }
    void user;
    return actionOk({ updated });
  } catch (e) {
    return actionFail(e, "勘定科目の確定に失敗しました");
  }
}

export async function updateOrderAccountItem(
  orderId: string,
  accountItem: string | null,
): Promise<ProcurementOrder> {
  return updateOrderProcurement(orderId, {
    account_item: accountItem?.trim() || null,
    account_item_source: "accounting",
  });
}

export type VendorInvoiceView = {
  token: string;
  expiresAt: string | null;
  expired: boolean;
  submitted: boolean;
  companyName: string;
  companyAddress: string;
  companyInvoiceNo: string;
  constructionNo: string;
  constructionTitle: string;
  orderTitle: string;
  poNo: string;
  amount: number;
  deliveryDate: string | null;
  workContent: string | null;
  vendorName: string;
  vendorAddress: string;
  vendorPhone: string;
  paymentDate: string | null;
  bankName: string;
  bankBranch: string;
  bankAccountType: string;
  bankAccountNumber: string;
  bankAccountKana: string;
  bankInfo: string;
  invoiceDate: string | null;
  invoiceNo: string | null;
  registrationNumber: string | null;
  remarks: string | null;
  vendorPdfName: string | null;
  hasVendorPdf: boolean;
  attachments: ProcurementAttachment[];
  hasEmail: boolean;
  maskedEmail: string | null;
  emailVerified: boolean;
  previewLocked: boolean;
};

function mapVendorInvoiceView(input: {
  token: string;
  order: {
    title: string;
    amount?: number | string | null;
    po_no?: string | null;
    delivery_date?: string | null;
    work_content?: string | null;
    payment_date?: string | null;
    invoice_token_expires_at?: string | null;
    vendor_invoice_submitted_at?: string | null;
    vendor_invoice_date?: string | null;
    vendor_invoice_no?: string | null;
    vendor_registration_no?: string | null;
    vendor_invoice_remarks?: string | null;
    vendor_invoice_pdf_path?: string | null;
    delivery_attachments?: unknown;
    craftsman?: unknown;
    construction?: unknown;
  };
  company: { name?: string | null; settings?: unknown } | null;
  previewLocked: boolean;
  emailVerified: boolean;
}): VendorInvoiceView {
  const issuer = companyIssuer(
    (input.company?.settings ?? null) as Record<string, unknown> | null,
    input.company?.name ?? "発注元",
  );
  const craftsman = Array.isArray(input.order.craftsman) ? input.order.craftsman[0] : input.order.craftsman as {
    name?: string | null;
    company_name?: string | null;
    phone?: string | null;
    email?: string | null;
    bank_name?: string | null;
    bank_branch?: string | null;
    bank_account_type?: string | null;
    bank_account_number?: string | null;
    bank_account_kana?: string | null;
  } | null;
  const construction = Array.isArray(input.order.construction)
    ? input.order.construction[0]
    : input.order.construction as { title?: string | null; construction_no?: string | null } | null;
  const bankName = craftsman?.bank_name ?? "";
  const bankBranch = craftsman?.bank_branch ?? "";
  const bankAccountType = craftsman?.bank_account_type ?? "";
  const bankAccountNumber = craftsman?.bank_account_number ?? "";
  const bankAccountKana = craftsman?.bank_account_kana ?? "";
  const bank = [bankName, bankBranch, bankAccountType, bankAccountNumber].filter(Boolean).join(" ");
  const expired = input.order.invoice_token_expires_at
    ? new Date(input.order.invoice_token_expires_at) < new Date()
    : false;
  const vendorEmail = (craftsman?.email ?? "").trim();
  const submitted = Boolean(input.order.vendor_invoice_submitted_at);
  const locked = input.previewLocked;
  return {
    token: input.token,
    expiresAt: input.order.invoice_token_expires_at ?? null,
    expired,
    submitted,
    companyName: issuer.name,
    companyAddress: locked ? "" : issuer.address,
    companyInvoiceNo: locked ? "" : issuer.invoiceNo,
    constructionNo: locked ? "" : construction?.construction_no ?? "",
    constructionTitle: locked ? "" : construction?.title ?? "",
    orderTitle: locked ? "" : input.order.title,
    poNo: locked ? "" : input.order.po_no ?? "",
    amount: locked ? 0 : Number(input.order.amount ?? 0),
    deliveryDate: locked ? null : input.order.delivery_date ?? null,
    workContent: locked ? null : input.order.work_content ?? null,
    vendorName: locked ? "" : craftsman?.company_name || craftsman?.name || "業者",
    vendorAddress: "",
    vendorPhone: locked ? "" : craftsman?.phone ?? "",
    paymentDate: locked ? null : input.order.payment_date ?? null,
    bankName: locked ? "" : bankName,
    bankBranch: locked ? "" : bankBranch,
    bankAccountType: locked ? "" : bankAccountType,
    bankAccountNumber: locked ? "" : bankAccountNumber,
    bankAccountKana: locked ? "" : bankAccountKana,
    bankInfo: locked
      ? ""
      : bank || "（口座情報は発注元の業者マスタに登録された内容が表示されます）",
    invoiceDate: locked ? null : input.order.vendor_invoice_date ?? null,
    invoiceNo: locked ? null : input.order.vendor_invoice_no ?? null,
    registrationNumber: locked ? null : input.order.vendor_registration_no ?? null,
    remarks: locked ? null : input.order.vendor_invoice_remarks ?? null,
    vendorPdfName: locked
      ? null
      : input.order.vendor_invoice_pdf_path
        ? String(input.order.vendor_invoice_pdf_path).split("/").pop() ?? "請求書.pdf"
        : null,
    hasVendorPdf: locked ? false : Boolean(input.order.vendor_invoice_pdf_path),
    attachments: locked
      ? []
      : Array.isArray(input.order.delivery_attachments)
        ? input.order.delivery_attachments as ProcurementAttachment[]
        : [],
    hasEmail: Boolean(vendorEmail),
    maskedEmail: vendorEmail ? maskEmail(vendorEmail) : null,
    emailVerified: input.emailVerified,
    previewLocked: locked,
  };
}

function companyIssuer(settings: Record<string, unknown> | null, fallbackName: string) {
  const pdf = (settings?.pdf ?? settings?.pdfTemplates ?? {}) as Record<string, unknown>;
  const invoice = (pdf?.invoice ?? pdf) as Record<string, unknown>;
  return {
    name: String(invoice?.issuerName ?? settings?.issuerName ?? fallbackName),
    address: String(invoice?.issuerAddress ?? settings?.address ?? ""),
    invoiceNo: String(invoice?.issuerInvoiceNo ?? ""),
  };
}

export async function getVendorInvoiceByToken(token: string): Promise<VendorInvoiceView | null> {
  const raw = token.trim();
  if (!raw) return null;
  try {
    const admin = createAdminClient();
    const { data: order } = await admin
      .from("contractor_orders")
      .select(`
        *,
        craftsman:craftsmen(name, company_name, phone, email, bank_name, bank_branch, bank_account_type, bank_account_number, bank_account_kana),
        construction:constructions(title, construction_no, company_id)
      `)
      .eq("invoice_token", raw)
      .maybeSingle();
    if (!order) return null;

    const { data: company } = await admin
      .from("companies")
      .select("name, settings")
      .eq("id", order.company_id)
      .maybeSingle();
    const expired = order.invoice_token_expires_at
      ? new Date(order.invoice_token_expires_at) < new Date()
      : false;
    const emailVerified = Boolean(order.vendor_invoice_submitted_at) || expired || await isInvoiceAuthVerified(raw);
    return mapVendorInvoiceView({
      token: raw,
      order,
      company,
      previewLocked: !emailVerified,
      emailVerified,
    });
  } catch {
    return null;
  }
}

export async function getStaffVendorInvoicePreview(orderId: string): Promise<ActionResult<{ invoice: VendorInvoiceView }>> {
  try {
    const { supabase, companyId } = await getAuthContext();
    const { data: order } = await supabase
      .from("contractor_orders")
      .select(`
        *,
        craftsman:craftsmen(name, company_name, phone, email, bank_name, bank_branch, bank_account_type, bank_account_number, bank_account_kana),
        construction:constructions(title, construction_no, company_id)
      `)
      .eq("id", orderId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!order) return actionFail("発注が見つかりません", "発注が見つかりません");

    const { data: company } = await supabase
      .from("companies")
      .select("name, settings")
      .eq("id", companyId)
      .maybeSingle();

    return actionOk({
      invoice: mapVendorInvoiceView({
        token: order.invoice_token ?? "",
        order,
        company,
        previewLocked: false,
        emailVerified: true,
      }),
    });
  } catch (e) {
    return actionFail(e, "請求書プレビューの取得に失敗しました");
  }
}

async function loadVendorInvoiceOrder(token: string) {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("contractor_orders")
    .select("id, company_id, invoice_token_expires_at, vendor_invoice_submitted_at, craftsman:craftsmen(email, name)")
    .eq("invoice_token", token.trim())
    .maybeSingle();
  return order;
}

async function assertVendorInvoiceReady(token: string, requireAuth: boolean) {
  const order = await loadVendorInvoiceOrder(token);
  if (!order) return { ok: false as const, error: "リンクが無効です" };
  if (order.invoice_token_expires_at && new Date(order.invoice_token_expires_at) < new Date()) {
    return { ok: false as const, error: "URLの有効期限が切れています" };
  }
  if (order.vendor_invoice_submitted_at) {
    return { ok: false as const, error: "すでに送信済みです" };
  }
  if (requireAuth && !(await isInvoiceAuthVerified(token))) {
    return { ok: false as const, error: "メールに送った確認コードを入力してください" };
  }
  return { ok: true as const, order };
}

export async function sendVendorInvoiceAuthCode(token: string): Promise<ActionResult<{
  maskedEmail: string;
  emailSent?: boolean;
  emailError?: string;
}>> {
  try {
    const raw = token.trim();
    const order = await loadVendorInvoiceOrder(raw);
    if (!order) return actionFail("リンクが無効です", "リンクが無効です");
    if (order.invoice_token_expires_at && new Date(order.invoice_token_expires_at) < new Date()) {
      return actionFail("URLの有効期限が切れています", "URLの有効期限が切れています");
    }
    const craftsman = Array.isArray(order.craftsman) ? order.craftsman[0] : order.craftsman;
    const to = (craftsman?.email ?? "").trim();
    if (!to) {
      return actionFail(
        "業者マスタにメールがないため、メール認証できません。発注元に社内のPDF添付を依頼してください。",
        "業者マスタにメールがありません",
      );
    }
    const code = generateInvoiceAuthCode();
    await setInvoiceAuthChallenge(raw, code);

    const admin = createAdminClient();
    const { data: company } = await admin.from("companies").select("name").eq("id", order.company_id).maybeSingle();
    const companyName = company?.name ?? "発注元";
    const subject = `[BRIDGE Linq] 請求書送信用の確認コード`;
    const text = [
      `${craftsman?.name ?? "業者"} 御中`,
      "",
      `${companyName} です。請求書送信ページの確認コードです。`,
      "",
      `確認コード: ${code}`,
      "",
      "有効期限は15分です。このメールに心当たりがない場合は破棄してください。",
    ].join("\n");
    const html = `<div style="font-family:sans-serif;font-size:14px;line-height:1.7;color:#111827">
<p>${craftsman?.name ?? "業者"} 御中</p>
<p>${companyName} です。請求書送信ページの確認コードです。</p>
<p style="font-size:28px;letter-spacing:0.2em;font-weight:700;margin:20px 0">${code}</p>
<p style="font-size:12px;color:#64748b">有効期限は15分です。</p>
</div>`;

    let mail: { sent: boolean; error?: string } = { sent: false };
    if (process.env.RESEND_API_KEY) {
      try {
        const { getResend, CUSTOMER_FROM_EMAIL } = await import("@/lib/resend");
        const { error } = await getResend().emails.send({
          from: CUSTOMER_FROM_EMAIL,
          to,
          subject,
          html,
          text,
        });
        if (!error) mail = { sent: true };
        else mail = { sent: false, error: "メール送信に失敗しました" };
      } catch (e) {
        mail = { sent: false, error: e instanceof Error ? e.message : "メール送信に失敗しました" };
      }
    }
    if (!mail.sent) {
      try {
        const { data: companyUsers } = await admin
          .from("profiles")
          .select("id")
          .eq("company_id", order.company_id)
          .limit(5);
        const { sendViaGmailAccount } = await import("@/lib/gmail-send");
        let gmailOk = false;
        for (const user of companyUsers ?? []) {
          try {
            await sendViaGmailAccount({
              userId: user.id,
              to: [{ name: craftsman?.name ?? "業者", address: to }],
              subject,
              bodyText: text,
              bodyHtml: html,
            });
            gmailOk = true;
            break;
          } catch {
            /* try next */
          }
        }
        mail = gmailOk ? { sent: true } : { sent: false, error: mail.error ?? "メール送信に失敗しました" };
      } catch (e) {
        mail = { sent: false, error: e instanceof Error ? e.message : mail.error ?? "メール送信に失敗しました" };
      }
    }

    return actionOk({
      maskedEmail: maskEmail(to),
      emailSent: mail.sent,
      emailError: mail.error,
    });
  } catch (e) {
    return actionFail(e, "確認コードの送信に失敗しました");
  }
}

export async function verifyVendorInvoiceAuthCode(
  token: string,
  code: string,
): Promise<ActionResult<{ verified: true }>> {
  try {
    const raw = token.trim();
    const order = await loadVendorInvoiceOrder(raw);
    if (!order) return actionFail("リンクが無効です", "リンクが無効です");
    const ok = await verifyInvoiceAuthChallenge(raw, code);
    if (!ok) return actionFail("確認コードが違います", "確認コードが違います");
    await markInvoiceAuthVerified(raw);
    return actionOk({ verified: true as const });
  } catch (e) {
    return actionFail(e, "確認に失敗しました");
  }
}

export async function uploadVendorInvoicePdf(
  token: string,
  formData: FormData,
): Promise<ActionResult<{ path: string; name: string }>> {
  try {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return actionFail("ファイルを選択してください", "ファイルを選択してください");
    }
    if (file.size > 10 * 1024 * 1024) {
      return actionFail("ファイルは10MBまでです", "ファイルは10MBまでです");
    }
    const name = file.name.toLowerCase();
    const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
    const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|heic|heif)$/.test(name);
    if (!isPdf && !isImage) return actionFail("PDFまたは画像を添付してください", "PDFまたは画像を添付してください");

    const ready = await assertVendorInvoiceReady(token, true);
    if (!ready.ok) return actionFail(ready.error, ready.error);
    const order = ready.order;

    const path = `procurement/${order.company_id}/${order.id}/vendor-invoice/${Date.now()}-${safeFileName(file.name)}`;
    await uploadToStorageAsAdmin("documents", path, file, {
      contentType: file.type || (isPdf ? "application/pdf" : "application/octet-stream"),
      upsert: false,
    });
    return actionOk({ path, name: file.name });
  } catch (e) {
    return actionFail(e, "PDFのアップロードに失敗しました");
  }
}

export async function submitVendorInvoice(input: {
  token: string;
  invoiceDate: string;
  invoiceNo: string;
  registrationNumber: string;
  remarks: string;
  pdfPath?: string | null;
}): Promise<ActionResult<{ submitted: true }>> {
  try {
    const ready = await assertVendorInvoiceReady(input.token, true);
    if (!ready.ok) return actionFail(ready.error, ready.error);
    const invoiceDate = input.invoiceDate.trim();
    const registrationNumber = input.registrationNumber.trim().toUpperCase();
    if (!invoiceDate) return actionFail("請求日を入力してください", "請求日を入力してください");
    if (!registrationNumber) return actionFail("登録番号を入力してください", "登録番号を入力してください");
    if (!/^T\d{13}$/.test(registrationNumber)) {
      return actionFail("登録番号は T + 13桁で入力してください", "登録番号は T + 13桁で入力してください");
    }
    const order = ready.order;
    const admin = createAdminClient();
    const { data: full } = await admin
      .from("contractor_orders")
      .select("amount")
      .eq("id", order.id)
      .maybeSingle();
    const patch: Record<string, unknown> = {
      vendor_invoice_date: invoiceDate,
      vendor_invoice_no: input.invoiceNo.trim() || null,
      vendor_registration_no: registrationNumber,
      vendor_invoice_remarks: input.remarks.trim() || null,
      vendor_invoice_submitted_at: new Date().toISOString(),
      vendor_invoice_amount: Number(full?.amount ?? 0),
      ledger_status: "invoice_received",
      updated_at: new Date().toISOString(),
    };
    if (input.pdfPath) patch.vendor_invoice_pdf_path = input.pdfPath;
    let { error } = await admin
      .from("contractor_orders")
      .update(patch)
      .eq("id", order.id);
    if (error && /vendor_invoice_amount/i.test(error.message)) {
      delete patch.vendor_invoice_amount;
      ({ error } = await admin.from("contractor_orders").update(patch).eq("id", order.id));
    }
    if (error) return actionFail(error.message, "送信に失敗しました");
    return actionOk({ submitted: true as const });
  } catch (e) {
    return actionFail(e, "送信に失敗しました");
  }
}

