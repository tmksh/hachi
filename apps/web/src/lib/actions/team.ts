"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResend, FROM_EMAIL, buildInviteEmailHtml } from "@/lib/resend";
import type { Profile } from "@/lib/database.types";
import type { AssignableRole } from "@/lib/constants";

export type TeamRole = AssignableRole;

async function assertTenantAdmin(): Promise<{
  companyId: string;
  actorRole: TeamRole;
  actorId: string;
}> {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) throw new Error("認証が必要です");

  const { data: me, error } = await authClient
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .single();
  if (error || !me) throw new Error("プロフィールが取得できません");

  if (me.role !== "hq_admin") {
    throw new Error("メンバー管理は本部管理者権限が必要です");
  }

  return {
    companyId: me.company_id,
    actorRole: me.role as TeamRole,
    actorId: user.id,
  };
}

function assertCanAssignRole(actorRole: TeamRole, targetRole: TeamRole) {
  if (actorRole !== "hq_admin") {
    throw new Error("メンバー管理は本部管理者権限が必要です");
  }
  // 本部管理者は全ロールを割り当て可能（自分自身の降格は updateTeamMemberRole で禁止）
  void targetRole;
}

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

export async function inviteTeamMember(input: {
  email: string;
  displayName: string;
  role: TeamRole;
  password?: string;
}): Promise<void> {
  const { companyId, actorRole, actorId } = await assertTenantAdmin();
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
    // パスワード直接設定：即時アカウント作成（メール送信なし）
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
    // Resend で招待メールを送信
    const redirectTo = `${appUrl}/api/auth/accept-invite`;

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "invite",
      email: input.email.trim(),
      options: {
        redirectTo,
        data: userMeta,
      },
    });
    if (linkError) {
      if ((linkError as { code?: string }).code === "email_exists") {
        throw new Error("このメールアドレスはすでに登録されています。別のメールアドレスをお使いください。");
      }
      throw new Error(linkError.message);
    }

    // 招待者の表示名を取得
    const { data: actorProfile } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", actorId)
      .single();

    // 会社名を取得
    const { data: company } = await admin
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .single();

    const inviteUrl = linkData.properties.action_link;
    const companyName = company?.name ?? "業務管理システム";
    const inviterName = actorProfile?.display_name ?? "管理者";

    const { error: mailError } = await getResend().emails.send({
      from: FROM_EMAIL,
      to: input.email.trim(),
      subject: `【${companyName}】システムへのご招待`,
      html: buildInviteEmailHtml({
        inviteeName: input.displayName.trim(),
        inviterName,
        companyName,
        inviteUrl,
        appUrl,
      }),
    });
    if (mailError) {
      throw new Error(`招待メールの送信に失敗しました: ${mailError.message}`);
    }
  }
}

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

  const { error } = await admin
    .from("profiles")
    .update({ role })
    .eq("id", userId);
  if (error) throw error;
}

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

  await Promise.all([
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
    admin.from("announcements").update({ author_id: null }).eq("author_id", userId),
    admin.from("workflow_requests").update({ requester_id: null }).eq("requester_id", userId),
    admin.from("workflow_steps").update({ approver_id: null }).eq("approver_id", userId),
    admin.from("attendance_comments").delete().eq("user_id", userId),
    admin.from("announcement_reads").delete().eq("user_id", userId),
    admin.from("announcement_comments").delete().eq("user_id", userId),
    admin.from("workflow_comments").delete().eq("user_id", userId),
    admin.from("email_accounts").delete().eq("user_id", userId),
  ]);

  void actorRole;

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw error;
}

export async function resendTeamInvite(userId: string): Promise<void> {
  const { companyId, actorId } = await assertTenantAdmin();

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

  const appUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.NODE_ENV === "production"
      ? `https://${process.env.NEXT_PUBLIC_APP_DOMAIN ?? ""}`
      : "http://localhost:3000");

  const userMeta = {
    company_id: companyId,
    role: target.role,
    display_name: (target.display_name as string | null) ?? target.email,
  };

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "invite",
    email: target.email,
    options: {
      redirectTo: `${appUrl}/api/auth/accept-invite`,
      data: userMeta,
    },
  });
  if (linkError) throw new Error(linkError.message);

  const { data: actorProfile } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", actorId)
    .single();

  const { data: company } = await admin
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .single();

  const companyName = company?.name ?? "業務管理システム";
  const inviterName = actorProfile?.display_name ?? "管理者";
  const inviteeName = (target.display_name as string | null) ?? target.email;

  const { error: mailError } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: target.email,
    subject: `【${companyName}】招待メール（再送）`,
    html: buildInviteEmailHtml({
      inviteeName,
      inviterName,
      companyName,
      inviteUrl: linkData.properties.action_link,
      appUrl,
    }),
  });
  if (mailError) {
    throw new Error(`招待メールの再送に失敗しました: ${mailError.message}`);
  }
}
