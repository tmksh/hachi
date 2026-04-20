"use server";

import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

export type Notification = {
  id: string;
  type: "announcement" | "workflow" | "calendar";
  title: string;
  body?: string;
  href: string;
  created_at: string;
  is_urgent?: boolean;
};

export async function getNotifications(): Promise<Notification[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const now = new Date();
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    { data: readRecords },
    { data: announcements },
    { data: pendingSteps },
    { data: upcomingEvents },
  ] = await Promise.all([
    supabase.from("announcement_reads").select("announcement_id").eq("user_id", user.id),
    supabase.from("announcements").select("id, title, body, is_urgent, published_at").order("published_at", { ascending: false }).limit(30),
    supabase.from("workflow_steps").select("id, request_id").eq("approver_id", user.id).eq("status", "pending").limit(10),
    supabase
      .from("calendar_events")
      .select("id, title, start_at, category, location")
      .gte("start_at", now.toISOString())
      .lte("start_at", in7days.toISOString())
      .order("start_at")
      .limit(5),
  ]);

  const readIdSet = new Set((readRecords || []).map((r) => r.announcement_id));

  // 回覧通知
  const announcementNotifs: Notification[] = (announcements || [])
    .filter((a) => !readIdSet.has(a.id))
    .map((a) => ({
      id: `ann_${a.id}`,
      type: "announcement" as const,
      title: a.title,
      body: a.body,
      href: `/circulation/${a.id}`,
      created_at: a.published_at,
      is_urgent: a.is_urgent,
    }));

  // ワークフロー承認依頼通知
  let workflowNotifs: Notification[] = [];
  if (pendingSteps && pendingSteps.length > 0) {
    const requestIds = pendingSteps.map((s) => s.request_id);
    const { data: requests } = await supabase
      .from("workflow_requests")
      .select("id, title, created_at")
      .in("id", requestIds);

    workflowNotifs = (requests || []).map((r) => ({
      id: `wf_${r.id}`,
      type: "workflow" as const,
      title: `承認依頼: ${r.title}`,
      href: `/workflow/${r.id}`,
      created_at: r.created_at,
      is_urgent: false,
    }));
  }

  // カレンダー直近予定通知（7日以内）
  const calendarNotifs: Notification[] = (upcomingEvents || []).map((ev) => {
    const dateLabel = format(new Date(ev.start_at), "M/d(E) HH:mm", { locale: ja });
    return {
      id: `cal_${ev.id}`,
      type: "calendar" as const,
      title: ev.title,
      body: `${dateLabel}${ev.location ? `　${ev.location}` : ""}`,
      href: `/calendar`,
      created_at: ev.start_at,
      is_urgent: false,
    };
  });

  return [...announcementNotifs, ...workflowNotifs, ...calendarNotifs]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20);
}

export async function markAnnouncementAsRead(announcementId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) return;

  await supabase.from("announcement_reads").upsert({
    company_id: profile.company_id,
    announcement_id: announcementId,
    user_id: user.id,
    read_at: new Date().toISOString(),
  }, { onConflict: "announcement_id,user_id" });
}
