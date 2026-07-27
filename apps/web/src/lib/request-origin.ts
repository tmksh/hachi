import type { NextRequest } from "next/server";

/**
 * ユーザーが実際にアクセスした origin。
 * Netlify 等のプロキシ配下では x-forwarded-host / proto を優先し、
 * OAuth redirect_uri の不一致（内部 URL vs 公開 URL）を防ぐ。
 */
export function getRequestOrigin(request: Request | NextRequest): string {
  const fwdHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const fwdProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (fwdHost) {
    const proto = fwdProto || "https";
    return `${proto}://${fwdHost}`;
  }
  return new URL(request.url).origin;
}

export function getRequestHostname(request: Request | NextRequest): string {
  const fwdHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (fwdHost) return fwdHost.split(":")[0] ?? fwdHost;
  return new URL(request.url).hostname;
}
