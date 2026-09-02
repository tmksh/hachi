"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResend, INVITE_FROM_EMAIL, buildInviteEmailHtml } from "@/lib/resend";
import type { Profile } from "@/lib/database.types";
import type { AssignableRole } from "@/lib/constants";
import {
  readMemberCustomRoles,
  resolveRoleSelection,
  type CustomRoleRef,
} from "@/lib/role-assignment";

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

async function loadCompanyRoleSettings(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
): Promise<{ settings: Record<string, unknown>; customRoles: CustomRoleRef[] }> {
  const { data: company } = await admin
    .from("companies")
    .select("settings")
    .eq("id", companyId)
    .maybeSingle();
  const settings = (company?.settings ?? {}) as Record<string, unknown>;
  const customRoles = Array.isArray(settings.custom_roles)
    ? (settings.custom_roles as CustomRoleRef[])
    : [];
  return { settings, customRoles };
}

async function persistMemberCustomRole(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  userId: string,
  customRoleId: string | null,
  settings?: Record<string, unknown>,
) {
  const { data: company } = await admin
    .from("companies")
    .select("settings")
    .eq("id", companyId)
    .maybeSingle();
  const latest = ((company?.settings ?? settings ?? {}) as Record<string, unknown>);
  const map = { ...readMemberCustomRoles(latest) };
  if (customRoleId) map[userId] = customRoleId;
  else delete map[userId];
  const { error } = await admin
    .from("companies")
    .update({ settings: { ...latest, member_custom_roles: map } })
    .eq("id", companyId);
  if (error) throw error;
}

export async function listTeamMembers(): Promise<Profile[]> {
  const { companyId } = await assertTenantAdmin();
  const admin = createAdminClient();

  // 招待済みだが profiles 未作成のユーザーを同期（再送ボタンを出せるようにする）
  await syncInvitedProfiles(admin, companyId);

  const [{ data, error }, { settings }] = await Promise.all([
    admin
      .from("profiles")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    loadCompanyRoleSettings(admin, companyId),
  ]);
  if (error) throw error;
  const customMap = readMemberCustomRoles(settings);
  return ((data ?? []) as Profile[]).map((m) => ({
    ...m,
    custom_role_id: customMap[m.id] ?? null,
  }));
}

