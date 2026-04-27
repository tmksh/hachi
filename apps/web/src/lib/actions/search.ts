"use server";

import { createClient } from "@/lib/supabase/server";

export type SearchResult = {
  id: string;
  type: "customer" | "construction" | "deal";
  title: string;
  subtitle: string;
  href: string;
};

export async function globalSearch(query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 1) return [];
  const q = query.trim();
  const supabase = await createClient();

  const [customers, constructions, deals] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, company_name")
      .is("deleted_at", null)
      .or(`name.ilike.%${q}%,company_name.ilike.%${q}%`)
      .limit(5),
    supabase
      .from("constructions")
      .select("id, title, construction_no, status")
      .or(`title.ilike.%${q}%,construction_no.ilike.%${q}%`)
      .limit(5),
    supabase
      .from("deals")
      .select("id, title, stage")
      .ilike("title", `%${q}%`)
      .limit(5),
  ]);

  const STATUS_LABELS: Record<string, string> = {
    preparing: "着工前", in_progress: "施工中", completed: "完工", suspended: "中断",
    inquiry: "問い合わせ", first_meeting: "初回面談", quote_submitted: "見積提出",
    negotiation: "交渉中", closing: "クロージング", won: "受注", lost: "失注",
  };

  const results: SearchResult[] = [
    ...(customers.data ?? []).map((c) => ({
      id: c.id,
      type: "customer" as const,
      title: c.name,
      subtitle: c.company_name ?? "個人",
      href: `/crm/${c.id}`,
    })),
    ...(constructions.data ?? []).map((c) => ({
      id: c.id,
      type: "construction" as const,
      title: c.title,
      subtitle: `${c.construction_no} · ${STATUS_LABELS[c.status] ?? c.status}`,
      href: `/constructions/${c.id}`,
    })),
    ...(deals.data ?? []).map((d) => ({
      id: d.id,
      type: "deal" as const,
      title: d.title,
      subtitle: STATUS_LABELS[d.stage] ?? d.stage,
      href: `/deals`,
    })),
  ];

  return results;
}
