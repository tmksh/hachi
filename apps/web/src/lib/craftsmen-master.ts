import { createClient } from "@/lib/supabase/server";

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
  return /row-level security|permission denied|42501|403/i.test(message);
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "ログインが必要です" as const };

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .single();
  if (!profile) return { error: "プロフィールが見つかりません" as const };
  if (!profile.company_id) return { error: "会社情報が設定されていません" as const };

  if (requireAdmin && !MASTER_ADMIN_ROLES.has(profile.role)) {
    return { error: "マスタの編集は本部管理者のみ可能です" as const };
  }

  return {
    supabase,
    company_id: profile.company_id as string,
    role: profile.role as string,
  };
}

async function nextSortOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "craftsmen_specialties" | "craftsmen_qualifications",
  company_id: string,
): Promise<number> {
  const { data: last } = await supabase
    .from(table)
    .select("sort_order")
    .eq("company_id", company_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (last?.sort_order ?? -1) + 1;
}

async function adminClientInsert(
  table: "craftsmen_specialties" | "craftsmen_qualifications",
  row: { company_id: string; label: string; sort_order: number },
): Promise<{ item: CraftsmanMasterItem } | { error: string }> {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const retry = await admin.from(table).insert(row).select().single();
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

function canUseAdminClient(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/** 職種区分 / 資格マスタの一覧（throw しない） */
export async function listCraftsmanMasterItems(
  kind: CraftsmanMasterKind,
): Promise<CraftsmanMasterItem[]> {
  const ctx = await getMasterContext(false);
  if ("error" in ctx) return [];

  const table = TABLE_BY_KIND[kind];

  // SERVICE_ROLE がある環境では admin を優先（RLS 差異で空配列になるケースを避ける）
  if (canUseAdminClient()) {
    const viaAdmin = await listViaAdmin(table, ctx.company_id);
    if (viaAdmin) return viaAdmin;
  }

  const { data, error } = await ctx.supabase
    .from(table)
    .select("id, label, sort_order")
    .eq("company_id", ctx.company_id)
    .order("sort_order");

  if (!error && data) return data as CraftsmanMasterItem[];

  const viaAdmin = await listViaAdmin(table, ctx.company_id);
  if (viaAdmin) return viaAdmin;

  return (data ?? []) as CraftsmanMasterItem[];
}

/** 職種区分 / 資格マスタの追加（throw しない） */
export async function createCraftsmanMasterItem(
  kind: CraftsmanMasterKind,
  label: string,
): Promise<{ item: CraftsmanMasterItem } | { error: string }> {
  const trimmed = label.trim();
  if (!trimmed) return { error: "名称を入力してください" };

  const ctx = await getMasterContext(true);
  if ("error" in ctx) return { error: ctx.error ?? "操作できません" };

  const table = TABLE_BY_KIND[kind];
  const sort_order = await nextSortOrder(ctx.supabase, table, ctx.company_id);
  const row = { company_id: ctx.company_id, label: trimmed, sort_order };

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
  if ("error" in ctx) return { error: ctx.error ?? "操作できません" };

  const table = TABLE_BY_KIND[kind];
  const { error } = await ctx.supabase.from(table).delete().eq("id", id).eq("company_id", ctx.company_id);
  if (!error) return { ok: true };

  const message = error.message ?? "削除に失敗しました";
  if (isRlsOrPermissionError(message)) {
    return adminClientDelete(table, id, ctx.company_id);
  }

  return { error: message };
}
