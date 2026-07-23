/**
 * Linq AI サービス層
 *
 * 営業フロー 1-2〜1-7 の AI 機能を集約。
 * 現状はヒューリスティック/スタブ実装。本番は各メソッド内の `callLlm` を接続。
 *
 * 設計原則:
 * - すべての戻り値に source / productionReady を付与
 * - Server Actions からのみ呼び出し（クライアント直叩き禁止）
 * - 外部 API キーは platform_settings.linq_ai（運営 /admin で設定、全テナント共通）
 */

import { addDays, format } from "date-fns";
import { resolveLinqAiConfig } from "./platform-config";
import type {
  AppointmentParseResult,
  ApprovalSupportResult,
  AssigneeRecommendResult,
  CommunicationAgreementItem,
  CommunicationAgreementResult,
  ContractAutoFillResult,
  DurationEstimateResult,
  EstimateDraftResult,
  EsignMessageResult,
  FollowUpEmailRequest,
  FollowUpEmailResult,
  LeadAssignResult,
  LinqAiConfig,
  LinqResultMeta,
  MeetingSummaryInput,
  MeetingSummaryResult,
  StageTransitionProposal,
} from "./types";

export * from "./types";
export { resolveLinqAiConfig } from "./platform-config";

const STUB_META: LinqResultMeta = { source: "stub", productionReady: false };

export function getLinqAiConfig(_settings?: Record<string, unknown> | null | undefined): LinqAiConfig {
  /** @deprecated テナント別設定は廃止。resolveLinqAiConfig() を使用 */
  return {
    enabled: false,
    provider: "google",
    model: "gemini-2.0-flash",
    sttProvider: "web_speech",
  };
}

async function callOpenAi(prompt: string, config: LinqAiConfig, systemPrompt?: string): Promise<string | null> {
  if (!config.apiKey) return null;
  const model = config.model ?? "gpt-4o-mini";
  const started = Date.now();
  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: 2048 }),
  });
  if (!res.ok) {
    console.error("[linq-ai] OpenAI error:", res.status, await res.text().catch(() => ""));
    return null;
  }
  const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const text = json.choices?.[0]?.message?.content ?? null;
  if (text) console.info(`[linq-ai] OpenAI ${model} ${Date.now() - started}ms`);
  return text;
}

async function callAnthropic(prompt: string, config: LinqAiConfig, systemPrompt?: string): Promise<string | null> {
  if (!config.apiKey) return null;
  const model = config.model ?? "claude-3-5-haiku-20241022";
  const started = Date.now();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    console.error("[linq-ai] Anthropic error:", res.status, await res.text().catch(() => ""));
    return null;
  }
  const json = await res.json() as { content?: Array<{ text?: string }> };
  const text = json.content?.[0]?.text ?? null;
  if (text) console.info(`[linq-ai] Anthropic ${model} ${Date.now() - started}ms`);
  return text;
}

async function callGemini(prompt: string, config: LinqAiConfig): Promise<string | null> {
  if (!config.apiKey || config.provider !== "google") return null;
  const model = config.model ?? "gemini-2.0-flash";
  const started = Date.now();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
      }),
    },
  );
  if (!res.ok) {
    console.error("[linq-ai] Gemini error:", res.status, await res.text().catch(() => ""));
    return null;
  }
  const json = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  if (text) console.info(`[linq-ai] Gemini ${model} ${Date.now() - started}ms`);
  return text;
}

/** プラットフォーム共通 LLM 呼び出し（OpenAI / Anthropic / Google 対応） */
export async function callLlm(prompt: string, config: LinqAiConfig, systemPrompt?: string): Promise<string | null> {
  if (!config.enabled || !config.apiKey) return null;
  switch (config.provider) {
    case "openai":
    case "azure":
      return callOpenAi(prompt, config, systemPrompt);
    case "anthropic":
      return callAnthropic(prompt, config, systemPrompt);
    case "google":
      return callGemini(prompt, config);
    default:
      return null;
  }
}

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

// ---------------------------------------------------------------------------
// 1-2 問い合わせ
// ---------------------------------------------------------------------------

