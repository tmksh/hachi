"use server";

import { createClient } from "@/lib/supabase/server";

export type Notification = {
  id: string;
  type: "announcement" | "workflow";
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

  const [
    { data: readRecords },
    { data: announcements },
    { data: pendingSteps },
  ] = await Promise.all([
    supabase.from("announcement_reads").select("announcement_id").eq("user_id", user.id),
    supabase.from("announcements").select("id, title, body, is_urgent, published_at").order("published_at", { ascending: false }).limit(30),
    supabase.from("workflow_steps").select("id, request_id").eq("approver_id", user.id).eq("status", "pending").limit(10),
  ]);

  const readIdSet = new Set((readRecords || []).map((r) => r.announcement_id));

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

  return [...announcementNotifs, ...workflowNotifs]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 15);
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
