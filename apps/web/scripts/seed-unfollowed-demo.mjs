/**
 * 未フォローアップウィジェット用のデモデータを投入
 * - 営業ユーザー: 山田 営業 / 佐藤 担当
 * - 顧客: 田中 太郎 / 鈴木 花子 / 伊藤 建設
 * - 商談: 7日以上更新なし（未フォロー対象）
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const get = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1] ?? "").trim();
const admin = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"));

const COMPANY_ID = "00000000-0000-0000-0000-000000000001";
const PASSWORD = "hachi2026";

const SALES = [
  { email: "yamada.sales@hachi.test", displayName: "山田 営業", role: "employee" },
  { email: "sato.sales@hachi.test", displayName: "佐藤 担当", role: "employee" },
];

async function ensureUser({ email, displayName, role }) {
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id, email")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile) {
    console.log(`  既存: ${displayName} (${email})`);
    return existingProfile.id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { company_id: COMPANY_ID, role, display_name: displayName },
  });
  if (error) throw new Error(`${email}: ${error.message}`);

  const userId = data.user.id;
  await admin.from("profiles").insert({
    id: userId,
    company_id: COMPANY_ID,
    display_name: displayName,
    email,
    role,
  });
  console.log(`  作成: ${displayName} (${email})`);
  return userId;
}

async function ensureCustomer({ name, companyName, assignedTo, daysAgo }) {
  const { data: existing } = await admin
    .from("customers")
    .select("id, name")
    .eq("company_id", COMPANY_ID)
    .eq("name", name)
    .is("deleted_at", null)
    .maybeSingle();

  let customerId = existing?.id;
  if (!customerId) {
    const { data, error } = await admin
      .from("customers")
      .insert({
        company_id: COMPANY_ID,
        name,
        company_name: companyName,
        assigned_to: assignedTo,
        status: "active",
      })
      .select("id")
      .single();
    if (error) throw error;
    customerId = data.id;
    console.log(`  顧客作成: ${name}`);
  } else {
    await admin.from("customers").update({ assigned_to: assignedTo, company_name: companyName }).eq("id", customerId);
    console.log(`  顧客更新: ${name}`);
  }

  const oldDate = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
  const { data: deal } = await admin
    .from("deals")
    .select("id")
    .eq("customer_id", customerId)
    .not("stage", "in", '("won","lost")')
    .limit(1)
    .maybeSingle();

  if (deal) {
    await admin.from("deals").update({ updated_at: oldDate, assigned_to: assignedTo }).eq("id", deal.id);
  } else {
    await admin.from("deals").insert({
      company_id: COMPANY_ID,
      customer_id: customerId,
      title: `${name} 商談`,
      stage: "negotiation",
      value: 5000000,
      assigned_to: assignedTo,
      updated_at: oldDate,
      created_at: oldDate,
    });
  }
  console.log(`    商談: ${daysAgo}日前更新`);
  return customerId;
}

console.log("=== 営業ユーザーを作成 ===");
const yamadaId = await ensureUser(SALES[0]);
const satoId = await ensureUser(SALES[1]);

console.log("\n=== 未フォロー顧客を作成 ===");
await ensureCustomer({ name: "田中 太郎", companyName: "田中工務店", assignedTo: yamadaId, daysAgo: 10 });
await ensureCustomer({ name: "鈴木 花子", companyName: null, assignedTo: satoId, daysAgo: 14 });
await ensureCustomer({ name: "伊藤 建設", companyName: "伊藤建設株式会社", assignedTo: yamadaId, daysAgo: 20 });

console.log("\n完了");
console.log("\nログイン情報（営業担当）:");
console.log(`  山田 営業: yamada.sales@hachi.test / ${PASSWORD}`);
console.log(`  佐藤 担当: sato.sales@hachi.test / ${PASSWORD}`);
console.log("\n管理者でダッシュボード → 未フォロー → 問い合わせ を送信すると、担当営業の社内チャットに届きます。");
