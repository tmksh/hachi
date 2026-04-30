"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/database.types";

export type TeamRole = "owner" | "hq_admin" | "contractor_admin" | "employee";

/**
 * テナント内の管理者であることを確認し、自社の company_id と自身の role を返す。
 * owner / hq_admin のみがメンバー管理を実行可能。
 */
async function assertTenantAdmin(): Promise<{
  companyId: string;
  actorRole: TeamRole;
  actorId: string;
}> {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) throw new Error("認証が必要です");

  const { data: me, error } = await authClient
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .single();
  if (error || !me) throw new Error("プロフィールが取得できません");

  if (!["owner", "hq_admin"].includes(me.role)) {
    throw new Error("メンバー管理は owner / hq_admin 権限が必要です");
  }

  return {
    companyId: me.company_id,
    actorRole: me.role as TeamRole,
    actorId: user.id,
  };
}

/**
 * 操作者ロールが対象ロールを割り当て可能か判定する。
 *
 * - owner は owner を作れない（1社1オーナー原則）
 * - hq_admin は hq_admin / owner を作れない（権限拡散防止）
 * - hq_admin は contractor_admin / employee のみ可
 */
function assertCanAssignRole(actorRole: TeamRole, targetRole: TeamRole) {
  if (actorRole === "owner") {
    if (targetRole === "owner") {
      throw new Error("オーナーを新規作成することはできません（1社1オーナー）");
    }
    return;
  }
  if (actorRole === "hq_admin") {
    if (targetRole === "owner" || targetRole === "hq_admin") {
      throw new Error("本部管理者は同等以上のロールを作成できません");
    }
    return;
  }
  throw new Error("メンバー管理は owner / hq_admin 権限が必要です");
}

/**
 * 自社のメンバー一覧を取得（プロフィール情報のみ）。
 */
export async function listTeamMembers(): Promise<Profile[]> {
  const { companyId } = await assertTenantAdmin();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("profiles")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Profile[];
}

/**
 * メンバー招待メール送信。
 *
 * Supabase が招待メールを自動送信する。受信者がリンクをクリックすると
 * /api/auth/accept-invite に遷移し、そこで profiles を作成する。
 *
 * user_metadata に company_id / role / display_name を埋め込むことで、
 * 招待受け入れ時にテナント情報を引き継げる。
 */
export async function inviteTeamMember(input: {
  email: string;
  displayName: string;
  role: TeamRole;
}): Promise<void> {
  const { companyId, actorRole } = await assertTenantAdmin();
  assertCanAssignRole(actorRole, input.role);

  if (!input.email.trim()) throw new Error("メールアドレスは必須です");
  if (!input.displayName.trim()) throw new Error("表示名は必須です");

  const admin = createAdminClient();

  const appUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.NODE_ENV === "production"
      ? `https://${process.env.NEXT_PUBLIC_APP_DOMAIN ?? ""}`
      : "http://localhost:3000");

  const { error } = await admin.auth.admin.inviteUserByEmail(
    input.email.trim(),
    {
      redirectTo: `${appUrl}/api/auth/accept-invite`,
      data: {
        company_id: companyId,
        role: input.role,
        display_name: input.displayName.trim(),
      },
    },
  );
  if (error) throw error;
}

/**
 * ロール変更（自社のメンバーのみ、owner 自身を降格させる行為は禁止）
 */
export async function updateTeamMemberRole(userId: string, role: TeamRole) {
  const { companyId, actorRole, actorId } = await assertTenantAdmin();

  if (userId === actorId) {
    throw new Error("自分自身のロールは変更できません");
  }
  assertCanAssignRole(actorRole, role);

  const admin = createAdminClient();

  const { data: target } = await admin
    .from("profiles")
    .select("company_id, role")
    .eq("id", userId)
    .single();
  if (!target || target.company_id !== companyId) {
    throw new Error("対象メンバーが自社に属していません");
  }
  if (target.role === "owner") {
    throw new Error("オーナーのロールは変更できません");
  }
  if (actorRole === "hq_admin" && target.role === "hq_admin") {
    throw new Error("本部管理者は他の本部管理者のロールを変更できません");
  }

  const { error } = await admin
    .from("profiles")
    .update({ role })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * メンバー削除（Auth ユーザーと profiles を削除）
 */
export async function removeTeamMember(userId: string) {
  const { companyId, actorRole, actorId } = await assertTenantAdmin();

  if (userId === actorId) {
    throw new Error("自分自身を削除することはできません");
  }

  const admin = createAdminClient();

  const { data: target } = await admin
    .from("profiles")
    .select("company_id, role")
    .eq("id", userId)
    .single();
  if (!target || target.company_id !== companyId) {
    throw new Error("対象メンバーが自社に属していません");
  }
  if (target.role === "owner") {
    throw new Error("オーナーは削除できません");
  }
  if (actorRole === "hq_admin" && target.role === "hq_admin") {
    throw new Error("本部管理者は他の本部管理者を削除できません");
  }

  // CASCADE で profiles も連鎖削除される
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw error;
}

/**
 * 招待メール再送信
 */
export async function resendTeamInvite(userId: string): Promise<void> {
  const { companyId, actorRole, actorId } = await assertTenantAdmin();

  if (userId === actorId) {
    throw new Error("自分自身への再送信はできません");
  }

  const admin = createAdminClient();

  const { data: target } = await admin
    .from("profiles")
    .select("company_id, role, email, display_name")
    .eq("id", userId)
    .single();
  if (!target || target.company_id !== companyId) {
    throw new Error("対象メンバーが自社に属していません");
  }
  if (target.role === "owner") {
    throw new Error("オーナーへの再送信はできません");
  }
  if (actorRole === "hq_admin" && target.role === "hq_admin") {
    throw new Error("本部管理者は他の本部管理者への再送信ができません");
  }

  const appUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.NODE_ENV === "production"
      ? `https://${process.env.NEXT_PUBLIC_APP_DOMAIN ?? ""}`
      : "http://localhost:3000");

  const { error } = await admin.auth.admin.inviteUserByEmail(target.email, {
    redirectTo: `${appUrl}/api/auth/accept-invite`,
    data: {
      company_id: companyId,
      role: target.role,
      display_name: (target.display_name as string | null) ?? target.email,
    },
  });
  if (error) throw error;
}
