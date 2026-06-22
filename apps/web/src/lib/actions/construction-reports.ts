"use server";

import { createClient } from "@/lib/supabase/server";

export type ConstructionReport = {
  id: string;
  construction_id: string;
  author_id: string;
  report_date: string;
  title: string;
  weather: string;
  content: string;
  workers_count: number | null;
  progress_note: string | null;
  issues: string | null;
  created_at: string;
  updated_at: string;
  author?: { display_name: string } | null;
};

export type CreateReportInput = {
  report_date: string;
  title: string;
  weather: string;
  content: string;
  workers_count?: number | null;
  progress_note?: string | null;
  issues?: string | null;
};

export async function createConstructionReport(
  constructionId: string,
  input: CreateReportInput
): Promise<ConstructionReport> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("Profile not found");

  const { data, error } = await supabase
    .from("construction_reports")
    .insert({
      company_id: profile.company_id,
      construction_id: constructionId,
      author_id: user.id,
      report_date: input.report_date,
      title: input.title,
      weather: input.weather,
      content: input.content,
      workers_count: input.workers_count ?? null,
      progress_note: input.progress_note ?? null,
      issues: input.issues ?? null,
    })
    .select("*, author:profiles(display_name)")
    .single();

  if (error) throw error;
  return data as ConstructionReport;
}

export async function getConstructionReports(
  constructionId: string
): Promise<ConstructionReport[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("construction_reports")
    .select("*, author:profiles(display_name)")
    .eq("construction_id", constructionId)
    .order("report_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ConstructionReport[];
}

export async function getConstructionReport(
  reportId: string
): Promise<ConstructionReport | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("construction_reports")
    .select("*, author:profiles(display_name)")
    .eq("id", reportId)
    .single();

  if (error) return null;
  return data as ConstructionReport;
}

export async function updateConstructionReport(
  reportId: string,
  input: Partial<CreateReportInput>
): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("construction_reports")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", reportId);

  if (error) throw error;
}

export async function deleteConstructionReport(reportId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("construction_reports")
    .delete()
    .eq("id", reportId);

  if (error) throw error;
}
