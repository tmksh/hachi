import { NextRequest, NextResponse } from "next/server";
import { runMonthlyInvoiceBulkGeneration } from "@/lib/invoice-monthly-bulk";

/** 月次請求書の一括生成（Server Action ハッシュ不一致を避ける HTTP 経路） */
export async function POST(request: NextRequest) {
  let body: { month?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "リクエスト形式が不正です" }, { status: 400 });
  }

  const month = body.month?.trim();
  if (!month) {
    return NextResponse.json({ ok: false, error: "対象月を指定してください" }, { status: 400 });
  }

  const result = await runMonthlyInvoiceBulkGeneration(month);
  if ("error" in result) {
    const status = /ログイン|プロフィール/.test(result.error) ? 403 : 400;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, ...result });
}