export async function parseAppointmentFromInquiry(
  content: string,
  _config?: LinqAiConfig,
): Promise<AppointmentParseResult> {
  const datePatterns = content.match(/\d{1,2}[\/月]\d{1,2}[日]?|\d{4}-\d{2}-\d{2}/g) ?? [];
  const timePatterns = content.match(/\d{1,2}[:：]\d{2}|\d{1,2}時/g) ?? [];

  if (datePatterns.length === 0) {
    return { ...STUB_META, source: "heuristic", hasAppointment: false, mode: "unknown", candidates: [] };
  }
  if (datePatterns.length === 1 && timePatterns.length >= 1) {
    return {
      ...STUB_META,
      source: "heuristic",
      hasAppointment: true,
      mode: "single",
      candidates: [{ datetime: `${datePatterns[0]} ${timePatterns[0]}`, label: datePatterns[0], confidence: 0.7 }],
    };
  }
  return {
    ...STUB_META,
    source: "heuristic",
    hasAppointment: true,
    mode: "multiple",
    candidates: datePatterns.slice(0, 5).map((d, i) => ({
      datetime: d,
      label: d,
      confidence: 0.6 - i * 0.05,
    })),
  };
}

export async function assignLeadToSalesperson(
  profiles: Array<{ id: string; displayName: string; role?: string; activeDeals?: number }>,
  _inquiryContent: string,
  _config?: LinqAiConfig,
): Promise<LeadAssignResult> {
  const salesProfiles = profiles.filter((p) => !p.role || ["sales", "employee", "admin"].includes(p.role));
  const pool = salesProfiles.length > 0 ? salesProfiles : profiles;
  const candidates = pool
    .map((p) => {
      const load = p.activeDeals ?? 0;
      const score = Math.max(0, 100 - load * 12);
      return {
        profileId: p.id,
        displayName: p.displayName,
        score,
        reasons: load === 0 ? ["担当案件なし"] : [`現在${load}件担当`, "負荷を考慮"],
      };
    })
    .sort((a, b) => b.score - a.score);

  return {
    ...STUB_META,
    source: "heuristic",
    candidates,
    recommendedId: candidates[0]?.profileId ?? null,
  };
}

export async function generateFollowUpEmail(
  input: FollowUpEmailRequest,
  _config?: LinqAiConfig,
): Promise<FollowUpEmailResult> {
  const ai = _config ?? await resolveLinqAiConfig();
  if (ai.enabled) {
    const tone = input.tone === "friendly" ? "親しみやすい丁寧語" : "フォーマルなビジネス文体";
    const llm = await callLlm(
      `工務店・リフォーム会社の営業担当として、以下の問い合わせへのフォローアップメールを作成してください。
顧客名: ${input.customerName}
問い合わせ内容: ${input.inquiryContent.slice(0, 500)}
文体: ${tone}
JSONのみ返してください: {"subject":"件名","body":"本文"}`,
      ai,
      "あなたは工務店の優秀な営業アシスタントです。",
    );
    if (llm) {
      const parsed = parseJsonBlock<{ subject?: string; body?: string }>(llm);
      if (parsed?.subject && parsed?.body) {
        return { source: "linq", productionReady: true, model: ai.model, subject: parsed.subject, body: parsed.body };
      }
    }
  }
  return {
    ...STUB_META,
    source: "heuristic",
    subject: `${input.customerName} 様｜日程調整のご連絡`,
    body: `${input.customerName} 様\n\nお問い合わせありがとうございます。\n${input.inquiryContent.slice(0, 100)}...\n\nご都合の良い日時をいくつかお知らせください。\n\nよろしくお願いいたします。`,
  };
}

// ---------------------------------------------------------------------------
// 1-3 商談進捗
// ---------------------------------------------------------------------------

/**
 * LLM がプロンプト内のテンプレ（"商談タイトル（20文字以内）" 等）をそのまま
 * オウム返しした場合に無害なフォールバックへ置き換える
 */
export function sanitizeMeetingTitle(title: string | null | undefined, fallback?: string): string {
  const t = (title ?? "").trim();
  const isPlaceholder = !t || /20文字以内|^商談タイトル$|^タイトル$/.test(t);
  if (isPlaceholder) {
    return fallback ?? `商談 ${format(new Date(), "M/d")}`;
  }
  return t.slice(0, 40);
}

