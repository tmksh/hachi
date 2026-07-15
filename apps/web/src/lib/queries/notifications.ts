import { createClient } from "@/lib/supabase/client";
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

/** ブラウザ → Supabase 直結 */
export async function fetchNotifications(): Promise<Notification[]> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return [];

  const now = new Date();
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in7daysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    { data: selfProfile },
    { data: readRecords },
    { data: announcements },
    { data: pendingSteps },
    { data: upcomingEvents },
    { data: decidedRequests },
    { data: remandedSteps },
    { data: urgentSalesTodos },
  ] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("announcement_reads").select("announcement_id").eq("user_id", user.id),
    supabase
      .from("announcements")
      .select("id, title, body, is_urgent, published_at, target_type, target_roles, target_user_ids")
      .order("published_at", { ascending: false })
      .limit(30),
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

  const announcementNotifs: Notification[] = (announcements || [])
    .filter((a) => !readIdSet.has(a.id))
    .filter((a) => {
      if (a.target_type === "individuals") {
        const targets: string[] = (a.target_user_ids as string[] | null) ?? [];
        return targets.length === 0 || targets.includes(user.id);
      }
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
    const isRemand = r.status === "rejected" && Boolean(payload?.remand);
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

  const salesFlowNotifs: Notification[] = (urgentSalesTodos ?? []).map((t) => ({
    id: `sf_${t.id}`,
    type: "sales_flow" as const,
    title: t.title,
    body: t.description ?? undefined,
    href: t.customer_id ? `/crm/${t.customer_id}` : "/dashboard",
    created_at: t.created_at,
    is_urgent: true,
  }));

  return [
    ...announcementNotifs,
    ...workflowNotifs,
    ...decidedNotifs,
    ...remandNotifs,
    ...salesFlowNotifs,
    ...calendarNotifs,
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20);
}
