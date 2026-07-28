import { NextRequest, NextResponse } from "next/server";
import { generateAndApplyLinqEstimateDraft } from "@/lib/estimate-linq-draft";

/** 工事見積 Linq 共同作成 — 追加工事内容からドラフトを生成して見積に反映 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: estimateId } = await context.params;

  let body: { prompt?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "リクエスト形式が不正です" }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ ok: false, error: "追加工事内容を入力してください" }, { status: 400 });
  }

  const result = await generateAndApplyLinqEstimateDraft(estimateId, prompt);
  if (!result.ok) {
    const status = /見つかりません|Not authenticated/.test(result.error) ? 403 : 400;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}
