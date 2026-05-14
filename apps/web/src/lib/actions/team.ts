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
 * メンバー招待。
 *
 * password が指定された場合は createUser で即座にアカウント作成し、
 * 管理者が仮パスワードを別途共有する運用。
 * password 未指定の場合は inviteUserByEmail でマジックリンクを送信。
 */
export async function inviteTeamMember(input: {
  email: string;
  displayName: string;
  role: TeamRole;
  password?: string;
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

  const userMeta = {
    company_id: companyId,
    role: input.role,
    display_name: input.displayName.trim(),
  };

  if (input.password) {
    // パスワード指定あり: 即時アカウント作成 & プロフィール登録
    const { data, error } = await admin.auth.admin.createUser({
      email: input.email.trim(),
      password: input.password,
      email_confirm: true,
      user_metadata: userMeta,
    });
    if (error) {
      if ((error as { code?: string }).code === "email_exists") {
        throw new Error("このメールアドレスはすでに登録されています。別のメールアドレスをお使いください。");
      }
      throw new Error(error.message);
    }

    const userId = data.user.id;
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (!existing) {
      const { error: profileError } = await admin.from("profiles").insert({
        id: userId,
        company_id: companyId,
        display_name: input.displayName.trim(),
        email: input.email.trim(),
        role: input.role,
      });
      if (profileError) throw profileError;
    }
  } else {
    // パスワード未指定: マジックリンク招待メール
    const { error } = await admin.auth.admin.inviteUserByEmail(
      input.email.trim(),
      {
        redirectTo: `${appUrl}/api/auth/accept-invite`,
        data: userMeta,
      },
    );
    if (error) {
      if ((error as { code?: string }).code === "email_exists") {
        throw new Error("このメールアドレスはすでに登録されています。別のメールアドレスをお使いください。");
      }
      throw new Error(error.message);
    }
  }
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
  // owner は他の owner のロールを降格できる（重複オーナー解消のため）
  if (target.role === "owner" && actorRole !== "owner") {
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
  // owner は他の owner も削除できる（重複オーナー解消のため）
  if (target.role === "owner" && actorRole !== "owner") {
    throw new Error("オーナーの削除は別のオーナーのみ行えます");
  }
  if (actorRole === "hq_admin" && target.role === "hq_admin") {
    throw new Error("本部管理者は他の本部管理者を削除できません");
  }

  // FK 制約違反を回避するため、削除前に関連レコードをクリーンアップ
  await Promise.all([
    // nullable FK → NULL にセット
    admin.from("customers").update({ assigned_to: null }).eq("assigned_to", userId),
    admin.from("deals").update({ assigned_to: null }).eq("assigned_to", userId),
    admin.from("deal_activities").update({ performed_by: null }).eq("performed_by", userId),
    admin.from("todos").update({ assigned_to: null }).eq("assigned_to", userId),
    admin.from("estimates").update({ assigned_to: null }).eq("assigned_to", userId),
    admin.from("estimate_documents").update({ created_by: null }).eq("created_by", userId),
    admin.from("contracts").update({ assigned_to: null }).eq("assigned_to", userId),
    admin.from("constructions").update({ assigned_to: null }).eq("assigned_to", userId),
    admin.from("construction_tasks").update({ assigned_to: null }).eq("assigned_to", userId),
    admin.from("contractor_orders").update({ approved_by: null }).eq("approved_by", userId),
    admin.from("attendance_entries").update({ modified_by: null }).eq("modified_by", userId),
    admin.from("calendar_events").update({ assigned_to: null }).eq("assigned_to", userId),
    admin.from("calendar_events").update({ created_by: null }).eq("created_by", userId),
    admin.from("documents").update({ uploaded_by: null }).eq("uploaded_by", userId),
    admin.from("invoices").update({ created_by: null }).eq("created_by", userId),
    admin.from("budgets").update({ created_by: null }).eq("created_by", userId),
    // ビジネスレコードの NOT NULL FK → null にセット（nullable 化前の互換）
    admin.from("announcements").update({ author_id: null }).eq("author_id", userId),
    admin.from("workflow_requests").update({ requester_id: null }).eq("requester_id", userId),
    admin.from("workflow_steps").update({ approver_id: null }).eq("approver_id", userId),
    // ユーザー固有レコードは削除
    admin.from("attendance_comments").delete().eq("user_id", userId),
    admin.from("announcement_reads").delete().eq("user_id", userId),
    admin.from("announcement_comments").delete().eq("user_id", userId),
    admin.from("workflow_comments").delete().eq("user_id", userId),
    admin.from("email_accounts").delete().eq("user_id", userId),
  ]);

  // auth.users 削除 → profiles も CASCADE で削除される
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
