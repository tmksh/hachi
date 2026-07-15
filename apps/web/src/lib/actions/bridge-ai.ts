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

// ---------------------------------------------------------------------------
// 工程表作成ウィザード（No.6）: 対話形式で質問 → 工程表を自動生成して登録
// ---------------------------------------------------------------------------

const SCHEDULE_TAG = "【工程表作成";

/** 工事種別ごとの標準工程テンプレート（重み = 全工期に対する日数比率） */
const SCHEDULE_TEMPLATES: { match: RegExp; label: string; phases: { name: string; w: number }[] }[] = [
  {
    match: /新築/,
    label: "新築",
    phases: [
      { name: "地盤調査・準備工事", w: 6 }, { name: "基礎工事", w: 14 },
      { name: "上棟・躯体工事", w: 20 }, { name: "屋根・外装工事", w: 14 },
      { name: "電気・設備工事", w: 14 }, { name: "内装工事", w: 18 },
      { name: "外構工事", w: 8 }, { name: "竣工検査・是正", w: 4 }, { name: "クリーニング・引渡し", w: 2 },
    ],
  },
  {
    match: /屋根|外壁|塗装/,
    label: "屋根・外壁",
    phases: [
      { name: "足場設置", w: 8 }, { name: "高圧洗浄・下地処理", w: 15 },
      { name: "下塗り", w: 15 }, { name: "中塗り・上塗り", w: 30 },
      { name: "板金・雨樋工事", w: 15 }, { name: "検査・手直し", w: 9 }, { name: "足場解体・清掃", w: 8 },
    ],
  },
  {
    match: /水回り|水廻り|キッチン|浴室|風呂|トイレ|洗面/,
    label: "水回りリフォーム",
    phases: [
      { name: "養生・解体工事", w: 15 }, { name: "給排水・電気配管工事", w: 20 },
      { name: "下地・造作工事", w: 20 }, { name: "設備機器設置", w: 20 },
      { name: "内装仕上げ", w: 15 }, { name: "検査・引渡し", w: 10 },
    ],
  },
  {
    match: /内装|クロス|フローリング/,
    label: "内装リフォーム",
    phases: [
      { name: "養生・既存撤去", w: 15 }, { name: "下地補修", w: 20 },
      { name: "床工事", w: 20 }, { name: "壁・天井仕上げ", w: 25 },
      { name: "建具・造作調整", w: 10 }, { name: "クリーニング・引渡し", w: 10 },
    ],
  },
  {
    match: /.*/,
    label: "フルリフォーム",
    phases: [
      { name: "養生・仮設工事", w: 6 }, { name: "解体工事", w: 12 },
      { name: "下地・木工事", w: 22 }, { name: "電気・設備工事", w: 16 },
      { name: "内装仕上げ工事", w: 22 }, { name: "設備機器設置", w: 10 },
      { name: "検査・是正", w: 7 }, { name: "クリーニング・引渡し", w: 5 },
    ],
  },
];

