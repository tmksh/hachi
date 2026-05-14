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
  // TODO フェーズ2: 直近7日のみに戻す。現在はテスト用に1ヶ月前〜1週間後の予定を通知として表示。
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in7daysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const { data: selfProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const selfRole: string | null = selfProfile?.role ?? null;

  const [
    { data: readRecords },
    { data: announcements },
    { data: pendingSteps },
    { data: upcomingEvents },
    { data: decidedRequests },
    { data: remandedSteps },
  ] = await Promise.all([
    supabase.from("announcement_reads").select("announcement_id").eq("user_id", user.id),
    supabase
      .from("announcements")
      .select("id, title, body, is_urgent, published_at, target_type, target_roles")
      .order("published_at", { ascending: false })
      .limit(30),
    supabase.from("workflow_steps").select("id, request_id").eq("approver_id", user.id).eq("status", "pending").limit(10),
    supabase
      .from("calendar_events")
      .select("id, title, start_at, category, location")
      .gte("start_at", oneMonthAgo.toISOString())
      .lte("start_at", in7days.toISOString())
      .order("start_at", { ascending: false })
      .limit(10),
    // 自分の申請が承認済 or 却下された（7日以内）
    supabase
      .from("workflow_requests")
      .select("id, title, status, decided_at")
      .eq("requester_id", user.id)
      .in("status", ["approved", "rejected"])
      .gte("decided_at", in7daysAgo.toISOString())
      .order("decided_at", { ascending: false })
      .limit(10),
    // 自分の申請が差戻しされた（7日以内に step が rejected になり、申請全体は submitted に戻った）
    supabase
      .from("workflow_steps")
      .select("id, request_id, decided_at, comment, workflow_requests!inner(title, requester_id, status)")
      .eq("workflow_requests.requester_id", user.id)
      .eq("workflow_requests.status", "submitted")
      .eq("status", "rejected")
      .gte("decided_at", in7daysAgo.toISOString())
      .order("decided_at", { ascending: false })
      .limit(10),
  ]);

  const readIdSet = new Set((readRecords || []).map((r) => r.announcement_id));

  // 回覧通知（未読 & 現在ユーザーのロールが対象に含まれるもののみ）
  const announcementNotifs: Notification[] = (announcements || [])
    .filter((a) => !readIdSet.has(a.id))
    .filter((a) => {
      if (a.target_type !== "roles") return true;
      const targets: string[] = (a.target_roles as string[] | null) ?? [];
      if (targets.length === 0) return true;
      return selfRole ? targets.includes(selfRole) : false;
    })
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

  // 自分の申請への結果通知（承認済・却下）
  const decidedNotifs: Notification[] = (decidedRequests || []).map((r) => ({
    id: `wf_decided_${r.id}`,
    type: "workflow" as const,
    title: r.status === "approved" ? `承認されました: ${r.title}` : `却下されました: ${r.title}`,
    href: `/workflow/${r.id}`,
    created_at: r.decided_at ?? r.id,
    is_urgent: r.status === "rejected",
  }));

  // 自分の申請への差戻し通知
  type RemandStep = { id: string; request_id: string; decided_at: string | null; comment: string | null; workflow_requests: { title: string } | { title: string }[] };
  const remandNotifs: Notification[] = (remandedSteps || []).map((s) => {
    const req = Array.isArray((s as RemandStep).workflow_requests) ? (s as RemandStep).workflow_requests[0] : (s as RemandStep).workflow_requests;
    return {
      id: `wf_remand_${s.id}`,
      type: "workflow" as const,
      title: `差戻しされました: ${(req as { title: string }).title}`,
      body: (s as RemandStep).comment ?? undefined,
      href: `/workflow/${s.request_id}`,
      created_at: (s as RemandStep).decided_at ?? s.id,
      is_urgent: true,
    };
  });

  return [...announcementNotifs, ...workflowNotifs, ...decidedNotifs, ...remandNotifs, ...calendarNotifs]
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
