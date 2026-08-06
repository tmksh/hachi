"use server";

/**
 * 決算書（財務諸表）Server Actions
 * 顧客要望シート No.85〜104
 */

import { createClient } from "@/lib/supabase/server";
import { callLlm, resolveLinqAiConfig } from "@/lib/integrations/linq-ai";
import type {
  FinancialAccountItem,
  FinancialAccountSection,
  FinancialCogsCategory,
  FinancialReportSettings,
  FinancialStatement,
  FinancialStatementLine,
} from "@/lib/database.types";
import {
  buildFinancialPeriodLabel,
  computePl,
  DEFAULT_FINANCIAL_ACCOUNT_ITEMS,
  FINANCIAL_SECTION_LABELS,
  COGS_CATEGORY_LABELS,
} from "@/lib/financial-statements-utils";

/** 決算書機能にアクセス可能なロール（No.103） */
const FINANCIALS_ALLOWED_ROLES = ["hq_admin", "admin", "executive"];

type ActionResult = { ok: true } | { ok: false; error: string };

async function getFinancialsContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { supabase, companyId: null as string | null, userId: null as string | null };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .single();
  if (!profile || !FINANCIALS_ALLOWED_ROLES.includes(profile.role)) {
    return { supabase, companyId: null, userId: null };
  }
  return { supabase, companyId: profile.company_id as string, userId: user.id };
}

// ============================================================
// 勘定科目マスタ（No.87）
// ============================================================

/**
 * 勘定科目マスタを取得する。
 * 未登録の会社には標準的な建設業PLのデフォルト科目を初回自動seedする（No.87）。
 */
export async function getFinancialAccountItems(): Promise<FinancialAccountItem[]> {
  const { supabase, companyId } = await getFinancialsContext();
  if (!companyId) return [];

  const { data } = await supabase
    .from("financial_account_items")
    .select("*")
    .order("sort_order", { ascending: true });

  if (data && data.length > 0) return data as FinancialAccountItem[];

  // 初回自動seed
  const seedRows = DEFAULT_FINANCIAL_ACCOUNT_ITEMS.map((item, i) => ({
    company_id: companyId,
    section: item.section,
    cogs_category: item.cogsCategory ?? null,
    name: item.name,
    sort_order: (i + 1) * 10,
  }));
  const { data: seeded, error } = await supabase
    .from("financial_account_items")
    .insert(seedRows)
    .select("*");
  if (error) {
    // 並行アクセスで既にseed済みの場合などは再取得で回復
    const { data: retry } = await supabase
      .from("financial_account_items")
      .select("*")
      .order("sort_order", { ascending: true });
    return (retry ?? []) as FinancialAccountItem[];
  }
  return ((seeded ?? []) as FinancialAccountItem[]).sort((a, b) => a.sort_order - b.sort_order);
}

