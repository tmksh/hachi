"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth";
import { selectAnnouncementsForNotifications } from "@/lib/announcement-select";
import { announcementActionHref, extractDetailHref } from "@/lib/notification-href";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

export type Notification = {
  id: string;
  type: "announcement" | "workflow" | "calendar" | "sales_flow";
  title: string;
  body?: string;
  href: string;
  created_at: string;
  is_urgent?: boolean;
};

export async function getNotifications(): Promise<Notification[]> {
  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) return [];

  const now = new Date();
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in7daysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    { data: selfProfile },
    { data: readRecords },
    announcements,
    { data: pendingSteps },
    { data: upcomingEvents },
    { data: decidedRequests },
    { data: remandedSteps },
    { data: urgentSalesTodos },
  ] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("announcement_reads").select("announcement_id").eq("user_id", user.id),
    selectAnnouncementsForNotifications(supabase, 30),
    supabase
      .from("workflow_steps")
      .select("id, request_id, workflow_requests!inner(id, title, created_at)")
      .eq("approver_id", user.id)
      .eq("status", "pending")
      .limit(10),
    supabase
      .from("calendar_events")
      .select("id, title, start_at, category, location")
      .gte("start_at", now.toISOString())
      .lte("start_at", in7days.toISOString())
      .order("start_at", { ascending: false })
      .limit(10),
    supabase
      .from("workflow_requests")
      .select("id, title, status, decided_at, payload")
      .eq("requester_id", user.id)
      .in("status", ["approved", "rejected"])
      .gte("decided_at", in7daysAgo.toISOString())
      .order("decided_at", { ascending: false })
      .limit(10),
    supabase
      .from("workflow_steps")
      .select("id, request_id, decided_at, comment, workflow_requests!inner(title, requester_id, status, payload)")
      .eq("workflow_requests.requester_id", user.id)
      .eq("workflow_requests.status", "rejected")
      .eq("status", "rejected")
      .gte("decided_at", in7daysAgo.toISOString())
      .order("decided_at", { ascending: false })
      .limit(10),
    supabase
      .from("todos")
      .select("id, title, description, due_date, customer_id, deal_id, created_at, tags, priority")
      .eq("assigned_to", user.id)
      .neq("status", "completed")
      .or("priority.eq.high,tags.cs.{due_today},tags.cs.{notify_flag}")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const selfRole: string | null = selfProfile?.role ?? null;
  const readIdSet = new Set((readRecords || []).map((r) => r.announcement_id));

  const announcementNotifs: Notification[] = announcements
    .filter((a) => !readIdSet.has(a.id))
    .filter((a) => {
      if (a.target_type === "individuals") {
        const targets: string[] = a.target_user_ids ?? [];
        return targets.length === 0 || targets.includes(user.id);
      }
      if (a.target_type !== "roles") return true;
      const targets: string[] = a.target_roles ?? [];
      if (targets.length === 0) return true;
      return selfRole ? targets.includes(selfRole) : false;
    })
    .map((a) => ({
      id: `ann_${a.id}`,
      type: "announcement" as const,
      title: a.title,
      body: a.body ?? undefined,
      href: announcementActionHref(a),
      created_at: a.published_at,
      is_urgent: a.is_urgent ?? undefined,
    }));

  type PendingStep = {
    id: string;
    request_id: string;
    workflow_requests: { id: string; title: string; created_at: string } | Array<{
      id: string;
      title: string;
      created_at: string;
    }>;
  };

  const workflowNotifs: Notification[] = ((pendingSteps as PendingStep[] | null) ?? []).map((s) => {
    const wfr = s.workflow_requests;
    const req = Array.isArray(wfr) ? wfr[0] : wfr;
    return {
      id: `wf_${req?.id ?? s.request_id}`,
      type: "workflow" as const,
      title: `承認依頼: ${req?.title ?? ""}`,
      href: `/workflow/${req?.id ?? s.request_id}`,
      created_at: req?.created_at ?? s.id,
      is_urgent: false,
    };
  });

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

  const decidedNotifs: Notification[] = (decidedRequests || []).map((r) => {
    const payload = (r as { payload?: Record<string, unknown> }).payload;
    const isRemand = r.status === "rejected" && payload?.remand === true;
    return {
      id: `wf_decided_${r.id}`,
      type: "workflow" as const,
      title: r.status === "approved"
        ? `承認されました: ${r.title}`
        : isRemand
          ? `差戻しされました: ${r.title}`
          : `却下されました: ${r.title}`,
      href: `/workflow/${r.id}`,
      created_at: r.decided_at ?? r.id,
      is_urgent: r.status === "rejected",
    };
  });

  type RemandStep = {
    id: string;
    request_id: string;
    decided_at: string | null;
    comment: string | null;
    workflow_requests: { title: string; payload?: Record<string, unknown> } | { title: string; payload?: Record<string, unknown> }[];
  };

  const remandNotifs: Notification[] = ((remandedSteps as RemandStep[] | null) ?? [])
    .filter((s) => {
      const wfr = s.workflow_requests;
      const req = Array.isArray(wfr) ? wfr[0] : wfr;
      return Boolean(req?.payload?.remand);
    })
    .map((s) => {
      const wfr = s.workflow_requests;
      const req = Array.isArray(wfr) ? wfr[0] : wfr;
      return {
        id: `wf_remand_${s.id}`,
        type: "workflow" as const,
        title: `差戻しされました: ${req?.title ?? ""}`,
        body: s.comment ?? undefined,
        href: `/workflow/${s.request_id}`,
        created_at: s.decided_at ?? s.id,
        is_urgent: true,
      };
    });

  const salesFlowNotifs: Notification[] = (urgentSalesTodos ?? []).map((t) => {
    const href = extractDetailHref(t.description)
      ?? (t.customer_id ? `/crm/${t.customer_id}` : "/dashboard");
    return {
      id: `sf_${t.id}`,
      type: "sales_flow" as const,
      title: t.title,
      body: t.description ?? undefined,
      href,
      created_at: t.created_at,
      is_urgent: true,
    };
  });

  return [
    ...announcementNotifs,
    ...workflowNotifs,
    ...decidedNotifs,
    ...remandNotifs,
    ...salesFlowNotifs,
    ...calendarNotifs,
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 50);
}

