import { createClient } from "@/lib/supabase/server";
import { generateEstimateDraft } from "@/lib/integrations/linq-ai";
import { resolveLinqAiConfig } from "@/lib/integrations/linq-ai/platform-config";
import type { EstimateDraftResult } from "@/lib/integrations/linq-ai/types";
import {
  applyEstimateDraftToEstimate,
  getConstructionEstimate,
} from "@/lib/actions/constructions";

export type LinqEstimateDraftApplyResult = {
  ok: true;
  estimate: Awaited<ReturnType<typeof getConstructionEstimate>>;
  draft: Pick<EstimateDraftResult, "title" | "notes" | "source">;
  summary: string;
} | {
  ok: false;
  error: string;
};

/** 工事見積向け: 追加工事内容から Linq ドラフトを生成し、既存見積に明細を追加する */
export async function generateAndApplyLinqEstimateDraft(
  estimateId: string,
  prompt: string,
): Promise<LinqEstimateDraftApplyResult> {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return { ok: false, error: "追加工事内容を入力してください" };
  }

  const supabase = await createClient();
  const { data: estimate, error: estErr } = await supabase
    .from("estimates")
    .select("id, title, notes, construction_id, customer_id, customer:customers(name, inquiry_content)")
    .eq("id", estimateId)
    .single();
  if (estErr || !estimate) {
    return { ok: false, error: "見積が見つかりません" };
  }

  let constructionTitle: string | undefined;
  if (estimate.construction_id) {
    const { data: construction } = await supabase
      .from("constructions")
      .select("title")
      .eq("id", estimate.construction_id)
      .maybeSingle();
    constructionTitle = construction?.title ?? undefined;
  }

  const customer = Array.isArray(estimate.customer) ? estimate.customer[0] : estimate.customer;
  const customerName = customer?.name ?? "お客様";

  const { data: recordings } = estimate.customer_id
    ? await supabase
        .from("customer_recordings")
        .select("transcript, summary, memo")
        .eq("customer_id", estimate.customer_id)
        .order("recorded_at", { ascending: false })
        .limit(5)
    : { data: [] as Array<{ transcript: string | null; summary: string | null; memo: string | null }> };

  const recordingTexts = (recordings ?? []).flatMap((r) =>
    [r.summary, r.transcript, r.memo].filter(Boolean) as string[],
  );

  const draft = await generateEstimateDraft(
    {
      customerName,
      recordings: recordingTexts,
      inquiryContent: customer?.inquiry_content ?? undefined,
      additionalPrompt: trimmed,
      constructionTitle,
      existingEstimateTitle: estimate.title ?? undefined,
    },
    await resolveLinqAiConfig(),
  );

  if (!draft.items.length) {
    return { ok: false, error: "ドラフトを生成できませんでした。内容を具体化して再度お試しください" };
  }

  const updated = await applyEstimateDraftToEstimate(estimateId, draft);

  const catCount = new Set(draft.items.map((i) => i.categoryName || "追加工事")).size;
  const itemCount = draft.items.length;
  const totalSell = draft.items.reduce((s, i) => s + Math.round((i.quantity ?? 1) * (i.sellingPrice ?? 0)), 0);

  return {
    ok: true,
    estimate: updated,
    draft: { title: draft.title, notes: draft.notes, source: draft.source },
    summary: [
      `見積ドラフトを反映しました（大項目 ${catCount} / 明細 ${itemCount} / 概算 ¥${totalSell.toLocaleString()}）`,
      "",
      "「見積もり」タブの明細表を確認し、必要に応じて単価・数量を調整してください。",
    ].join("\n"),
  };
}