function extractCustomerUpdates(text: string): MeetingSummaryResult["customerUpdates"] {
  const updates: MeetingSummaryResult["customerUpdates"] = [];
  const phone = text.match(/0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4}/)?.[0];
  if (phone) updates.push({ field: "phone", value: phone.replace(/\s/g, ""), reason: "録音から抽出" });
  const email = text.match(/[\w.+-]+@[\w.-]+\.\w+/)?.[0];
  if (email) updates.push({ field: "email", value: email, reason: "録音から抽出" });
  const budget = text.match(/(\d{3,4})\s*万円/)?.[1];
  if (budget) updates.push({ field: "budget_max", value: String(Number(budget) * 10000), reason: "予算感を録音から抽出" });
  const addr = text.match(/(東京都|大阪府|京都府|北海道|.{2,3}県)[^\n。、]{0,40}(丁目|番地|号|町)/)?.[0];
  if (addr) updates.push({ field: "address", value: addr.trim(), reason: "住所を録音から抽出" });
  return updates;
}

export async function summarizeMeetingRecording(
  input: MeetingSummaryInput,
  config?: LinqAiConfig,
): Promise<MeetingSummaryResult> {
  const ai = config ?? await resolveLinqAiConfig();
  const text = [input.transcript, input.memo].filter(Boolean).join("\n").trim();

  if (ai.enabled && text.length > 0) {
    // ネットワーク断等で fetch が reject しても商談自動登録を止めない
    const llm = await callLlm(
      `あなたは工務店・リフォーム会社の営業アシスタントです。以下の商談録音テキストを分析し、JSONのみ返してください（説明文不要）。titleはテンプレ文言をそのまま使わず、内容を要約した具体的な件名にすること:
{"title":"商談タイトル","summary":"3文以内の要約","keyPoints":["要点1","要点2"],"todos":[{"title":"ToDo","priority":"high|medium|low","dueDate":"YYYY-MM-DDまたはnull"}]}

録音テキスト:
${text.slice(0, 8000)}`,
      ai,
    ).catch((err) => {
      console.error("[linq-ai] summarizeMeetingRecording LLM failed:", err);
      return null;
    });
    if (llm) {
      const parsed = parseJsonBlock<{
        title?: string;
        summary?: string;
        keyPoints?: string[];
        todos?: Array<{ title: string; priority?: string; dueDate?: string | null }>;
      }>(llm);
      if (parsed?.summary) {
        return {
          source: "linq",
          productionReady: true,
          model: ai.model,
          title: sanitizeMeetingTitle(parsed.title),
          summary: parsed.summary,
          keyPoints: parsed.keyPoints ?? [],
          customerUpdates: extractCustomerUpdates(text),
          todos: (parsed.todos ?? []).map((t) => ({
            title: t.title,
            priority: (["high", "medium", "low"].includes(t.priority ?? "") ? t.priority : "medium") as "high" | "medium" | "low",
            dueDate: t.dueDate && t.dueDate !== "null" ? t.dueDate : undefined,
          })),
        };
      }
    }
  }

  const sentences = text.split(/[。.\n]/).filter(Boolean);
  const summary = sentences.slice(0, 3).join("。") + (sentences.length > 0 ? "。" : "");

  const todos: MeetingSummaryResult["todos"] = [];
  if (/見積|見積もり|見積書/.test(text)) {
    todos.push({ title: "見積書を作成する", priority: "high", dueDate: format(addDays(new Date(), 3), "yyyy-MM-dd") });
  }
  if (/次回|再来|フォロー/.test(text)) {
    todos.push({ title: "次回商談の日程調整", priority: "medium", dueDate: format(addDays(new Date(), 7), "yyyy-MM-dd") });
  }
  if (/資料|送付|メール/.test(text)) {
    todos.push({ title: "資料送付", priority: "medium" });
  }

  return {
    ...STUB_META,
    source: "heuristic",
    title: `商談 ${format(new Date(), "M/d")}`,
    summary: summary || text.slice(0, 200),
    keyPoints: sentences.slice(0, 5),
    customerUpdates: extractCustomerUpdates(text),
    todos,
  };
}

const STAGE_ORDER = ["inquiry", "first_meeting", "materials_sent", "quote_submitted", "negotiation", "closing", "won"];

