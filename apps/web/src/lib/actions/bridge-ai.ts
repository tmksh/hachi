"use server";

import { resolveLinqAiConfig } from "@/lib/integrations/linq-ai/platform-config";
import { format, addDays } from "date-fns";
import { ja } from "date-fns/locale";

const SYSTEM_PROMPT = `あなたは「BRIDGE AI」— 工務店・リフォーム会社向けSaaS「BRIDGE」の専任アシスタントです。

できること:
- BRIDGE の操作方法・機能説明
- 顧客管理（CRM）・商談・見積・工事・契約・請求の進め方サポート
- 営業フロー・業務フロー全般のアドバイス
- データの見方・分析の解説
- 現在のページのリアルタイムデータを参照した回答（KPI・件数・金額・予定など）

回答ルール:
- 簡潔・丁寧に。基本は2〜3文以内で端的に答える
- Markdown記法（**太字**、# 見出し、\`コード\` など）は絶対に使わない。プレーンテキストのみ
- 箇条書きが必要な場合は「・」を使う
- 不明な場合は正直に伝える
- リアルタイムデータは「現在のページコンテキスト」として提供される。数値は万円単位で読みやすく表示すること`;

// ---------------------------------------------------------------------------
// ページ別リアルタイムコンテキスト取得
// ---------------------------------------------------------------------------

/**
 * 現在のページに応じてDBから実データを取得し、AIへの文脈文字列として返す。
 * 取得失敗はすべて握りつぶしてチャット自体を止めない。
 */