/** auth にいるが profiles が無い招待ユーザーを profiles に補完する */
async function syncInvitedProfiles(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
) {
  try {
    const { data: authData, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (error || !authData?.users?.length) return;

    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("company_id", companyId);
    const existingIds = new Set((existing ?? []).map((p) => p.id));

    const missing = authData.users.filter((u) => {
      const meta = (u.user_metadata ?? {}) as { company_id?: string };
      return meta.company_id === companyId && !existingIds.has(u.id);
    });

    for (const u of missing) {
      const meta = (u.user_metadata ?? {}) as {
        display_name?: string;
        role?: string;
      };
      const { error: insertErr } = await admin.from("profiles").insert({
        id: u.id,
        company_id: companyId,
        display_name: meta.display_name?.trim() || u.email || "招待中",
        email: u.email ?? "",
        role: meta.role || "employee",
      });
      if (insertErr) console.error("[syncInvitedProfiles] insert failed", u.id, insertErr);
    }
  } catch (e) {
    console.error("[syncInvitedProfiles] failed", e);
  }
}

export type InviteResult = {
  ok: boolean;
  /** ok=false のときのユーザー向けエラーメッセージ */
  error?: string;
  /** 招待メールを送信できたか */
  emailSent?: boolean;
  /** メール未送信時に管理者が手動共有するための招待リンク */
  inviteUrl?: string;
};

/** 既存の招待ユーザーを見つけてプロフィール補完し、招待メールを再送する */
async function recoverAndResendInvite(input: {
  admin: ReturnType<typeof createAdminClient>;
  companyId: string;
  actorId: string;
  email: string;
  displayName: string;
  role: TeamRole;
  customRoleId?: string | null;
  appUrl: string;
}): Promise<InviteResult> {
  const { admin, companyId, actorId, email, displayName, role, customRoleId, appUrl } = input;

  const { data: authData, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) {
    return { ok: false, error: `既存ユーザーの確認に失敗しました: ${listErr.message}` };
  }
  const user = (authData?.users ?? []).find(
    (u) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
  );
  if (!user) {
    return { ok: false, error: "このメールアドレスはすでに登録されています。別のメールアドレスをお使いください。" };
  }

  const { data: existing } = await admin
    .from("profiles")
    .select("id, company_id")
    .eq("id", user.id)
    .maybeSingle();

  if (existing && existing.company_id !== companyId) {
    return { ok: false, error: "このメールアドレスは別の組織で使用されています。" };
  }

  if (!existing) {
    const { error: insertErr } = await admin.from("profiles").insert({
      id: user.id,
      company_id: companyId,
      display_name: displayName,
      email,
      role,
    });
    if (insertErr) {
      return { ok: false, error: `プロフィール作成に失敗しました: ${insertErr.message}` };
    }
  } else {
    await admin.from("profiles").update({
      display_name: displayName,
      role,
      updated_at: new Date().toISOString(),
    }).eq("id", user.id);
  }

  const { settings } = await loadCompanyRoleSettings(admin, companyId);
  await persistMemberCustomRole(admin, companyId, user.id, customRoleId ?? null, settings);

  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { company_id: companyId, role, display_name: displayName, custom_role_id: customRoleId ?? null },
  });

  // 既存ユーザーへの再招待は invite が弾かれることがあるため recovery も試す
  let hashedToken: string | null = null;
  let linkType: "invite" | "recovery" = "invite";

  const inviteAttempt = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      redirectTo: `${appUrl}/api/auth/accept-invite`,
      data: { company_id: companyId, role, display_name: displayName },
    },
  });
  if (!inviteAttempt.error && inviteAttempt.data.properties.hashed_token) {
    hashedToken = inviteAttempt.data.properties.hashed_token;
  } else {
    const recoveryAttempt = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${appUrl}/update-password?from=invite` },
    });
    if (recoveryAttempt.error || !recoveryAttempt.data.properties.hashed_token) {
      return {
        ok: false,
        error: `招待の再送に失敗しました: ${inviteAttempt.error?.message ?? recoveryAttempt.error?.message ?? "不明なエラー"}`,
      };
    }
    hashedToken = recoveryAttempt.data.properties.hashed_token;
    linkType = "recovery";
  }

  const inviteUrl = `${appUrl}/api/auth/accept-invite?token_hash=${encodeURIComponent(hashedToken)}&type=${linkType}`;

  const { data: actorProfile } = await admin
    .from("profiles").select("display_name").eq("id", actorId).single();
  const { data: company } = await admin
    .from("companies").select("name").eq("id", companyId).single();
  const companyName = company?.name ?? "業務管理システム";
  const inviterName = actorProfile?.display_name ?? "管理者";

  if (!process.env.RESEND_API_KEY) {
    return {
      ok: true,
      emailSent: false,
      inviteUrl,
      error: "すでに招待済みのため一覧に追加しました。RESEND_API_KEY 未設定のためメールは未送信です。招待リンクを共有してください。",
    };
  }

  const { error: mailError } = await getResend().emails.send({
    from: INVITE_FROM_EMAIL,
    to: email,
    subject: `【${companyName}】システムへのご招待（再送）`,
    html: buildInviteEmailHtml({
      inviteeName: displayName,
      inviterName,
      companyName,
      inviteUrl,
      appUrl,
    }),
  });
  if (mailError) {
    return {
      ok: true,
      emailSent: false,
      inviteUrl,
      error: `一覧に追加しましたがメール送信に失敗しました（${mailError.message}）。招待リンクを共有してください。`,
    };
  }

  return { ok: true, emailSent: true };
}

/**
 * メンバー招待。
 * 本番ビルドではサーバーアクションの throw が汎用エラーに握りつぶされるため、
 * 例外ではなく InviteResult でエラー内容を返す。
 */
export async function inviteTeamMember(input: {
  email: string;
  displayName: string;
  role: string;
  password?: string;
}): Promise<InviteResult> {
  try {
    return await inviteTeamMemberInner(input);
  } catch (e) {
    console.error("[inviteTeamMember] failed", e);
    return { ok: false, error: e instanceof Error ? e.message : "メンバー追加に失敗しました" };
  }
}

async function inviteTeamMemberInner(input: {
  email: string;
  displayName: string;
  role: string;
  password?: string;
}): Promise<InviteResult> {
  const { companyId, actorRole, actorId } = await assertTenantAdmin();
  const admin = createAdminClient();
  const { settings, customRoles } = await loadCompanyRoleSettings(admin, companyId);
  const resolved = resolveRoleSelection(input.role, customRoles);
  assertCanAssignRole(actorRole, resolved.role);

  if (!input.email.trim()) return { ok: false, error: "メールアドレスは必須です" };
  if (!input.displayName.trim()) return { ok: false, error: "表示名は必須です" };

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      ok: false,
      error: "サーバーに SUPABASE_SERVICE_ROLE_KEY が設定されていません。デプロイ環境の環境変数を確認してください。",
    };
  }

  const appUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.NODE_ENV === "production"
      ? `https://${process.env.NEXT_PUBLIC_APP_DOMAIN ?? ""}`
      : "http://localhost:3000");

  const userMeta = {
    company_id: companyId,
    role: resolved.role,
    display_name: input.displayName.trim(),
    custom_role_id: resolved.customRoleId,
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
        return { ok: false, error: "このメールアドレスはすでに登録されています。別のメールアドレスをお使いください。" };
      }
      return { ok: false, error: `アカウント作成に失敗しました: ${error.message}` };
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
        role: resolved.role,
      });
      if (profileError) {
        return { ok: false, error: `プロフィール作成に失敗しました: ${profileError.message}` };
      }
    }
    await persistMemberCustomRole(admin, companyId, userId, resolved.customRoleId, settings);
    return { ok: true, emailSent: false };
  }

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
    // すでに招待済み（auth にいる）場合はプロフィールを補完して再送扱いにする
    if ((linkError as { code?: string }).code === "email_exists") {
      const recovered = await recoverAndResendInvite({
        admin,
        companyId,
        actorId,
        email: input.email.trim(),
        displayName: input.displayName.trim(),
        role: resolved.role,
        customRoleId: resolved.customRoleId,
        appUrl,
      });
      return recovered;
    }
    return { ok: false, error: `招待リンクの生成に失敗しました: ${linkError.message}` };
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

  const hashedToken = linkData.properties.hashed_token;
  if (!hashedToken) {
    return { ok: false, error: "招待トークンの生成に失敗しました。もう一度お試しください。" };
  }
  // action_link（Supabase verify経由）だと redirect 後に token_hash が付かず
  // /api/auth/accept-invite が無効扱いになるため、hashed_token で直接組み立てる
  const inviteUrl = `${appUrl}/api/auth/accept-invite?token_hash=${encodeURIComponent(hashedToken)}&type=invite`;
  const companyName = company?.name ?? "業務管理システム";
  const inviterName = actorProfile?.display_name ?? "管理者";

  // メンバー一覧・再送ができるよう、招待時点で profiles を作成する
  const invitedUserId = linkData.user?.id;
  if (invitedUserId) {
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("id", invitedUserId)
      .maybeSingle();
    if (!existingProfile) {
      const { error: profileError } = await admin.from("profiles").insert({
        id: invitedUserId,
        company_id: companyId,
        display_name: input.displayName.trim(),
        email: input.email.trim(),
        role: resolved.role,
      });
      if (profileError) {
        console.error("[inviteTeamMember] profile insert failed", profileError);
      }
    }
    await persistMemberCustomRole(admin, companyId, invitedUserId, resolved.customRoleId, settings);
  }

  // メール送信に失敗してもアカウント（招待）自体は作成済みのため、
  // 招待リンクを返して管理者が手動共有できるようにする
  if (!process.env.RESEND_API_KEY) {
    return {
      ok: true,
      emailSent: false,
      inviteUrl,
      error: "RESEND_API_KEY が未設定のため招待メールは送信されませんでした。招待リンクを直接共有してください。",
    };
  }

  const { error: mailError } = await getResend().emails.send({
    from: INVITE_FROM_EMAIL,
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
    return {
      ok: true,
      emailSent: false,
      inviteUrl,
      error: `招待メールの送信に失敗しました（${mailError.message}）。招待リンクを直接共有してください。`,
    };
  }

  return { ok: true, emailSent: true };
}