export async function proposeStageTransition(
  currentStage: string,
  summaryText: string,
  config?: LinqAiConfig,
): Promise<StageTransitionProposal> {
  const ai = config ?? await resolveLinqAiConfig();
  const stages = STAGE_ORDER.join(", ");

  if (ai.enabled && summaryText.trim()) {
    const llm = await callLlm(
      `工務店CRMの商談ステージ提案。現在: "${currentStage}"。候補: ${stages}
要約: ${summaryText.slice(0, 2000)}
JSONのみ: {"proposedStage":"ステージキー","confidence":0.0-1.0,"reason":"理由"}`,
      ai,
    );
    if (llm) {
      const parsed = parseJsonBlock<{ proposedStage?: string; confidence?: number; reason?: string }>(llm);
      if (parsed?.proposedStage && STAGE_ORDER.includes(parsed.proposedStage)) {
        return {
          source: "linq",
          productionReady: true,
          model: ai.model,
          currentStage,
          proposedStage: parsed.proposedStage,
          confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.7)),
          reason: parsed.reason ?? "AIがステージ変更を提案しました",
        };
      }
    }
  }

  const idx = STAGE_ORDER.indexOf(currentStage);
  let proposed = currentStage;
  let confidence = 0.5;
  let reason = "内容から大きな変化は検出されませんでした";

  if (/見積|見積もり|見積書|お見積/.test(summaryText) && idx < STAGE_ORDER.indexOf("quote_submitted")) {
    proposed = "quote_submitted";
    confidence = 0.75;
    reason = "見積に関する言及がありました";
  } else if (/契約|受注|決定|ご発注/.test(summaryText)) {
    proposed = "closing";
    confidence = 0.8;
    reason = "受注・契約に近い言及がありました";
  } else if (/資料|送付|カタログ/.test(summaryText) && idx < STAGE_ORDER.indexOf("materials_sent")) {
    proposed = "materials_sent";
    confidence = 0.65;
    reason = "資料送付に関する言及がありました";
  } else if (idx >= 0 && idx < STAGE_ORDER.length - 2) {
    proposed = STAGE_ORDER[idx + 1];
    confidence = 0.55;
    reason = "商談が進行したと判断しました";
  }

  return { ...STUB_META, source: "heuristic", currentStage, proposedStage: proposed, confidence, reason };
}

// ---------------------------------------------------------------------------
// 1-4 見積作成
// ---------------------------------------------------------------------------

export async function generateEstimateDraft(
  context: { customerName: string; recordings: string[]; inquiryContent?: string },
  _config?: LinqAiConfig,
): Promise<EstimateDraftResult> {
  const ai = _config ?? await resolveLinqAiConfig();
  const combined = [...context.recordings, context.inquiryContent ?? ""].join("\n");

  if (ai.enabled && combined.trim()) {
    const llm = await callLlm(
      `工務店・リフォーム会社の見積ドラフトを作成してください。
顧客名: ${context.customerName}
商談・問い合わせ内容: ${combined.slice(0, 3000)}

JSONのみ返してください:
{"title":"見積タイトル","items":[{"categoryName":"カテゴリ","name":"工事名","quantity":1,"unit":"式","costPrice":原価数値,"sellingPrice":販売価格数値,"specification":"仕様詳細（任意）"}],"notes":"備考"}

粗利率は概ね40〜55%を目安にしてください。`,
      ai,
      "あなたは工務店・リフォーム会社の見積専門家です。",
    );
    if (llm) {
      const parsed = parseJsonBlock<{
        title?: string;
        items?: Array<{ categoryName: string; name: string; quantity: number; unit: string; costPrice: number; sellingPrice: number; specification?: string }>;
        notes?: string;
      }>(llm);
      if (parsed?.items && parsed.items.length > 0) {
        return {
          source: "linq",
          productionReady: true,
          model: ai.model,
          title: parsed.title ?? `${context.customerName} 様 見積ドラフト`,
          items: parsed.items,
          notes: parsed.notes ?? "AIが商談ナレッジから自動生成（要確認・調整）",
        };
      }
    }
  }

  const items: EstimateDraftResult["items"] = [];
  if (/リフォーム|改修|改装/.test(combined)) {
    items.push(
      { categoryName: "解体・撤去", name: "既存設備撤去", quantity: 1, unit: "式", costPrice: 200000, sellingPrice: 350000 },
      { categoryName: "内装工事", name: "クロス・床工事", quantity: 1, unit: "式", costPrice: 500000, sellingPrice: 850000 },
    );
  } else if (/新築|建築/.test(combined)) {
    items.push(
      { categoryName: "基礎工事", name: "ベタ基礎", quantity: 1, unit: "式", costPrice: 1500000, sellingPrice: 2200000 },
      { categoryName: "躯体工事", name: "木造軸組", quantity: 1, unit: "式", costPrice: 3000000, sellingPrice: 4500000 },
    );
  } else {
    items.push(
      { categoryName: "工事費", name: "一式工事", quantity: 1, unit: "式", costPrice: 1000000, sellingPrice: 1800000 },
    );
  }
  return {
    ...STUB_META,
    source: "heuristic",
    title: `${context.customerName} 様 見積ドラフト`,
    items,
    notes: "商談ナレッジから自動生成（要確認・調整）",
  };
}