function parseJaDate(text: string): Date | null {
  const now = new Date();
  let m = text.match(/(\d{4})[/\-年](\d{1,2})[/\-月](\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = text.match(/(\d{1,2})[/月](\d{1,2})/);
  if (m) {
    const d = new Date(now.getFullYear(), Number(m[1]) - 1, Number(m[2]));
    if (d.getTime() < now.getTime() - 86400000 * 30) d.setFullYear(d.getFullYear() + 1);
    return d;
  }
  if (/来週/.test(text)) return addDays(now, 7);
  if (/再来週/.test(text)) return addDays(now, 14);
  if (/来月/.test(text)) return addDays(now, 30);
  if (/明日/.test(text)) return addDays(now, 1);
  if (/今日|すぐ/.test(text)) return now;
  return null;
}

function parseDurationDays(text: string, startDate: Date): number | null {
  let m = text.match(/(\d+(?:\.\d+)?)\s*(?:ヶ|か|カ|ケ)月/);
  if (m) return Math.round(Number(m[1]) * 30);
  m = text.match(/(\d+)\s*週/);
  if (m) return Number(m[1]) * 7;
  m = text.match(/(\d+)\s*日/);
  if (m) return Number(m[1]);
  const end = parseJaDate(text);
  if (end && end.getTime() > startDate.getTime()) {
    return Math.round((end.getTime() - startDate.getTime()) / 86400000);
  }
  return null;
}

function fmtDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/**
 * 工事詳細ページで「工程表を作って」と言われたときの対話フロー。
 * AI設定の有無に依存せず動作する（質問3つ → construction_tasks へ自動登録）。
 */
async function handleScheduleWizard(history: Message[], pathname: string): Promise<{ text: string; ok: boolean } | null> {
  const path = pathname.split("?")[0];
  const m = path.match(/^\/constructions\/([0-9a-fA-F-]{36})/);
  if (!m) return null;
  const constructionId = m[1];

  const lastUser = history.at(-1)?.text ?? "";
  const lastAssistant = [...history].reverse().find(x => x.role === "assistant")?.text ?? "";
  const step =
    lastAssistant.startsWith(`${SCHEDULE_TAG} 1/3】`) ? 1 :
    lastAssistant.startsWith(`${SCHEDULE_TAG} 2/3】`) ? 2 :
    lastAssistant.startsWith(`${SCHEDULE_TAG} 3/3】`) ? 3 : 0;

  // ウィザード外: 工程表作成の意図を検知したら開始
  if (step === 0) {
    const wantsSchedule = /工程表|工程を/.test(lastUser) && /(作って|作成|生成|組んで|引いて|お願い)/.test(lastUser);
    if (!wantsSchedule) return null;
    return {
      ok: true,
      text: `${SCHEDULE_TAG} 1/3】承知しました。最適な工程表を作成するため、順番にお伺いします。\n\nまず、どのような工事内容ですか？\n（例: 新築 / フルリフォーム / 内装リフォーム / 水回りリフォーム / 屋根・外壁塗装）`,
    };
  }

  // 途中キャンセル
  if (/キャンセル|やめる|中止/.test(lastUser)) {
    return { ok: true, text: "工程表の作成を中止しました。また必要になったら「工程表を作って」と話しかけてください。" };
  }

  if (step === 1) {
    return {
      ok: true,
      text: `${SCHEDULE_TAG} 2/3】ありがとうございます。\n\n次に、着工予定日を教えてください。\n（例: 2026/08/01、8月1日、来週 など）`,
    };
  }
  if (step === 2) {
    const start = parseJaDate(lastUser);
    if (!start) {
      return { ok: true, text: `${SCHEDULE_TAG} 2/3】すみません、日付を読み取れませんでした。着工予定日をもう一度教えてください。（例: 2026/08/01、8月1日）` };
    }
    return {
      ok: true,
      text: `${SCHEDULE_TAG} 3/3】着工日は ${format(start, "yyyy年M月d日")} ですね。\n\n最後に、全体の工期を教えてください。\n（例: 2ヶ月、8週間、60日、または完了希望日 10/15）`,
    };
  }

  // step 3: 各質問への回答を収集して工程表を生成（再入力があれば最後の回答を採用）
  const answersByStep: Record<number, string> = {};
  for (let i = 0; i < history.length - 1; i++) {
    const msg = history[i];
    if (msg.role !== "assistant" || !msg.text.startsWith(SCHEDULE_TAG)) continue;
    const sm = msg.text.match(/【工程表作成 (\d)\/3】/);
    const next = history[i + 1];
    if (sm && next?.role === "user") answersByStep[Number(sm[1])] = next.text;
  }
  const typeAnswer = answersByStep[1] ?? "";
  const dateAnswer = answersByStep[2] ?? "";
  const durationAnswer = lastUser;

  const template = SCHEDULE_TEMPLATES.find(t => t.match.test(typeAnswer)) ?? SCHEDULE_TEMPLATES[SCHEDULE_TEMPLATES.length - 1];
  const start = parseJaDate(dateAnswer) ?? parseJaDate(typeAnswer) ?? addDays(new Date(), 14);
  const totalDays = parseDurationDays(durationAnswer, start);
  if (!totalDays) {
    return { ok: true, text: `${SCHEDULE_TAG} 3/3】すみません、工期を読み取れませんでした。もう一度教えてください。（例: 2ヶ月、8週間、60日）` };
  }

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, text: "ログイン情報を確認できませんでした。再ログイン後にお試しください。" };
    const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
    if (!profile) return { ok: false, text: "プロフィール情報を取得できませんでした。" };

    const totalW = template.phases.reduce((s, p) => s + p.w, 0);
    let cursor = 0;
    const rows = template.phases.map((p, i) => {
      const days = Math.max(1, Math.round((p.w / totalW) * totalDays));
      const s = addDays(start, cursor);
      const e = addDays(start, Math.min(cursor + days - 1, totalDays - 1));
      cursor += days;
      return {
        company_id: profile.company_id,
        construction_id: constructionId,
        name: p.name,
        start_date: fmtDate(s),
        end_date: fmtDate(e),
        status: "not_started",
        sort_order: i,
      };
    });

    const { error } = await supabase.from("construction_tasks").insert(rows);
    if (error) throw error;

    const lines = rows.map(r => `・${r.name}: ${r.start_date.replace(/-/g, "/")} 〜 ${r.end_date.replace(/-/g, "/")}`);
    return {
      ok: true,
      text: [
        `工程表を作成しました！（${template.label} / 着工 ${format(start, "yyyy年M月d日")} / 工期 約${totalDays}日）`,
        "",
        ...lines,
        "",
        "「工程表」タブに反映済みです。ページを再読み込みすると表示されます。各工程はガントチャート上で編集・調整できます。",
      ].join("\n"),
    };
  } catch (e) {
    console.error("[handleScheduleWizard] task insert failed", e);
    return { ok: false, text: "工程表の登録中にエラーが発生しました。もう一度お試しください。" };
  }
}

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
  // 工程表作成ウィザード（No.6）: AI設定に依存せず対話→自動生成
  const wizardReply = await handleScheduleWizard(history, pathname);
  if (wizardReply) return wizardReply;

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
