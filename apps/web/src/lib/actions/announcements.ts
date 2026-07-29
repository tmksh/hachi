"use server";

import { createClient } from "@/lib/supabase/server";
import { dispatchWebhook } from "@/lib/webhooks";
import type { Announcement } from "@/lib/database.types";
import { canUserViewAnnouncement } from "@/lib/announcement-visibility";

export async function getAnnouncements() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role: string | null = profile?.role ?? null;

  const { data, error } = await supabase
    .from("announcements")
    .select("*, author:profiles!announcements_author_id_fkey(id, display_name)")
    .order("pinned", { ascending: false })
    .order("published_at", { ascending: false });
  if (error) throw new Error(error.message);

  // ロールターゲティング（投稿者は常に自分の投稿を一覧に表示）
  return (data || []).filter((a) => canUserViewAnnouncement(a, user.id, role));
}

export async function getAnnouncement(id: string) {
  const supabase = await createClient();
  const [announcementRes, commentsRes, readsRes, authRes] = await Promise.all([
    supabase
      .from("announcements")
      .select("*, author:profiles!announcements_author_id_fkey(id, display_name)")
      .eq("id", id)
      .single(),
    supabase
      .from("announcement_comments")
      .select("*, user:profiles!announcement_comments_user_id_fkey(id, display_name)")
      .eq("announcement_id", id)
      .order("created_at"),
    supabase
      .from("announcement_reads")
      .select("user_id, read_at, user:profiles!announcement_reads_user_id_fkey(id, display_name)")
      .eq("announcement_id", id)
      .order("read_at", { ascending: false }),
    supabase.auth.getUser(),
  ]);
  if (announcementRes.error) throw new Error(announcementRes.error.message);

  const user = authRes.data.user;
  if (user && announcementRes.data) {
    const { data: profile } = await supabase.from("profiles").select("role, company_id").eq("id", user.id).single();
    const role = profile?.role ?? null;
    if (!canUserViewAnnouncement(announcementRes.data, user.id, role)) {
      throw new Error("このお知らせを閲覧する権限がありません");
    }
  }

  let markedRead = false;
  let readerName = "—";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id, display_name")
      .eq("id", user.id)
      .single();
    if (profile) {
      readerName = profile.display_name ?? "—";
      const now = new Date().toISOString();
      const { error: readErr } = await supabase.from("announcement_reads").upsert({
        company_id: profile.company_id,
        announcement_id: id,
        user_id: user.id,
        read_at: now,
      }, { onConflict: "company_id,announcement_id,user_id" });
      markedRead = !readErr;
    }
  }

  const reads = (readsRes.data ?? []).map((r) => ({
    user_id: r.user_id as string,
    read_at: r.read_at as string,
    display_name: (r.user as { display_name?: string } | null)?.display_name ?? "—",
  }));

  // 今回の既読をリストへ即反映（並列取得時点では未反映のため）
  if (user && markedRead && !reads.some((r) => r.user_id === user.id)) {
    reads.unshift({
      user_id: user.id,
      read_at: new Date().toISOString(),
      display_name: readerName,
    });
  }

  return {
    ...announcementRes.data,
    comments: commentsRes.data || [],
    reads,
    current_user_read: markedRead || reads.some((r) => r.user_id === user?.id),
  };
}

function isAnnouncementSchemaMismatch(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  // 23514 = check_violation, 42703 = undefined_column
  if (code === "23514" || code === "42703" || code === "PGRST204") return true;
  const msg = (error.message ?? "").toLowerCase();
  return (
    msg.includes("target_type")
    || msg.includes("target_roles")
    || msg.includes("check constraint")
    || msg.includes("does not exist")
    || msg.includes("schema cache")
  );
}