// ---------------------------------------------------------------------------
// 1-5 上長承認
// ---------------------------------------------------------------------------

export async function generateApprovalSupport(
  estimate: { id: string; title: string; grossProfitRate: number; total: number },
  similarEstimates: Array<{ id: string; title: string; grossProfitRate: number; total: number }>,
  applicationComment: string,
  _config?: LinqAiConfig,
): Promise<ApprovalSupportResult> {
  const ai = _config ?? await resolveLinqAiConfig();
  const avgRate = similarEstimates.length
    ? similarEstimates.reduce((s, e) => s + e.grossProfitRate, 0) / similarEstimates.length
    : 50;

  if (ai.enabled) {
    const llm = await callLlm(
      `工務店の見積承認支援を行ってください。
対象見積: "${estimate.title}" 粗利率${estimate.grossProfitRate.toFixed(1)}% 合計¥${estimate.total.toLocaleString()}
類似見積平均粗利率: ${avgRate.toFixed(1)}%
申請理由: ${applicationComment || "（未記載）"}

JSONのみ: {"analysis":"分析コメント（2文以内）","recommendation":"approve|conditional|return|reject","suggestedComment":"上長コメント案（任意）"}
recommendationの基準: approve=粗利率50%以上, conditional=40-50%で理由あり, return=40%未満または理由なし, reject=著しく低い`,
      ai,
      "あなたは工務店の経験豊富な上長です。",
    );
    if (llm) {
      const parsed = parseJsonBlock<{ analysis?: string; recommendation?: string; suggestedComment?: string }>(llm);
      if (parsed?.analysis && parsed?.recommendation) {
        return {
          source: "linq",
          productionReady: true,
          model: ai.model,
          similarEstimates: similarEstimates.slice(0, 5),
          analysis: parsed.analysis,
          recommendation: (["approve", "conditional", "return", "reject"].includes(parsed.recommendation)
            ? parsed.recommendation : "conditional") as ApprovalSupportResult["recommendation"],
          suggestedComment: parsed.suggestedComment,
        };
      }
    }
  }

  let recommendation: ApprovalSupportResult["recommendation"] = "approve";
  let analysis = `粗利率 ${estimate.grossProfitRate.toFixed(1)}% は類似見積平均 ${avgRate.toFixed(1)}% と比較しています。`;
  if (estimate.grossProfitRate < 40) {
    recommendation = "return";
    analysis += " 大幅に基準を下回るため、原価見直しまたは値引き理由の追加確認を推奨します。";
  } else if (estimate.grossProfitRate < 50) {
    recommendation = applicationComment.trim() ? "conditional" : "return";
    analysis += " 基準未満ですが、申請理由が記載されていれば条件付き承認も検討可能です。";
  }
  return {
    ...STUB_META,
    source: "heuristic",
    similarEstimates: similarEstimates.slice(0, 5),
    analysis,
    recommendation,
    suggestedComment: recommendation === "conditional" ? "条件: 追加値引きは行わないこと" : undefined,
  };
}

// ---------------------------------------------------------------------------
// 1-6 工事引き継ぎ
// ---------------------------------------------------------------------------

export async function estimateConstructionDuration(
  workType: string,
  orderAmount: number,
  _config?: LinqAiConfig,
): Promise<DurationEstimateResult> {
  const start = addDays(new Date(), 14);
  const months = orderAmount > 10_000_000 ? 6 : orderAmount > 3_000_000 ? 4 : 2;
  const end = addDays(start, months * 30);
  return {
    ...STUB_META,
    source: "heuristic",
    startDate: format(start, "yyyy-MM-dd"),
    endDate: format(end, "yyyy-MM-dd"),
    workingDays: months * 20,
    reason: `${workType || "標準工事"}・受注額 ¥${orderAmount.toLocaleString()} を基準に推定`,
  };
}

