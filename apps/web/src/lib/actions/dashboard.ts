"use server";

import { createClient } from "@/lib/supabase/server";

export async function getDashboardData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [
    { count: customerCount },
    { count: dealCount },
    { data: deals },
    { data: constructions },
    { data: recentCustomers },
    { data: announcements },
    { data: todos },
    { data: calendarEvents },
    { count: pendingApprovals },
    { count: submittedRequests },
    { count: completedRequests },
  ] = await Promise.all([
    supabase.from("customers").select("*", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("deals").select("*", { count: "exact", head: true }),
    supabase.from("deals").select("stage, value"),
    supabase.from("constructions").select("id, title, status, progress, end_date, assigned_to, assignee:profiles!constructions_assigned_to_fkey(display_name)").in("status", ["in_progress", "preparing"]).order("end_date").limit(5),
    supabase.from("customers").select("id, name, company_name, status, created_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(5),
    supabase.from("announcements").select("id, title, body, pinned, is_urgent, published_at, author:profiles!announcements_author_id_fkey(display_name)").order("published_at", { ascending: false }).limit(5),
    supabase.from("todos").select("id, title, status, priority, due_date, assigned_to").in("status", ["pending", "in_progress"]).order("due_date").limit(10),
    supabase.from("calendar_events").select("id, title, start_at, end_at, category, color").gte("start_at", new Date().toISOString()).order("start_at").limit(5),
    user
      ? supabase.from("workflow_steps").select("*", { count: "exact", head: true }).eq("approver_id", user.id).eq("status", "pending")
      : Promise.resolve({ count: 0, data: null, error: null }),
    user
      ? supabase.from("workflow_requests").select("*", { count: "exact", head: true }).eq("requester_id", user.id).eq("status", "submitted")
      : Promise.resolve({ count: 0, data: null, error: null }),
    user
      ? supabase.from("workflow_requests").select("*", { count: "exact", head: true }).eq("requester_id", user.id).in("status", ["approved", "rejected"])
      : Promise.resolve({ count: 0, data: null, error: null }),
  ]);

  const pipelineValue = (deals || [])
    .filter((d) => !["won", "lost"].includes(d.stage))
    .reduce((sum, d) => sum + (d.value || 0), 0);

  const wonValue = (deals || [])
    .filter((d) => d.stage === "won")
    .reduce((sum, d) => sum + (d.value || 0), 0);

  const activeConstructions = (constructions || []).length;

  return {
    kpis: {
      customerCount: customerCount || 0,
      dealCount: dealCount || 0,
      pipelineValue,
      wonValue,
      activeConstructions,
    },
    constructions: constructions || [],
    recentCustomers: recentCustomers || [],
    announcements: announcements || [],
    todos: todos || [],
    calendarEvents: calendarEvents || [],
    workflow: {
      pendingApprovals: pendingApprovals || 0,
      submittedRequests: submittedRequests || 0,
      completedRequests: completedRequests || 0,
    },
  };
}