export async function createAnnouncement(input: {
  title: string;
  body: string;
  pinned?: boolean;
  is_urgent?: boolean;
  target_type?: Announcement["target_type"];
  target_roles?: string[];
  target_departments?: string[];
  due_date?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const roles = input.target_roles?.length ? input.target_roles : [];
  const target_type = input.target_type || "all";
  // roles を指定した時は target_type='roles' に自動補正
  const effectiveTargetType =
    roles.length > 0 && target_type === "all" ? "roles" : target_type;

  const base = {
    company_id: profile.company_id,
    author_id: user.id,
    title: input.title,
    body: input.body,
    pinned: input.pinned || false,
    is_urgent: input.is_urgent || false,
    due_date: input.due_date || null,
  };

  const publish = (data: Announcement) => {
    void dispatchWebhook(profile.company_id, "announcement.published", {
      id: data.id,
      title: data.title,
      is_urgent: data.is_urgent,
    });
    return data;
  };

  // ロール指定: target_type='roles' を試行。未マイグレーション時は個人指定へフォールバック
  if (effectiveTargetType === "roles" && roles.length > 0) {
    const { data, error } = await supabase
      .from("announcements")
      .insert({
        ...base,
        target_type: "roles",
        target_roles: roles,
        target_departments: input.target_departments || [],
      })
      .select()
      .single();

    if (!error && data) return publish(data as Announcement);

    if (error && !isAnnouncementSchemaMismatch(error)) {
      throw new Error(error.message || "投稿に失敗しました");
    }

    const { data: targets, error: profileErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("company_id", profile.company_id)
      .in("role", roles);

    if (profileErr) {
      throw new Error(profileErr.message || error?.message || "投稿に失敗しました");
    }

    const target_user_ids = [...new Set([...(targets ?? []).map((p) => p.id), user.id])];
    if (target_user_ids.length === 0) {
      throw new Error(
        "選択したロールに該当するユーザーがいません。"
          + (error?.message ? `（${error.message}）` : ""),
      );
    }

    // target_roles カラム未適用でも動くよう individuals のみで再試行
    const retry = await supabase
      .from("announcements")
      .insert({
        ...base,
        target_type: "individuals",
        target_user_ids,
        target_departments: [],
      })
      .select()
      .single();

    if (retry.error) {
      throw new Error(retry.error.message || error?.message || "投稿に失敗しました");
    }
    return publish(retry.data as Announcement);
  }

  const { data, error } = await supabase
    .from("announcements")
    .insert({
      ...base,
      target_type: effectiveTargetType,
      target_roles: roles,
      target_departments: input.target_departments || [],
    })
    .select()
    .single();

  if (error) {
    // target_roles カラム未適用時は当該カラムを除いて再試行
    if (isAnnouncementSchemaMismatch(error) && roles.length === 0) {
      const retry = await supabase
        .from("announcements")
        .insert({
          ...base,
          target_type: effectiveTargetType === "roles" ? "all" : effectiveTargetType,
          target_departments: input.target_departments || [],
        })
        .select()
        .single();
      if (retry.error) throw new Error(retry.error.message);
      return publish(retry.data as Announcement);
    }
    throw new Error(error.message);
  }

  return publish(data as Announcement);
}

export async function updateAnnouncement(id: string, input: {
  title?: string;
  body?: string;
  pinned?: boolean;
  is_urgent?: boolean;
  target_type?: Announcement["target_type"];
  target_roles?: string[];
  due_date?: string | null;
}) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("announcements")
    .update(input)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteAnnouncement(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインが必要です");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("プロフィールが見つかりません");

  const { data: ann, error: fetchErr } = await supabase
    .from("announcements")
    .select("id, author_id, company_id")
    .eq("id", id)
    .single();
  if (fetchErr || !ann) throw new Error("お知らせが見つかりません");
  if (ann.company_id !== profile.company_id) throw new Error("お知らせが見つかりません");

  const isAuthor = ann.author_id === user.id;
  const isAdmin = ["hq_admin", "admin", "owner"].includes(profile.role);
  if (!isAuthor && !isAdmin) throw new Error("削除権限がありません");

  // RLS の DELETE は hq_admin/owner のみのため、投稿者削除は 0 行になりがち → 件数確認＋admin フォールバック
  const { data: deleted, error } = await supabase
    .from("announcements")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  if (deleted?.length) return;

  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const retry = await admin
      .from("announcements")
      .delete()
      .eq("id", id)
      .eq("company_id", profile.company_id)
      .select("id");
    if (retry.error) throw new Error(retry.error.message);
    if (!retry.data?.length) throw new Error("削除に失敗しました");
  } catch (e) {
    if (e instanceof Error && e.message) throw e;
    throw new Error("削除に失敗しました");
  }
}

export async function addAnnouncementComment(announcementId: string, message: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const { data, error } = await supabase
    .from("announcement_comments")
    .insert({
      company_id: profile.company_id,
      announcement_id: announcementId,
      user_id: user.id,
      message,
    })
    .select("*, user:profiles!announcement_comments_user_id_fkey(id, display_name)")
    .single();
  if (error) throw new Error(error.message);
  return data;
}
