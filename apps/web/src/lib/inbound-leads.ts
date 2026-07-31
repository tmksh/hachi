import { createHash, randomBytes, timingSafeEqual } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type InboundWebhookSettings = {
  enabled: boolean;
  token: string;
  secret_hash: string;
  secret_prefix: string;
  created_at?: string;
  rotated_at?: string;
};

export type NormalizedInboundLead = {
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  inquiry_category: string | null;
  inquiry_content: string | null;
};

const NAME_KEYS = ["name", "full_name", "fullname", "customer_name", "お名前", "氏名"];
const EMAIL_KEYS = ["email", "mail", "e_mail", "メール"];
const PHONE_KEYS = ["phone", "tel", "telephone", "mobile", "電話", "電話番号"];
const CONTENT_KEYS = [
  "inquiry_content",
  "content",
  "message",
  "body",
  "comment",
  "description",
  "問い合わせ内容",
  "内容",
];
const CATEGORY_KEYS = ["inquiry_category", "category", "type", "カテゴリ"];
const SOURCE_KEYS = ["source", "channel", "経路"];

function pickString(body: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  // nested form payloads: { data: { name: "..." } }
  const data = body.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return pickString(data as Record<string, unknown>, keys);
  }
  return null;
}

export function normalizeInboundPayload(body: Record<string, unknown>): NormalizedInboundLead | null {
  const name = pickString(body, NAME_KEYS);
  if (!name) return null;
  return {
    name,
    email: pickString(body, EMAIL_KEYS),
    phone: pickString(body, PHONE_KEYS),
    source: pickString(body, SOURCE_KEYS) ?? "web",
    inquiry_category: pickString(body, CATEGORY_KEYS),
    inquiry_content: pickString(body, CONTENT_KEYS),
  };
}

export function generateInboundWebhookCredentials(): {
  token: string;
  secret: string;
  secret_hash: string;
  secret_prefix: string;
} {
  const token = randomBytes(16).toString("hex");
  const secret = `ils_${randomBytes(24).toString("hex")}`;
  return {
    token,
    secret,
    secret_hash: hashInboundSecret(secret),
    secret_prefix: secret.slice(0, 10),
  };
}

export function hashInboundSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function verifyInboundSecret(rawSecret: string | null | undefined, storedHash: string): boolean {
  if (!rawSecret) return false;
  const incoming = Buffer.from(hashInboundSecret(rawSecret));
  const stored = Buffer.from(storedHash);
  if (incoming.length !== stored.length) return false;
  return timingSafeEqual(incoming, stored);
}

export function readInboundWebhookSettings(
  settings: Record<string, unknown> | null | undefined,
): InboundWebhookSettings | null {
  const raw = settings?.inbound_webhook;
  if (!raw || typeof raw !== "object") return null;
  const cfg = raw as Partial<InboundWebhookSettings>;
  if (!cfg.token || !cfg.secret_hash || !cfg.secret_prefix) return null;
  return {
    enabled: Boolean(cfg.enabled),
    token: cfg.token,
    secret_hash: cfg.secret_hash,
    secret_prefix: cfg.secret_prefix,
    created_at: cfg.created_at,
    rotated_at: cfg.rotated_at,
  };
}

/** service role client で inbound_leads へ登録 */
export async function insertInboundLeadFromWebhook(
  admin: SupabaseClient,
  companyId: string,
  input: NormalizedInboundLead,
) {
  const { data: assignee } = await admin
    .from("profiles")
    .select("id")
    .eq("company_id", companyId)
    .in("role", ["hq_admin", "admin", "sales"])
    .limit(1)
    .maybeSingle();

  const assigneeId = assignee?.id ?? null;

  const { data: lead, error } = await admin
    .from("inbound_leads")
    .insert({
      company_id: companyId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      source: input.source || "web",
      inquiry_category: input.inquiry_category,
      inquiry_content: input.inquiry_content,
      assigned_to: assigneeId,
      status: "new",
    })
    .select("id")
    .single();
  if (error) throw error;

  if (assigneeId) {
    await admin.from("todos").insert({
      company_id: companyId,
      assigned_to: assigneeId,
      title: `新規問い合わせ: ${input.name}`,
      description: input.inquiry_content?.slice(0, 200) ?? "Webフォーム等から問い合わせが届きました",
      status: "pending",
      priority: "high",
      source: "inbound_webhook",
      tags: ["sales_flow", "urgent"],
    });
  }

  return lead;
}
