"use server";

import { createClient } from "@/lib/supabase/server";
import type { Announcement } from "@/lib/database.types";

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
  if (error) throw error;

  // クライアント側でロールターゲティングを適用（target_type='roles' のみ絞り込み）
  return (data || []).filter((a) => {
    if (a.target_type !== "roles") return true;
    if (!role) return false;
    const targets: string[] = (a.target_roles as string[] | null) ?? [];
    if (targets.length === 0) return true;
    return targets.includes(role);
  });
}

export async function getAnnouncement(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("*, author:profiles!announcements_author_id_fkey(id, display_name)")
    .eq("id", id)
    .single();
  if (error) throw error;

  const { data: comments } = await supabase
    .from("announcement_comments")
    .select("*, user:profiles!announcement_comments_user_id_fkey(id, display_name)")
    .eq("announcement_id", id)
    .order("created_at");

  // Mark as read
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
    if (profile) {
      await supabase.from("announcement_reads").upsert({
        company_id: profile.company_id,
        announcement_id: id,
        user_id: user.id,
        read_at: new Date().toISOString(),
      }, { onConflict: "company_id,announcement_id,user_id" });
    }
  }

  return { ...data, comments: comments || [] };
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

  const target_type = input.target_type || "all";
  // roles を指定した時は target_type='roles' に自動補正
  const effectiveTargetType =
    input.target_roles && input.target_roles.length > 0 && target_type === "all"
      ? "roles"
      : target_type;

  const { data, error } = await supabase
    .from("announcements")
    .insert({
      company_id: profile.company_id,
      author_id: user.id,
      title: input.title,
      body: input.body,
      pinned: input.pinned || false,
      is_urgent: input.is_urgent || false,
      target_type: effectiveTargetType,
      target_roles: input.target_roles || [],
      target_departments: input.target_departments || [],
      due_date: input.due_date || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Announcement;
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
  if (error) throw error;
}

export async function deleteAnnouncement(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) throw error;
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
  if (error) throw error;
  return data;
}
