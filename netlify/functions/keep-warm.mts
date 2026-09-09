/**
 * 本番の Next サーバー関数を起こしておく。
 * 5分おき。認証は通さない（/api/health は middleware で即通す）。
 */
export default async function handler() {
  const base = (process.env.URL || process.env.DEPLOY_PRIME_URL || "").replace(/\/$/, "");
  if (!base || base.includes("localhost")) {
    return new Response("skip", { status: 200 });
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  const headers = { "user-agent": "hachi-keep-warm" };

  try {
    await Promise.allSettled([
      fetch(`${base}/api/health`, { cache: "no-store", signal: ctrl.signal, headers }),
      fetch(`${base}/login`, {
        cache: "no-store",
        redirect: "manual",
        signal: ctrl.signal,
        headers,
      }),
    ]);
  } catch {
    // 起こすことが目的。失敗しても次回に任せる
  } finally {
    clearTimeout(timer);
  }

  return new Response("ok");
}

export const config = {
  schedule: "*/5 * * * *",
};
