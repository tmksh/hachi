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
  parseTransferSender,
  todayIso,
} from "@/lib/procurement";
import type { TransferSender } from "@/lib/procurement";
import { canAccessFeature, mergeRolePermissions, type RolePermissions } from "@/lib/role-permissions";

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
  invoicePath: string;
  expiresYmd: string;
}): Promise<{ sent: boolean; to?: string; error?: string }> {
  const to = input.to?.trim();
  if (!to) return { sent: false, error: "業者マスタにメールアドレスがありません" };

  const origin = await resolveAppOrigin();
  const url = `${origin}${input.invoicePath.startsWith("/") ? "" : "/"}${input.invoicePath}`;
  const subject = `[BRIDGE Linq] 検収完了 — ${input.poNo} 請求書をご送付ください`;
  const text = [
    `${input.vendorName} 御中`,
    "",
    `${input.companyName} です。検収が完了しました。`,
    "下記URLから請求書をご送付ください（ログイン不要）。",
    "",
    url,
    "",
    `有効期限: ${input.expiresYmd}（30日）`,
    "",
    "本メールに心当たりがない場合は破棄してください。",
  ].join("\n");
  const html = `<div style="font-family:sans-serif;font-size:14px;line-height:1.7;color:#111827">
<p>${input.vendorName} 御中</p>
<p>${input.companyName} です。検収が完了しました。<br/>下記ボタンから請求書をご送付ください（ログイン不要）。</p>
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
      .select("*, craftsman:craftsmen(id, name), construction:constructions(id, title, construction_no)")
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
      .select("*, craftsman:craftsmen(id, name, email), construction:constructions(id, title, construction_no)")
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
      .select("id, amount, parent_order_id, lot_no, company_id")
      .eq("id", input.orderId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!before) return actionFail("発注が見つかりません", "発注が見つかりません");

    const originalAmount = Number(before.amount ?? 0);
    const lotAmount = input.lotAmount != null && Number.isFinite(input.lotAmount) ? Number(input.lotAmount) : null;
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
      mail = await notifyVendorInvoiceUrl(order, invoiceUrl, expires, user.id);
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
};

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
    const issuer = companyIssuer(
      (company?.settings ?? null) as Record<string, unknown> | null,
      company?.name ?? "発注元",
    );
    const craftsman = Array.isArray(order.craftsman) ? order.craftsman[0] : order.craftsman;
    const construction = Array.isArray(order.construction) ? order.construction[0] : order.construction;
    const bankName = craftsman?.bank_name ?? "";
    const bankBranch = craftsman?.bank_branch ?? "";
    const bankAccountType = craftsman?.bank_account_type ?? "";
    const bankAccountNumber = craftsman?.bank_account_number ?? "";
    const bankAccountKana = craftsman?.bank_account_kana ?? "";
    const bank = [bankName, bankBranch, bankAccountType, bankAccountNumber].filter(Boolean).join(" ");
    const expired = order.invoice_token_expires_at
      ? new Date(order.invoice_token_expires_at) < new Date()
      : false;
    return {
      token: raw,
      expiresAt: order.invoice_token_expires_at,
      expired,
      submitted: Boolean(order.vendor_invoice_submitted_at),
      companyName: issuer.name,
      companyAddress: issuer.address,
      companyInvoiceNo: issuer.invoiceNo,
      constructionNo: construction?.construction_no ?? "",
      constructionTitle: construction?.title ?? "",
      orderTitle: order.title,
      poNo: order.po_no ?? "",
      amount: Number(order.amount ?? 0),
      deliveryDate: order.delivery_date,
      workContent: order.work_content,
      vendorName: craftsman?.company_name || craftsman?.name || "業者",
      vendorAddress: "",
      vendorPhone: craftsman?.phone ?? "",
      paymentDate: order.payment_date ?? null,
      bankName,
      bankBranch,
      bankAccountType,
      bankAccountNumber,
      bankAccountKana,
      bankInfo: bank || "（口座情報は発注元の業者マスタに登録された内容が表示されます）",
      invoiceDate: order.vendor_invoice_date,
      invoiceNo: order.vendor_invoice_no,
      registrationNumber: order.vendor_registration_no,
      remarks: order.vendor_invoice_remarks,
      vendorPdfName: order.vendor_invoice_pdf_path
        ? String(order.vendor_invoice_pdf_path).split("/").pop() ?? "請求書.pdf"
        : null,
      hasVendorPdf: Boolean(order.vendor_invoice_pdf_path),
      attachments: Array.isArray(order.delivery_attachments) ? order.delivery_attachments : [],
    };
  } catch {
    return null;
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

    const admin = createAdminClient();
    const { data: order } = await admin
      .from("contractor_orders")
      .select("id, company_id, invoice_token_expires_at, vendor_invoice_submitted_at")
      .eq("invoice_token", token.trim())
      .maybeSingle();
    if (!order) return actionFail("リンクが無効です", "リンクが無効です");
    if (order.invoice_token_expires_at && new Date(order.invoice_token_expires_at) < new Date()) {
      return actionFail("URLの有効期限が切れています", "URLの有効期限が切れています");
    }
    if (order.vendor_invoice_submitted_at) {
      return actionFail("すでに送信済みです", "すでに送信済みです");
    }

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
    const admin = createAdminClient();
    const { data: order } = await admin
      .from("contractor_orders")
      .select("id, invoice_token_expires_at, vendor_invoice_submitted_at")
      .eq("invoice_token", input.token.trim())
      .maybeSingle();
    if (!order) return actionFail("リンクが無効です", "リンクが無効です");
    if (order.invoice_token_expires_at && new Date(order.invoice_token_expires_at) < new Date()) {
      return actionFail("URLの有効期限が切れています", "URLの有効期限が切れています");
    }
    if (order.vendor_invoice_submitted_at) {
      return actionFail("すでに送信済みです", "すでに送信済みです");
    }
    const patch: Record<string, unknown> = {
      vendor_invoice_date: input.invoiceDate || todayIso(),
      vendor_invoice_no: input.invoiceNo.trim() || null,
      vendor_registration_no: input.registrationNumber.trim() || null,
      vendor_invoice_remarks: input.remarks.trim() || null,
      vendor_invoice_submitted_at: new Date().toISOString(),
      ledger_status: "invoice_received",
      updated_at: new Date().toISOString(),
    };
    if (input.pdfPath) patch.vendor_invoice_pdf_path = input.pdfPath;
    const { error } = await admin
      .from("contractor_orders")
      .update(patch)
      .eq("id", order.id);
    if (error) return actionFail(error.message, "送信に失敗しました");
    return actionOk({ submitted: true as const });
  } catch (e) {
    return actionFail(e, "送信に失敗しました");
  }
}

