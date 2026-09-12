import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type DbError = { message: string; code?: string } | null;

export function parseEstimateSequence(estimateNo: string): number {
  const match = estimateNo.match(/^EST-(?:\d{4}-)?(\d+)$/i);
  return match ? parseInt(match[1], 10) : 0;
}

export function isUniqueViolation(error: DbError): boolean {
  if (!error) return false;
  if (error.code === "23505") return true;
  const msg = (error.message ?? "").toLowerCase();
  return msg.includes("duplicate") || msg.includes("unique constraint") || msg.includes("already exists");
}

function formatEstimateNo(seq: number): string {
  return `EST-${String(seq).padStart(4, "0")}`;
}

/**
 * 見積番号を採番する。
 * RPC カウンターが既存番号より遅れていると UNIQUE(company_id, estimate_no) で
 * 毎回同じ番号に衝突するため、既存最大連番との大きい方を使う。
 */
export async function nextEstimateNo(supabase: Supabase, companyId: string): Promise<string> {
  const { data: seq, error: rpcError } = await supabase.rpc("next_document_number", { p_kind: "estimate" });
  const { data, error } = await supabase
    .from("estimates")
    .select("estimate_no")
    .eq("company_id", companyId)
    .limit(5000);
  if (error) throw new Error(error.message);

  const max = (data ?? []).reduce(
    (current, row) => Math.max(current, parseEstimateSequence(row.estimate_no)),
    0,
  );
  const rpcSeq = !rpcError && typeof seq === "number" && seq > 0 ? seq : 0;
  return formatEstimateNo(Math.max(rpcSeq, max + 1));
}

type InsertOnceResult = {
  data: { id: string } | null;
  error: DbError;
};

export async function allocateUniqueEstimateNo(
  supabase: Supabase,
  companyId: string,
  insert: (estimateNo: string) => unknown,
): Promise<{ id: string }> {
  let lastError: DbError = null;
  let lastSeq = 0;
  for (let attempt = 0; attempt < 8; attempt++) {
    const estimateNo =
      attempt === 0 ? await nextEstimateNo(supabase, companyId) : formatEstimateNo(lastSeq + 1);
    lastSeq = parseEstimateSequence(estimateNo);
    const { data, error } = (await Promise.resolve(insert(estimateNo))) as InsertOnceResult;
    if (!error && data?.id) return data;
    lastError = error;
    if (!isUniqueViolation(error)) break;
  }
  throw new Error(lastError?.message ?? "見積の作成に失敗しました");
}
