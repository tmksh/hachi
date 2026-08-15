/** 外部サービス向けに公開する origin。localhost は使わない。 */
export function getPublicAppOrigin(): string {
  const domain = (process.env.NEXT_PUBLIC_APP_DOMAIN ?? "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  if (domain && !/localhost|127\.0\.0\.1/i.test(domain)) {
    return `https://${domain}`;
  }
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/$/, "");
  if (appUrl && !/localhost|127\.0\.0\.1/i.test(appUrl)) {
    return appUrl;
  }
  return "";
}