export async function fetchPageContext(pathname: string): Promise<string | null> {
  const path = pathname.split("?")[0];

  try {
    // ダッシュボード系
    if (path === "/dashboard" || path.startsWith("/dashboard2") || path.startsWith("/dashboard３") || path.startsWith("/dashboard3") || path.startsWith("/bi")) {
      return await fetchDashboardContext();
    }
    // CRM（顧客・商談）
    if (path.startsWith("/crm")) {
      return await fetchCrmContext();
    }
    // 見積
    if (path.startsWith("/quotes")) {
      return await fetchQuotesContext();
    }
    // 職人
    if (path.startsWith("/craftsmen")) {
      return await fetchCraftsmenContext();
    }
    // 契約
    if (path.startsWith("/contracts")) {
      return await fetchContractsContext();
    }
    // 工事
    if (path.startsWith("/constructions")) {
      return await fetchConstructionsContext();
    }
    // カレンダー
    if (path.startsWith("/calendar")) {
      return await fetchCalendarContext();
    }
    // 勤怠
    if (path.startsWith("/attendance")) {
      return await fetchAttendanceContext();
    }
    // ワークフロー
    if (path.startsWith("/workflow")) {
      return await fetchWorkflowContext();
    }
    // 請求
    if (path.startsWith("/invoices")) {
      return await fetchInvoicesContext();
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchDashboardContext(): Promise<string> {
  const { getDashboardData } = await import("@/lib/actions/dashboard");
  const d = await getDashboardData();
  const today = format(new Date(), "yyyy/MM/dd (EEE)", { locale: ja });
  const lines: string[] = [
    `【ダッシュボード / ${today}】`,
    `- 顧客数: ${d.kpis.customerCount}社`,
    `- 商談数（進行中）: ${d.kpis.dealCount}件`,
    `- パイプライン総額: ${Math.round(d.kpis.pipelineValue / 10000)}万円`,
    `- 受注累計（今期）: ${Math.round(d.kpis.wonValue / 10000)}万円`,
    `- 施工中工事: ${d.kpis.activeConstructions}件`,
    `- 未払い請求合計: ${Math.round(d.productionSummary.invoiceUnpaidTotal / 10000)}万円`,
    `- 承認待ち申請: ${d.workflow.pendingApprovals}件`,
  ];
  if (d.todos.length > 0) {
    const urgentTodos = d.todos.filter((t) => t.priority === "high").slice(0, 3);
    if (urgentTodos.length) {
      lines.push(`- 優先ToDoトップ3: ${urgentTodos.map((t) => t.title).join(" / ")}`);
    }
  }
  if (d.recentDeals.length > 0) {
    lines.push(`- 直近の商談: ${d.recentDeals.slice(0, 3).map((d) => `${d.customerName}「${d.title}」(${d.stageLabel})`).join(" / ")}`);
  }
  if (d.calendarEvents.length > 0) {
    lines.push(`- 次の予定: ${d.calendarEvents.slice(0, 3).map((e) => `${format(new Date(e.start_at), "M/d HH:mm")}「${e.title}」`).join(" / ")}`);
  }
  return lines.join("\n");
}

async function fetchCrmContext(): Promise<string> {
  const [
    { getCustomerCounts } ,
    { getDeals },
    { getUnfollowedCustomersCount },
  ] = await Promise.all([
    import("@/lib/actions/customers"),
    import("@/lib/actions/deals"),
    import("@/lib/actions/customers"),
  ]);

  const [counts, deals, unfollowedCount] = await Promise.all([
    getCustomerCounts().catch(() => ({ total: 0, corporation: 0, individual: 0 })),
    getDeals().catch(() => [] as Awaited<ReturnType<typeof getDeals>>),
    getUnfollowedCustomersCount(7).catch(() => 0),
  ]);

  const stageMap: Record<string, number> = {};
  for (const d of deals ?? []) {
    stageMap[d.stage ?? "不明"] = (stageMap[d.stage ?? "不明"] ?? 0) + 1;
  }
  const STAGE_LABELS: Record<string, string> = {
    inquiry: "問い合わせ", first_meeting: "初回面談", materials_sent: "資料送付",
    quote_submitted: "見積提出", negotiation: "交渉中", closing: "クロージング",
    won: "受注", lost: "失注", lead: "リード",
  };
  const stageLines = Object.entries(stageMap)
    .map(([k, v]) => `${STAGE_LABELS[k] ?? k}: ${v}件`)
    .join(" / ");

  return [
    `【顧客・商談管理 CRM】`,
    `- 顧客総数: ${counts.total}社（法人 ${counts.corporation} / 個人 ${counts.individual}）`,
    `- 7日間フォローなし顧客: ${unfollowedCount}社`,
    `- 商談数合計: ${(deals ?? []).length}件`,
    stageLines ? `- ステージ内訳: ${stageLines}` : "",
  ].filter(Boolean).join("\n");
}

async function fetchQuotesContext(): Promise<string> {
  const { getEstimates } = await import("@/lib/actions/estimates");
  const estimates = await getEstimates().catch(() => [] as Awaited<ReturnType<typeof getEstimates>>);
  const STATUS_LABELS: Record<string, string> = {
    draft: "下書き", submitted: "提出済", approved: "承認", rejected: "却下", expired: "失効",
  };
  const statusMap: Record<string, number> = {};
  let totalAmount = 0;
  for (const e of estimates ?? []) {
    statusMap[e.status ?? "不明"] = (statusMap[e.status ?? "不明"] ?? 0) + 1;
    totalAmount += Number(e.total ?? 0);
  }
  const statusLine = Object.entries(statusMap)
    .map(([k, v]) => `${STATUS_LABELS[k] ?? k}: ${v}件`)
    .join(" / ");
  return [
    `【見積管理】`,
    `- 見積総数: ${(estimates ?? []).length}件 / 合計金額: ${Math.round(totalAmount / 10000)}万円`,
    statusLine ? `- ステータス内訳: ${statusLine}` : "",
  ].filter(Boolean).join("\n");
}

async function fetchCraftsmenContext(): Promise<string> {
  const { getCraftsmen } = await import("@/lib/actions/craftsmen");
  const craftsmen = await getCraftsmen().catch(() => [] as Awaited<ReturnType<typeof getCraftsmen>>);
  return [
    `【職人管理】`,
    `- 登録職人数: ${(craftsmen ?? []).length}名`,
  ].join("\n");
}

async function fetchContractsContext(): Promise<string> {
  const { getContracts } = await import("@/lib/actions/contracts");
  const contracts = await getContracts().catch(() => [] as Awaited<ReturnType<typeof getContracts>>);
  const STATUS_LABELS: Record<string, string> = {
    draft: "下書き", active: "有効", completed: "完了", cancelled: "解除",
  };
  const statusMap: Record<string, number> = {};
  let totalAmount = 0;
  for (const c of contracts ?? []) {
    statusMap[c.status ?? "不明"] = (statusMap[c.status ?? "不明"] ?? 0) + 1;
    totalAmount += Number(c.amount ?? 0);
  }
  const statusLine = Object.entries(statusMap)
    .map(([k, v]) => `${STATUS_LABELS[k] ?? k}: ${v}件`)
    .join(" / ");
  return [
    `【契約管理】`,
    `- 契約総数: ${(contracts ?? []).length}件 / 合計金額: ${Math.round(totalAmount / 10000)}万円`,
    statusLine ? `- ステータス内訳: ${statusLine}` : "",
  ].filter(Boolean).join("\n");
}

async function fetchConstructionsContext(): Promise<string> {
  const { getConstructions } = await import("@/lib/actions/constructions");
  const items = await getConstructions().catch(() => [] as Awaited<ReturnType<typeof getConstructions>>);
  const STATUS_LABELS: Record<string, string> = {
    preparing: "準備中", in_progress: "施工中", completed: "完了", suspended: "停止", delayed: "遅延",
  };
  const statusMap: Record<string, number> = {};
  let totalProgress = 0;
  let inProgressCount = 0;
  for (const c of items ?? []) {
    statusMap[c.status ?? "不明"] = (statusMap[c.status ?? "不明"] ?? 0) + 1;
    if (c.status === "in_progress") { totalProgress += c.progress ?? 0; inProgressCount++; }
  }
  const avgProgress = inProgressCount > 0 ? Math.round(totalProgress / inProgressCount) : 0;
  const statusLine = Object.entries(statusMap)
    .map(([k, v]) => `${STATUS_LABELS[k] ?? k}: ${v}件`)
    .join(" / ");
  return [
    `【工事管理】`,
    `- 工事総数: ${(items ?? []).length}件`,
    statusLine ? `- ステータス内訳: ${statusLine}` : "",
    inProgressCount > 0 ? `- 施工中平均進捗: ${avgProgress}%` : "",
  ].filter(Boolean).join("\n");
}

async function fetchCalendarContext(): Promise<string> {
  const { getCalendarEvents } = await import("@/lib/actions/calendar");
  const now = new Date();
  const events = await getCalendarEvents({
    start: now.toISOString(),
    end: addDays(now, 14).toISOString(),
  }).catch(() => [] as Awaited<ReturnType<typeof getCalendarEvents>>);
  const today = format(now, "yyyy/MM/dd (EEE)", { locale: ja });
  const lines = [`【カレンダー / 今日: ${today}】`];
  if ((events ?? []).length === 0) {
    lines.push("- 今後14日間の予定: なし");
  } else {
    lines.push(`- 今後14日間の予定: ${(events ?? []).length}件`);
    for (const e of (events ?? []).slice(0, 5)) {
      lines.push(`  • ${format(new Date(e.start_at), "M/d(EEE) HH:mm", { locale: ja })} 「${e.title}」`);
    }
  }
  return lines.join("\n");
}

async function fetchAttendanceContext(): Promise<string> {
  const { getTodayAttendance } = await import("@/lib/actions/attendance");
  const today = await getTodayAttendance().catch(() => null);
  const todayStr = format(new Date(), "yyyy/MM/dd (EEE)", { locale: ja });
  const lines = [`【勤怠 / ${todayStr}】`];
  if (!today) {
    lines.push("- 本日の打刻: 未打刻");
  } else {
    const clockIn = today.clock_in_at ? format(new Date(today.clock_in_at), "HH:mm") : "—";
    const clockOut = today.clock_out_at ? format(new Date(today.clock_out_at), "HH:mm") : "未退勤";
    lines.push(`- 出勤: ${clockIn} / 退勤: ${clockOut} / ステータス: ${today.status ?? "—"}`);
  }
  return lines.join("\n");
}

async function fetchWorkflowContext(): Promise<string> {
  const { getWorkflowRequests } = await import("@/lib/actions/workflow");
  const [pending, submitted] = await Promise.all([
    getWorkflowRequests("pending").catch(() => [] as Awaited<ReturnType<typeof getWorkflowRequests>>),
    getWorkflowRequests("submitted").catch(() => [] as Awaited<ReturnType<typeof getWorkflowRequests>>),
  ]);
  return [
    `【ワークフロー】`,
    `- 承認待ち（自分に回ってきている）: ${(pending ?? []).length}件`,
    `- 申請中（自分が出している）: ${(submitted ?? []).length}件`,
  ].join("\n");
}

async function fetchInvoicesContext(): Promise<string> {
  const { getInvoices } = await import("@/lib/actions/invoices");
  const invoices = await getInvoices().catch(() => [] as Awaited<ReturnType<typeof getInvoices>>);
  const STATUS_LABELS: Record<string, string> = {
    draft: "下書き", sent: "送付済み", paid: "入金済み", cancelled: "キャンセル",
  };
  const statusMap: Record<string, number> = {};
  let unpaidTotal = 0;
  for (const inv of invoices ?? []) {
    statusMap[inv.status ?? "不明"] = (statusMap[inv.status ?? "不明"] ?? 0) + 1;
    if (inv.status === "sent") unpaidTotal += Number(inv.amount ?? 0);
  }
  const statusLine = Object.entries(statusMap)
    .map(([k, v]) => `${STATUS_LABELS[k] ?? k}: ${v}件`)
    .join(" / ");
  return [
    `【請求管理】`,
    `- 請求総数: ${(invoices ?? []).length}件`,
    statusLine ? `- ステータス内訳: ${statusLine}` : "",
    `- 未入金合計（送付済み）: ${Math.round(unpaidTotal / 10000)}万円`,
  ].filter(Boolean).join("\n");
}

type Message = { role: "user" | "assistant"; text: string };

/** チャットUIはプレーンテキスト表示のため、モデルが出力したMarkdown記法を除去する */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")   // **太字**
    .replace(/__(.+?)__/g, "$1")       // __太字__
    .replace(/(?<![\w*])\*([^*\n]+)\*(?![\w*])/g, "$1") // *斜体*
    .replace(/`([^`\n]+)`/g, "$1")     // `コード`
    .replace(/^#{1,6}\s+/gm, "")       // # 見出し
    .replace(/^\s*[-*]\s+/gm, "・");    // - 箇条書き → ・
}

async function callOpenAiChat(messages: Message[], config: { apiKey: string; model: string }): Promise<string | null> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages.map((m) => ({ role: m.role, content: m.text })),
      ],
      temperature: 0.5,
      max_tokens: 512,
    }),
  });
  if (!res.ok) return null;
  const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content ?? null;
}

async function callGeminiChat(messages: Message[], config: { apiKey: string; model: string }): Promise<string | null> {
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.text }],
  }));
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { temperature: 0.5, maxOutputTokens: 512 },
      }),
    },
  );
  if (!res.ok) return null;
  const json = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

async function callAnthropicChat(messages: Message[], config: { apiKey: string; model: string }): Promise<string | null> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: messages.map((m) => ({ role: m.role, content: m.text })),
    }),
  });
  if (!res.ok) return null;
  const json = await res.json() as { content?: Array<{ text?: string }> };
  return json.content?.[0]?.text ?? null;
}

export async function sendBridgeAiMessage(
  history: Message[],
  pathname: string,
): Promise<{ text: string; ok: boolean }> {
  // 設定取得とページコンテキスト取得を並列実行（応答時間短縮）
  const [config, pageContext] = await Promise.all([
    resolveLinqAiConfig(),
    fetchPageContext(pathname),
  ]);

  if (!config.enabled || !config.apiKey) {
    return {
      ok: false,
      text: "AI機能が設定されていません。管理者にお問い合わせください。",
    };
  }

  const messagesWithContext: Message[] = [
    ...history.slice(0, -1),
    {
      role: "user",
      text: [
        `[現在のページ: ${pathname}]`,
        pageContext ? `[現在のページコンテキスト（リアルタイムデータ）]\n${pageContext}` : "",
        history.at(-1)?.text ?? "",
      ].filter(Boolean).join("\n"),
    },
  ];

  try {
    let reply: string | null = null;
    const provider = config.provider ?? "openai";
    const llmConfig = { apiKey: config.apiKey, model: config.model ?? "gpt-4o-mini" };

    if (provider === "openai" || provider === "azure") {
      reply = await callOpenAiChat(messagesWithContext, llmConfig);
    } else if (provider === "google") {
      reply = await callGeminiChat(messagesWithContext, llmConfig);
    } else if (provider === "anthropic") {
      reply = await callAnthropicChat(messagesWithContext, llmConfig);
    }

    if (!reply) {
      return { ok: false, text: "AIからの応答を取得できませんでした。しばらくしてからもう一度お試しください。" };
    }

    return { ok: true, text: stripMarkdown(reply) };
  } catch {
    return { ok: false, text: "通信エラーが発生しました。しばらくしてからもう一度お試しください。" };
  }
}

export async function improveRecordingText(text: string): Promise<{ result: string; ok: boolean }> {
  const config = await resolveLinqAiConfig();

  if (!config.enabled || !config.apiKey) {
    return { ok: false, result: text };
  }

  try {
    const prompt = `以下の商談メモ・文字起こしを、要点が明確で読みやすいビジネス文書に整えてください。
- 箇条書きを活用
- 次のアクション（ToDo）があれば明記
- 元の内容を要約・改善するのみ（創作しない）
- 出力は整えたテキストのみ（説明文不要）

元のテキスト:
${text.slice(0, 4000)}`;

    const llmConfig = { apiKey: config.apiKey, model: config.model ?? "gpt-4o-mini" };
    let result: string | null = null;
    const provider = config.provider ?? "openai";

    if (provider === "openai" || provider === "azure") {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${llmConfig.apiKey}` },
        body: JSON.stringify({
          model: llmConfig.model,
          messages: [
            { role: "system", content: "あなたは工務店の優秀な営業秘書です。" },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 1024,
        }),
      });
      if (res.ok) {
        const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
        result = json.choices?.[0]?.message?.content ?? null;
      }
    } else if (provider === "google") {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${llmConfig.model}:generateContent?key=${llmConfig.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        },
      );
      if (res.ok) {
        const json = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
        result = json.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
      }
    } else if (provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": llmConfig.apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: llmConfig.model, max_tokens: 1024, messages: [{ role: "user", content: prompt }] }),
      });
      if (res.ok) {
        const json = await res.json() as { content?: Array<{ text?: string }> };
        result = json.content?.[0]?.text ?? null;
      }
    }

    if (!result) return { ok: false, result: text };
    return { ok: true, result };
  } catch {
    return { ok: false, result: text };
  }
}
