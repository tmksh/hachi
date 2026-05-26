import type { NextRequest } from "next/server";

/** ユーザーが実際にアクセスした origin（Netlify の x-forwarded-host より request.url を優先） */
export function getRequestOrigin(request: Request | NextRequest): string {
  return new URL(request.url).origin;
}

export function getRequestHostname(request: Request | NextRequest): string {
  return new URL(request.url).hostname;
}
