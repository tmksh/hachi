import { NextRequest, NextResponse } from "next/server";
import { bulkApplyMarginToEstimate } from "@/lib/actions/constructions";

/** 目標粗利率の一括適用（Server Action のデプロイ不一致を避ける HTTP 経路） */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: estimateId } = await context.params;

  let body: { mode?: string; ratePercent?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "リクエスト形式が不正です" }, { status: 400 });
  }

  const mode = body.mode;
  const ratePercent = body.ratePercent;
  if (mode !== "cost" && mode !== "sell") {
    return NextResponse.json({ ok: false, error: "mode は cost または sell を指定してください" }, { status: 400 });
  }
  if (typeof ratePercent !== "number" || Number.isNaN(ratePercent)) {
    return NextResponse.json({ ok: false, error: "粗利率を数値で指定してください" }, { status: 400 });
  }

  try {
    const { items, totals } = await bulkApplyMarginToEstimate(estimateId, mode, ratePercent);
    return NextResponse.json({ ok: true, items, totals });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "一括設定に失敗しました";
    const status = /Not authenticated|Profile not found|見積が見つかりません/.test(message) ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
