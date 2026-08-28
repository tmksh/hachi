import { createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

/** 議事録 2026/08/27: 業者ログインは設けず、登録メールへの確認コードで認証する。 */

function secret(): string {
  return process.env.ENCRYPTION_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || "bridge-vendor-invoice";
}

function hashValue(token: string, payload: string): string {
  return createHash("sha256").update(`${secret()}:${token}:${payload}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function cookieKey(kind: "otp" | "ok", token: string): string {
  return `vi_${kind}_${token.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16)}`;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const head = local.slice(0, 1);
  return `${head}***@${domain}`;
}

export function generateInvoiceAuthCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function setInvoiceAuthChallenge(token: string, code: string): Promise<void> {
  const jar = await cookies();
  const exp = Date.now() + 15 * 60 * 1000;
  jar.set(cookieKey("otp", token), `${exp}:${hashValue(token, code)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 15 * 60,
  });
}

export async function verifyInvoiceAuthChallenge(token: string, code: string): Promise<boolean> {
  const jar = await cookies();
  const raw = jar.get(cookieKey("otp", token))?.value;
  if (!raw) return false;
  const [exp, hash] = raw.split(":");
  if (!exp || !hash || Number(exp) < Date.now()) return false;
  const normalized = code.replace(/\D/g, "").slice(0, 6);
  if (normalized.length !== 6) return false;
  return safeEqual(hash, hashValue(token, normalized));
}

export async function markInvoiceAuthVerified(token: string): Promise<void> {
  const jar = await cookies();
  const exp = Date.now() + 2 * 60 * 60 * 1000;
  jar.set(cookieKey("ok", token), `${exp}:${hashValue(token, "ok")}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 2 * 60 * 60,
  });
  jar.set(cookieKey("otp", token), "", { path: "/", maxAge: 0 });
}

export async function isInvoiceAuthVerified(token: string): Promise<boolean> {
  const jar = await cookies();
  const raw = jar.get(cookieKey("ok", token))?.value;
  if (!raw) return false;
  const [exp, hash] = raw.split(":");
  if (!exp || !hash || Number(exp) < Date.now()) return false;
  return safeEqual(hash, hashValue(token, "ok"));
}