export async function recommendFieldAssignee(
  profiles: Array<{ id: string; displayName: string; activeConstructions?: number; department?: string }>,
  _context: { customerAddress?: string; workType?: string },
  _config?: LinqAiConfig,
): Promise<AssigneeRecommendResult> {
  const candidates = profiles
    .map((p) => {
      const load = p.activeConstructions ?? 0;
      const score = Math.max(0, 100 - load * 15);
      return {
        profileId: p.id,
        displayName: p.displayName,
        score,
        reasons: load === 0 ? ["担当工事なし"] : [`現在${load}件担当`],
        currentLoad: load,
      };
    })
    .sort((a, b) => b.score - a.score);

  return {
    ...STUB_META,
    source: "heuristic",
    candidates,
    recommendedId: candidates[0]?.profileId ?? null,
  };
}

// ---------------------------------------------------------------------------
// 1-7 契約書
// ---------------------------------------------------------------------------

export async function autoFillContractFields(
  mappings: Array<{ fieldKey: string; source: ContractAutoFillResult["fields"][0]["source"] }>,
  values: Record<string, string>,
  _config?: LinqAiConfig,
): Promise<ContractAutoFillResult> {
  const fields = mappings.map((m) => ({
    fieldKey: m.fieldKey,
    value: values[m.fieldKey] ?? "",
    source: m.source,
  }));
  return { ...STUB_META, source: "heuristic", fields };
}

export async function generateEsignMessage(
  customerName: string,
  contractTitle: string,
  _config?: LinqAiConfig,
): Promise<EsignMessageResult> {
  const ai = _config ?? await resolveLinqAiConfig();
  if (ai.enabled) {
    const llm = await callLlm(
      `工務店の電子契約送付メールを作成してください。
顧客名: ${customerName}
契約書タイトル: ${contractTitle}
JSONのみ: {"subject":"件名","body":"本文（署名依頼の丁寧な文面）"}`,
      ai,
      "あなたは工務店の営業担当です。",
    );
    if (llm) {
      const parsed = parseJsonBlock<{ subject?: string; body?: string }>(llm);
      if (parsed?.subject && parsed?.body) {
        return { source: "linq", productionReady: true, model: ai.model, subject: parsed.subject, body: parsed.body };
      }
    }
  }
  return {
    ...STUB_META,
    source: "heuristic",
    subject: `【${contractTitle}】電子契約のご確認`,
    body: `${customerName} 様\n\nお世話になっております。\n「${contractTitle}」の電子契約書を送付いたします。\n内容をご確認のうえ、署名をお願いいたします。\n\nよろしくお願いいたします。`,
  };
}

const AGREEMENT_KEYWORDS = [
  "了解", "承知", "合意", "確定", "了承", "お願いします", "問題ありません", "問題ない",
  "開始", "工期", "見積", "金額", "¥", "円", "日程", "打ち合わせ",
];

function heuristicAgreementScore(body: string): number {
  const hits = AGREEMENT_KEYWORDS.filter((k) => body.includes(k)).length;
  if (hits >= 3) return 0.92;
  if (hits === 2) return 0.78;
  if (hits === 1) return 0.55;
  return 0;
}

/** やり取り履歴から重要な合意事項を抽出（LLM 未接続時はキーワードベース） */
export async function extractCommunicationAgreements(
  messages: Array<{ id: string; body: string }>,
): Promise<CommunicationAgreementResult> {
  const started = Date.now();
  const config = await resolveLinqAiConfig();

  if (config.enabled && config.apiKey) {
    const prompt = `以下のメッセージから、ビジネス上の重要な合意事項のみを JSON 配列で抽出してください。
各要素: {"messageId":"...","summary":"1文で要約","confidence":0.0-1.0}
合意・確定・了承・日程・金額に関するもののみ。該当なしは [] を返す。

${JSON.stringify(messages.map((m) => ({ messageId: m.id, body: m.body })))}`;

    const raw = await callLlm(prompt, config);
    if (raw) {
      try {
        const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()) as CommunicationAgreementItem[];
        if (Array.isArray(parsed)) {
          return {
            source: "linq",
            productionReady: true,
            model: config.model,
            latencyMs: Date.now() - started,
            items: parsed.filter((i) => i.messageId && i.summary),
          };
        }
      } catch {
        /* fall through */
      }
    }
  }

  const items = messages
    .map((m) => {
      const confidence = heuristicAgreementScore(m.body);
      if (confidence < 0.55) return null;
      const summary = m.body.length > 120 ? `${m.body.slice(0, 118)}…` : m.body;
      return { messageId: m.id, summary, confidence };
    })
    .filter((i): i is CommunicationAgreementItem => i !== null);

  return {
    source: "heuristic",
    productionReady: false,
    latencyMs: Date.now() - started,
    items,
  };
}