export async function notifyManagerOfOverload(urgentCount: number): Promise<{ managerName: string | null }> {
  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) return { managerName: null };

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("company_id, display_name")
    .eq("id", user.id)
    .single();

  if (!myProfile) return { managerName: null };

  const { data: managers } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("company_id", myProfile.company_id)
    .in("role", ["owner", "hq_admin"])
    .neq("id", user.id);

  if (!managers || managers.length === 0) return { managerName: null };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: already } = await supabase
    .from("internal_messages")
    .select("id")
    .eq("sender_id", user.id)
    .eq("message_type", "chat")
    .gte("created_at", since)
    .ilike("content", "%緊急通知が%")
    .limit(1);
  if (already && already.length > 0) {
    return { managerName: managers[0].display_name };
  }

  const content = `⚠️ ${myProfile.display_name} さんの緊急通知が ${urgentCount} 件未対応になっています。確認を促してください。`;

  await Promise.all(
    managers.map((manager) =>
      supabase.from("internal_messages").insert({
        company_id: myProfile.company_id,
        sender_id: user.id,
        recipient_id: manager.id,
        content,
        message_type: "chat",
      })
    )
  );

  return { managerName: managers[0].display_name };
}

export async function markAnnouncementAsRead(announcementId: string) {
  await markAnnouncementsAsRead([announcementId]);
}

export async function markAnnouncementsAsRead(announcementIds: string[]) {
  const ids = [...new Set(announcementIds.map((id) => id.replace(/^ann_/, "").trim()).filter(Boolean))];
  if (ids.length === 0) return;
  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) return;
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) return;
  const readAt = new Date().toISOString();
  await supabase.from("announcement_reads").upsert(
    ids.map((announcement_id) => ({
      company_id: profile.company_id,
      announcement_id,
      user_id: user.id,
      read_at: readAt,
    })),
    { onConflict: "announcement_id,user_id" },
  );
}
