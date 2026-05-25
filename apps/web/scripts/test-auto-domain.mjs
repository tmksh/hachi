#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, "../.env.local"), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const BASE = "https://bridge-linq.com";
const SLUG = `autotest${Date.now().toString(36).slice(-4)}`;

function sessionCookie(session) {
  const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  return `sb-${ref}-auth-token=${encodeURIComponent(JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: session.user,
  }))}`;
}

async function invokeAction(cookie, actionId, payload) {
  const routerState = encodeURIComponent(JSON.stringify([
    "",
    { children: ["(app)", { children: ["(app)", { children: ["admin", { children: ["__PAGE__", {}] }] }] }] },
  ]));
  const res = await fetch(`${BASE}/admin`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      "Content-Type": "text/plain;charset=UTF-8",
      Accept: "text/x-component",
      "Next-Action": actionId,
      "Next-Router-State-Tree": routerState,
    },
    body: JSON.stringify([payload]),
  });
  return { status: res.status, text: await res.text() };
}

async function main() {
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: "super-admin@example.com",
    password: "admin2026",
  });
  if (error) throw error;

  const cookie = sessionCookie(data.session);
  const payload = {
    companyName: `自動テスト ${SLUG}`,
    plan: null,
    slug: SLUG,
    ownerName: "自動テスト担当",
    ownerEmail: `${SLUG}@bridge.test`,
    ownerPassword: "AutoTest2026!",
  };

  console.log("Creating company with slug:", SLUG);
  const result = await invokeAction(cookie, "40ecfc18b20716ee315a4ebc1ea01e5cf78bccccee", payload);
  console.log("HTTP", result.status);
  console.log(result.text.slice(0, 800));

  const errMatch = result.text.match(/netlifyError":"([^"]*)"/);
  const domainMatch = result.text.match(/netlifyDomain":"([^"]*)"/);
  if (errMatch?.[1]) console.log("Netlify error:", errMatch[1]);
  if (domainMatch?.[1]) console.log("Netlify domain:", domainMatch[1]);

  if (result.status !== 200 || result.text.includes('"digest"')) {
    process.exit(1);
  }

  const domain = `${SLUG}.bridge-linq.com`;
  console.log("\nWaiting 5s for Netlify...");
  await new Promise((r) => setTimeout(r, 5000));

  for (let i = 0; i < 6; i++) {
    const res = await fetch(`https://${domain}`, { redirect: "manual" });
    console.log(`Attempt ${i + 1}: HTTP ${res.status} ${res.headers.get("location") ?? ""}`);
    if (res.status !== 404) break;
    await new Promise((r) => setTimeout(r, 5000));
  }

  console.log("\nDomain tested:", domain);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