export async function createFinancialAccountItem(input: {
  section: FinancialAccountSection;
  cogsCategory?: FinancialCogsCategory | null;
  name: string;
}): Promise<ActionResult> {
  const { supabase, companyId } = await getFinancialsContext();
  if (!companyId) return { ok: false, error: "権限がありません" };
  const name = input.name.trim();
  if (!name) return { ok: false, error: "科目名を入力してください" };
  if (input.section === "cogs" && !input.cogsCategory) {
    return { ok: false, error: "売上原価の科目は原価区分を選択してください" };
  }

  // 同一区分の末尾に追加
  const { data: last } = await supabase
    .from("financial_account_items")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("financial_account_items").insert({
    company_id: companyId,
    section: input.section,
    cogs_category: input.section === "cogs" ? input.cogsCategory : null,
    name,
    sort_order: (last?.sort_order ?? 0) + 10,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateFinancialAccountItem(
  id: string,
  input: {
    name?: string;
    section?: FinancialAccountSection;
    cogsCategory?: FinancialCogsCategory | null;
    isActive?: boolean;
  },
): Promise<ActionResult> {
  const { supabase, companyId } = await getFinancialsContext();
  if (!companyId) return { ok: false, error: "権限がありません" };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return { ok: false, error: "科目名を入力してください" };
    patch.name = name;
  }
  if (input.section !== undefined) {
    patch.section = input.section;
    patch.cogs_category = input.section === "cogs" ? (input.cogsCategory ?? "expense") : null;
  } else if (input.cogsCategory !== undefined) {
    patch.cogs_category = input.cogsCategory;
  }
  if (input.isActive !== undefined) patch.is_active = input.isActive;

  const { error } = await supabase
    .from("financial_account_items")
    .update(patch)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** 科目を削除する。明細行も連動して削除される（DB側 ON DELETE CASCADE） */
export async function deleteFinancialAccountItem(id: string): Promise<ActionResult> {
  const { supabase, companyId } = await getFinancialsContext();
  if (!companyId) return { ok: false, error: "権限がありません" };
  const { error } = await supabase.from("financial_account_items").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** 並び替え: 指定した ID 順に sort_order を振り直す */
export async function reorderFinancialAccountItems(orderedIds: string[]): Promise<ActionResult> {
  const { supabase, companyId } = await getFinancialsContext();
  if (!companyId) return { ok: false, error: "権限がありません" };
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("financial_account_items")
      .update({ sort_order: (i + 1) * 10, updated_at: new Date().toISOString() })
      .eq("id", orderedIds[i]);
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}

// ============================================================
// 決算書本体（No.85/93/104）
// ============================================================

/** 決算書一覧（年度降順） */
export async function listFinancialStatements(): Promise<FinancialStatement[]> {
  const { supabase, companyId } = await getFinancialsContext();
  if (!companyId) return [];
  const { data } = await supabase
    .from("financial_statements")
    .select("*")
    .order("fiscal_year", { ascending: false })
    .order("start_month", { ascending: true });
  return (data ?? []) as FinancialStatement[];
}

/** 決算書1件（明細行付き） */
export async function getFinancialStatement(id: string): Promise<FinancialStatement | null> {
  const { supabase, companyId } = await getFinancialsContext();
  if (!companyId) return null;
  const { data } = await supabase
    .from("financial_statements")
    .select("*, lines:financial_statement_lines(*)")
    .eq("id", id)
    .maybeSingle();
  return (data ?? null) as FinancialStatement | null;
}

/**
 * 「1から作成」（No.93）: 期間（開始年・開始月）を選んで空のPL表を作成する。
 * ラベルは自動生成（No.104）。前年の決算書があれば当期実績を前期実績へ引き継ぐ。
 */
export async function createFinancialStatement(input: {
  fiscalYear: number;
  startMonth: number;
}): Promise<{ ok: true; statement: FinancialStatement } | { ok: false; error: string }> {
  const { supabase, companyId, userId } = await getFinancialsContext();
  if (!companyId) return { ok: false, error: "権限がありません" };
  if (input.startMonth < 1 || input.startMonth > 12) {
    return { ok: false, error: "開始月が不正です" };
  }

  const items = await getFinancialAccountItems();

  const { data: statement, error } = await supabase
    .from("financial_statements")
    .insert({
      company_id: companyId,
      fiscal_year: input.fiscalYear,
      start_month: input.startMonth,
      period_label: buildFinancialPeriodLabel(input.fiscalYear, input.startMonth),
      status: "draft",
      created_by: userId,
    })
    .select("*")
    .single();
  if (error || !statement) {
    if (error?.code === "23505") {
      return { ok: false, error: "同じ期間の決算書が既に存在します" };
    }
    return { ok: false, error: error?.message ?? "決算書の作成に失敗しました" };
  }

  // 前期（開始年 −1）の決算書から前期実績を引き継ぐ
  const priorActuals = new Map<string, number>();
  const { data: prior } = await supabase
    .from("financial_statements")
    .select("id")
    .eq("fiscal_year", input.fiscalYear - 1)
    .order("start_month", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (prior) {
    const { data: priorLines } = await supabase
      .from("financial_statement_lines")
      .select("account_item_id, actual_amount")
      .eq("statement_id", prior.id);
    for (const l of priorLines ?? []) {
      priorActuals.set(l.account_item_id, Number(l.actual_amount ?? 0));
    }
  }

  const lineRows = items
    .filter((i) => i.is_active)
    .map((item) => ({
      company_id: companyId,
      statement_id: statement.id,
      account_item_id: item.id,
      budget_amount: 0,
      actual_amount: 0,
      prior_actual_amount: priorActuals.get(item.id) ?? 0,
    }));
  if (lineRows.length > 0) {
    const { error: lineErr } = await supabase.from("financial_statement_lines").insert(lineRows);
    if (lineErr) {
      await supabase.from("financial_statements").delete().eq("id", statement.id);
      return { ok: false, error: lineErr.message };
    }
  }

  return { ok: true, statement: statement as FinancialStatement };
}

export type FinancialLineUpdate = {
  accountItemId: string;
  budgetAmount: number;
  actualAmount: number;
  priorActualAmount: number;
  varianceNote: string;
};

/** 明細行の一括保存（予算・実績・前期実績・差異理由）。段階利益は保存しない（No.89） */
export async function updateFinancialStatementLines(
  statementId: string,
  updates: FinancialLineUpdate[],
): Promise<ActionResult> {
  const { supabase, companyId } = await getFinancialsContext();
  if (!companyId) return { ok: false, error: "権限がありません" };

  const { data: statement } = await supabase
    .from("financial_statements")
    .select("id, status")
    .eq("id", statementId)
    .maybeSingle();
  if (!statement) return { ok: false, error: "決算書が見つかりません" };
  if (statement.status === "final") {
    return { ok: false, error: "確定済みの決算書は編集できません。ドラフトに戻してください" };
  }

  const rows = updates.map((u) => ({
    company_id: companyId,
    statement_id: statementId,
    account_item_id: u.accountItemId,
    budget_amount: Number.isFinite(u.budgetAmount) ? u.budgetAmount : 0,
    actual_amount: Number.isFinite(u.actualAmount) ? u.actualAmount : 0,
    prior_actual_amount: Number.isFinite(u.priorActualAmount) ? u.priorActualAmount : 0,
    variance_note: u.varianceNote.trim() || null,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("financial_statement_lines")
    .upsert(rows, { onConflict: "statement_id,account_item_id" });
  if (error) return { ok: false, error: error.message };

  await supabase
    .from("financial_statements")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", statementId);
  return { ok: true };
}

/** 状態変更（draft ⇄ final）。final にすると BI から参照可能になる（No.95） */
export async function setFinancialStatementStatus(
  id: string,
  status: "draft" | "final",
): Promise<ActionResult> {
  const { supabase, companyId } = await getFinancialsContext();
  if (!companyId) return { ok: false, error: "権限がありません" };
  const { error } = await supabase
    .from("financial_statements")
    .update({
      status,
      finalized_at: status === "final" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteFinancialStatement(id: string): Promise<ActionResult> {
  const { supabase, companyId } = await getFinancialsContext();
  if (!companyId) return { ok: false, error: "権限がありません" };
  const { error } = await supabase.from("financial_statements").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ============================================================
// 会社別設定（No.101: 実績列の見出し）
// ============================================================

export async function getFinancialReportSettings(): Promise<FinancialReportSettings | null> {
  const { supabase, companyId } = await getFinancialsContext();
  if (!companyId) return null;
  const { data } = await supabase
    .from("financial_report_settings")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  return (data ?? null) as FinancialReportSettings | null;
}

/** 実績列の見出しラベルを保存する（No.101 例: 「実績（弥生）」「実績（freee）」） */
export async function saveFinancialActualColumnLabel(label: string): Promise<ActionResult> {
  const { supabase, companyId } = await getFinancialsContext();
  if (!companyId) return { ok: false, error: "権限がありません" };
  const trimmed = label.trim();
  if (!trimmed) return { ok: false, error: "見出しラベルを入力してください" };
  const { error } = await supabase.from("financial_report_settings").upsert(
    {
      company_id: companyId,
      actual_column_label: trimmed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_id" },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ============================================================
// ファイル読込（No.91/102）: Linq（AI）で勘定科目にマッピング
// ============================================================

function parseJsonBlock<T>(text: string): T | null {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
  const raw = match?.[1] ?? match?.[0];
  if (!raw) return null;
  try {
    return JSON.parse(raw.trim()) as T;
  } catch {
    return null;
  }
}

export type FinancialImportResult =
  | { ok: true; matchedCount: number; unmatchedLabels: string[] }
  | { ok: false; error: string };

/**
 * ファイル読込（No.91）: クライアント側で抽出したテキスト（PDF/Excel/CSV）を
 * Linq（AI）で勘定科目マスタにマッピングし、当期実績を展開する。
 * 書式は固定せず AI に柔軟にマッピングさせる（estimate-linq-draft.ts のパターン踏襲）。
 *
 * 再読込は「置換」方式（No.102）: 実行時に全科目の当期実績を 0 リセットしてから反映する。
 * 置換前の確認ダイアログはクライアント側で表示すること。
 */
export async function importFinancialActualsFromText(
  statementId: string,
  documentText: string,
  fileName?: string,
): Promise<FinancialImportResult> {
  const { supabase, companyId } = await getFinancialsContext();
  if (!companyId) return { ok: false, error: "権限がありません" };

  const text = documentText.trim();
  if (!text) return { ok: false, error: "ファイルからテキストを抽出できませんでした" };

  const { data: statement } = await supabase
    .from("financial_statements")
    .select("id, status")
    .eq("id", statementId)
    .maybeSingle();
  if (!statement) return { ok: false, error: "決算書が見つかりません" };
  if (statement.status === "final") {
    return { ok: false, error: "確定済みの決算書には読込できません。ドラフトに戻してください" };
  }

  const ai = await resolveLinqAiConfig();
  if (!ai.enabled) {
    return { ok: false, error: "AI連携（Linq）が無効のためファイル読込を実行できません。運営設定をご確認ください" };
  }

  const items = await getFinancialAccountItems();
  const activeItems = items.filter((i) => i.is_active);
  if (activeItems.length === 0) {
    return { ok: false, error: "勘定科目マスタが登録されていません" };
  }

  const catalog = activeItems.map((i) => ({
    id: i.id,
    section: FINANCIAL_SECTION_LABELS[i.section],
    cogsCategory: i.cogs_category ? COGS_CATEGORY_LABELS[i.cogs_category] : undefined,
    name: i.name,
  }));

  const llm = await callLlm(
    `以下は会計ソフト等から出力された決算書類（損益計算書・試算表など）のテキストです${fileName ? `（ファイル名: ${fileName}）` : ""}。
書式は固定されていません。内容を読み取り、下記の勘定科目マスタに当期実績金額をマッピングしてください。

勘定科目マスタ（JSON）:
${JSON.stringify(catalog)}

決算書類テキスト:
${text.slice(0, 15000)}

ルール:
- 金額はすべて円単位の数値に変換すること（「千円」単位の書類は1000倍する）
- マスタの科目に対応する当期実績のみ抽出（予算・前期・構成比は無視）
- 複数の書類科目が1つのマスタ科目に対応する場合は合算する
- 費用・収益とも正の数で返す（マイナス表記の費用は絶対値にする）
- 合計行・小計行（売上総利益、営業利益など）はマッピングしない
- マスタに対応がない書類科目は unmatched にラベル名を入れる

JSONのみ返してください:
{"lines":[{"accountItemId":"マスタのid","amount":金額数値}],"unmatched":["対応先が無かった書類上の科目名"]}`,
    ai,
    "あなたは建設業の経理に精通した会計士です。決算書類の科目名の揺れ（例: 完工高→完成工事高）を理解して正確にマッピングしてください。",
  );

  if (!llm) return { ok: false, error: "AIによる読み取りに失敗しました。時間をおいて再度お試しください" };

  const parsed = parseJsonBlock<{
    lines?: Array<{ accountItemId?: string; amount?: number }>;
    unmatched?: string[];
  }>(llm);
  if (!parsed?.lines) {
    return { ok: false, error: "AIの読み取り結果を解析できませんでした。別のファイルでお試しください" };
  }

  const validIds = new Set(activeItems.map((i) => i.id));
  const amounts = new Map<string, number>();
  for (const l of parsed.lines) {
    if (!l.accountItemId || !validIds.has(l.accountItemId)) continue;
    const amount = Number(l.amount);
    if (!Number.isFinite(amount)) continue;
    amounts.set(l.accountItemId, (amounts.get(l.accountItemId) ?? 0) + Math.round(amount));
  }
  if (amounts.size === 0) {
    return { ok: false, error: "書類から勘定科目に対応する実績を読み取れませんでした" };
  }

  // 置換方式（No.102）: 既存の当期実績を全科目リセットしてから反映
  const { error: resetErr } = await supabase
    .from("financial_statement_lines")
    .update({ actual_amount: 0, updated_at: new Date().toISOString() })
    .eq("statement_id", statementId);
  if (resetErr) return { ok: false, error: resetErr.message };

  const rows = activeItems.map((item) => ({
    company_id: companyId,
    statement_id: statementId,
    account_item_id: item.id,
    actual_amount: amounts.get(item.id) ?? 0,
    updated_at: new Date().toISOString(),
  }));
  const { error: upsertErr } = await supabase
    .from("financial_statement_lines")
    .upsert(rows, { onConflict: "statement_id,account_item_id" });
  if (upsertErr) return { ok: false, error: upsertErr.message };

  await supabase
    .from("financial_statements")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", statementId);

  return {
    ok: true,
    matchedCount: amounts.size,
    unmatchedLabels: (parsed.unmatched ?? []).filter((s): s is string => typeof s === "string"),
  };
}

// ============================================================
// BI 連携（No.95）
// ============================================================

export type FinancialActualsForBi = {
  statementId: string;
  fiscalYear: number;
  startMonth: number;
  periodLabel: string;
  finalizedAt: string | null;
  /** 売上高合計 */
  revenue: number;
  /** 売上原価合計 */
  costOfSales: number;
  /** 製造原価報告書サブ区分別の内訳（material=材料費 / labor=労務費 / outsourcing=外注費 / expense=製造経費） */
  costOfSalesByCategory: Record<FinancialCogsCategory, number>;
  /** 売上総利益（自動計算） */
  grossProfit: number;
  /** 販管費合計 */
  sellingGeneralAdmin: number;
  /** 営業利益（自動計算） */
  operatingIncome: number;
  /** 営業外収益合計 */
  nonOperatingIncome: number;
  /** 営業外費用合計 */
  nonOperatingExpense: number;
  /** 経常利益（自動計算） */
  ordinaryIncome: number;
  /** 税引前当期純利益（自動計算） */
  pretaxIncome: number;
  /** 科目別の実績明細 */
  lines: Array<{
    accountItemId: string;
    name: string;
    section: FinancialAccountSection;
    cogsCategory: FinancialCogsCategory | null;
    actualAmount: number;
  }>;
};

/**
 * BI 連携用（No.95）: 確定（final）済みの決算書実績を取得する。
 *
 * BI 画面（bi-client.tsx 等）から会計年度を指定して呼び出す想定。
 * 対象年度に確定済み決算書が存在しない場合は null を返す
 * （draft のみの年度は「未確定」としてBI側では参照しない）。
 *
 * @param fiscalYear 決算期の開始年（西暦。例: 2025 = 2025年開始の期）
 * @returns 区分別合計・段階利益（売上総利益/営業利益/経常利益/税引前利益）と
 *          科目別実績明細。金額はすべて円単位。
 *
 * @example
 * const actuals = await getFinancialActualsForBi(2025);
 * if (actuals) {
 *   // actuals.revenue（売上高）, actuals.grossProfit（売上総利益）などをBIカードに表示
 * }
 */
export async function getFinancialActualsForBi(
  fiscalYear: number,
): Promise<FinancialActualsForBi | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: statement } = await supabase
    .from("financial_statements")
    .select("*, lines:financial_statement_lines(*)")
    .eq("fiscal_year", fiscalYear)
    .eq("status", "final")
    .order("finalized_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!statement) return null;

  const { data: items } = await supabase
    .from("financial_account_items")
    .select("*")
    .order("sort_order", { ascending: true });

  const accountItems = (items ?? []) as FinancialAccountItem[];
  const lines = ((statement.lines ?? []) as FinancialStatementLine[]);
  const pl = computePl(accountItems, lines);
  const itemById = new Map(accountItems.map((i) => [i.id, i]));

  return {
    statementId: statement.id,
    fiscalYear: statement.fiscal_year,
    startMonth: statement.start_month,
    periodLabel: statement.period_label,
    finalizedAt: statement.finalized_at ?? null,
    revenue: pl.sectionTotals.revenue.actual,
    costOfSales: pl.sectionTotals.cogs.actual,
    costOfSalesByCategory: {
      material: pl.cogsCategoryTotals.material.actual,
      labor: pl.cogsCategoryTotals.labor.actual,
      outsourcing: pl.cogsCategoryTotals.outsourcing.actual,
      expense: pl.cogsCategoryTotals.expense.actual,
    },
    grossProfit: pl.grossProfit.actual,
    sellingGeneralAdmin: pl.sectionTotals.sga.actual,
    operatingIncome: pl.operatingIncome.actual,
    nonOperatingIncome: pl.sectionTotals.non_operating_income.actual,
    nonOperatingExpense: pl.sectionTotals.non_operating_expense.actual,
    ordinaryIncome: pl.ordinaryIncome.actual,
    pretaxIncome: pl.pretaxIncome.actual,
    lines: lines
      .map((l) => {
        const item = itemById.get(l.account_item_id);
        if (!item || !item.is_active) return null;
        return {
          accountItemId: l.account_item_id,
          name: item.name,
          section: item.section,
          cogsCategory: item.cogs_category,
          actualAmount: Number(l.actual_amount ?? 0),
        };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null),
  };
}