export async function updateTeamMemberRole(userId: string, role: string) {
  const { companyId, actorRole, actorId } = await assertTenantAdmin();

  if (userId === actorId) {
    throw new Error("自分自身のロールは変更できません");
  }

  const admin = createAdminClient();
  const { settings, customRoles } = await loadCompanyRoleSettings(admin, companyId);
  const resolved = resolveRoleSelection(role, customRoles);
  assertCanAssignRole(actorRole, resolved.role);

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
    .update({ role: resolved.role })
    .eq("id", userId);
  if (error) throw error;

  await persistMemberCustomRole(admin, companyId, userId, resolved.customRoleId, settings);
}

/** 従業員区分の変更（No.77/78: BIの1人当たり利益の係数に使用。正社員=1.0 / パート=0.5） */
export async function updateTeamMemberEmploymentType(
  userId: string,
  employmentType: "full_time" | "part_time",
) {
  const { companyId } = await assertTenantAdmin();

  const admin = createAdminClient();

  const { data: target } = await admin
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .single();
  if (!target || target.company_id !== companyId) {
    throw new Error("対象メンバーが自社に属していません");
  }

  const { error } = await admin
    .from("profiles")
    .update({ employment_type: employmentType })
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

  let hashedToken: string | null = null;
  let linkType: "invite" | "recovery" = "invite";

  const inviteAttempt = await admin.auth.admin.generateLink({
    type: "invite",
    email: target.email,
    options: {
      redirectTo: `${appUrl}/api/auth/accept-invite`,
      data: userMeta,
    },
  });
  if (!inviteAttempt.error && inviteAttempt.data.properties.hashed_token) {
    hashedToken = inviteAttempt.data.properties.hashed_token;
  } else {
    const recoveryAttempt = await admin.auth.admin.generateLink({
      type: "recovery",
      email: target.email,
      options: { redirectTo: `${appUrl}/update-password?from=invite` },
    });
    if (recoveryAttempt.error || !recoveryAttempt.data.properties.hashed_token) {
      throw new Error(
        inviteAttempt.error?.message
          ?? recoveryAttempt.error?.message
          ?? "招待リンクの生成に失敗しました",
      );
    }
    hashedToken = recoveryAttempt.data.properties.hashed_token;
    linkType = "recovery";
  }

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

  const inviteUrl = `${appUrl}/api/auth/accept-invite?token_hash=${encodeURIComponent(hashedToken)}&type=${linkType}`;

  const { error: mailError } = await getResend().emails.send({
    from: INVITE_FROM_EMAIL,
    to: target.email,
    subject: `【${companyName}】招待メール（再送）`,
    html: buildInviteEmailHtml({
      inviteeName,
      inviterName,
      companyName,
      inviteUrl,
      appUrl,
    }),
  });
  if (mailError) {
    throw new Error(`招待メールの再送に失敗しました: ${mailError.message}`);
  }
}
