import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/supabase/auth-context";

export type CraftsmanMasterKind = "specialties" | "qualifications";

export type CraftsmanMasterItem = {
  id: string;
  label: string;
  sort_order: number;
};

const TABLE_BY_KIND: Record<CraftsmanMasterKind, "craftsmen_specialties" | "craftsmen_qualifications"> = {
  specialties: "craftsmen_specialties",
  qualifications: "craftsmen_qualifications",
};

const MASTER_ADMIN_ROLES = new Set(["hq_admin", "admin", "owner"]);

function isRlsOrPermissionError(message: string): boolean {
  return /row-level security|permission denied|42501|403|401|jwt|pgrst116|pgrst301|forbidden|policy/i.test(message);
}

function duplicateLabelError(message: string): boolean {
  return /duplicate|unique/i.test(message);
}

function errMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message.trim()) return e.message.trim();
  if (typeof e === "string" && e.trim()) return e.trim();
  return fallback;
}

async function getMasterContext(requireAdmin: boolean) {
  const auth = await getAuthContext();
  if (!auth.user) return { error: "ログインが必要です" as const };
  if (!auth.companyId) return { error: "会社情報が設定されていません" as const };
  if (requireAdmin && !MASTER_ADMIN_ROLES.has(auth.role ?? "")) {
    return { error: "マスタの編集は本部管理者のみ可能です" as const };
  }

  const supabase = await createClient();
  return {
    supabase,
    company_id: auth.companyId,
    role: auth.role ?? "",
  };
}

function canUseAdminClient(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

async function nextSortOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "craftsmen_specialties" | "craftsmen_qualifications",
  company_id: string,
): Promise<number> {
  const viaAdmin = canUseAdminClient() ? await listViaAdmin(table, company_id) : null;
  if (viaAdmin && viaAdmin.length > 0) {
    return Math.min(...viaAdmin.map((row) => row.sort_order)) - 1;
  }

  const { data: first } = await supabase
    .from(table)
    .select("sort_order")
    .eq("company_id", company_id)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (first?.sort_order ?? 0) - 1;
}

async function adminClientInsert(
  table: "craftsmen_specialties" | "craftsmen_qualifications",
  row: { company_id: string; label: string; sort_order: number },
): Promise<{ item: CraftsmanMasterItem } | { error: string }> {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const retry = await admin.from(table).insert(row).select("id, label, sort_order").single();
    if (retry.error) {
      if (duplicateLabelError(retry.error.message)) {
        return { error: "同じ名称は既に登録されています" };
      }
      return { error: retry.error.message };
    }
    return { item: retry.data as CraftsmanMasterItem };
  } catch (e) {
    return {
      error: errMessage(
        e,
        "データベース権限の問題で追加できません。管理者権限と DB 設定を確認してください。",
      ),
    };
  }
}

async function adminClientDelete(
  table: "craftsmen_specialties" | "craftsmen_qualifications",
  id: string,
  company_id: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const retry = await admin.from(table).delete().eq("id", id).eq("company_id", company_id);
    if (retry.error) return { error: retry.error.message };
    return { ok: true };
  } catch (e) {
    return {
      error: errMessage(
        e,
        "データベース権限の問題で削除できません。管理者権限と DB 設定を確認してください。",
      ),
    };
  }
}

async function listViaAdmin(
  table: "craftsmen_specialties" | "craftsmen_qualifications",
  company_id: string,
): Promise<CraftsmanMasterItem[] | null> {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const retry = await admin
      .from(table)
      .select("id, label, sort_order")
      .eq("company_id", company_id)
      .order("sort_order");
    if (!retry.error && retry.data) return retry.data as CraftsmanMasterItem[];
    if (retry.error) {
      console.warn("[craftsmen-master] admin list failed:", retry.error.message);
    }
  } catch (e) {
    console.warn("[craftsmen-master] admin client unavailable:", e);
  }
  return null;
}

/** 職種区分 / 資格マスタの一覧（未ログイン時は error） */
export async function listCraftsmanMasterItems(
  kind: CraftsmanMasterKind,
): Promise<{ items: CraftsmanMasterItem[] } | { error: string }> {
  const ctx = await getMasterContext(false);
  if ("error" in ctx) return { error: ctx.error };

  const table = TABLE_BY_KIND[kind];

  if (canUseAdminClient()) {
    const viaAdmin = await listViaAdmin(table, ctx.company_id);
    if (viaAdmin) return { items: viaAdmin };
  }

  const { data, error } = await ctx.supabase
    .from(table)
    .select("id, label, sort_order")
    .eq("company_id", ctx.company_id)
    .order("sort_order");

  if (!error && data) return { items: data as CraftsmanMasterItem[] };

  const viaAdmin = await listViaAdmin(table, ctx.company_id);
  if (viaAdmin) return { items: viaAdmin };

  return { error: error?.message ?? "マスタ一覧の取得に失敗しました" };
}

/** 職種区分 / 資格マスタの追加（throw しない） */
export async function createCraftsmanMasterItem(
  kind: CraftsmanMasterKind,
  label: string,
): Promise<{ item: CraftsmanMasterItem } | { error: string }> {
  const trimmed = label.trim();
  if (!trimmed) return { error: "名称を入力してください" };

  const ctx = await getMasterContext(true);
  if ("error" in ctx) return { error: ctx.error };

  const table = TABLE_BY_KIND[kind];
  const sort_order = await nextSortOrder(ctx.supabase, table, ctx.company_id);
  const row = { company_id: ctx.company_id, label: trimmed, sort_order };

  // RLS で INSERT が落ちる環境があるため、service_role があれば先に使う
  if (canUseAdminClient()) {
    return adminClientInsert(table, row);
  }

  const { data, error } = await ctx.supabase.from(table).insert(row).select("id, label, sort_order").single();
  if (!error && data) return { item: data as CraftsmanMasterItem };

  const message = error?.message ?? "追加に失敗しました";
  if (duplicateLabelError(message)) return { error: "同じ名称は既に登録されています" };
  if (isRlsOrPermissionError(message)) {
    return adminClientInsert(table, row);
  }

  return { error: message };
}

/** 職種区分 / 資格マスタの削除（throw しない） */
export async function deleteCraftsmanMasterItem(
  kind: CraftsmanMasterKind,
  id: string,
): Promise<{ ok: true } | { error: string }> {
  if (!id.trim()) return { error: "削除対象が指定されていません" };

  const ctx = await getMasterContext(true);
  if ("error" in ctx) return { error: ctx.error };

  const table = TABLE_BY_KIND[kind];

  if (canUseAdminClient()) {
    return adminClientDelete(table, id, ctx.company_id);
  }

  const { error } = await ctx.supabase.from(table).delete().eq("id", id).eq("company_id", ctx.company_id);
  if (!error) return { ok: true };

  const message = error.message ?? "削除に失敗しました";
  if (isRlsOrPermissionError(message)) {
    return adminClientDelete(table, id, ctx.company_id);
  }

  return { error: message };
}
