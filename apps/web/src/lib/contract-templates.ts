/**
 * 契約書テンプレート定義
 *
 * 各テンプレートは:
 *  - fields:  入力フォームのスキーマ
 *  - render:  入力値からプレビュー JSX を生成
 *  - defaults(ctx): 初期値（construction/customer から自動入力）
 */

export type FieldType = "text" | "textarea" | "date" | "number" | "toggle";

export type TemplateField = {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  synced?: boolean; // 工程表から自動連携されるフィールド
  readonly?: boolean;
};

export type ContractTemplate = {
  id: string;
  name: string;
  description: string;
  fields: TemplateField[];
};

export type FormValues = Record<string, string | number>;

export type RenderContext = {
  construction: {
    title: string;
    start_date: string | null;
    end_date: string | null;
    order_amount: number | null;
  } | null;
  customer: {
    name: string;
    address: string | null;
  } | null;
  /** 乙（請負者＝自社）— 設定の発行元情報または会社名 */
  company?: {
    name: string;
    address: string;
  } | null;
};

export const CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    id: "construction_contract",
    name: "工事請負契約書",
    description: "住宅新築・リフォーム工事向けの標準的な請負契約書",
    fields: [
      { name: "contract_date",   label: "契約日",             type: "date",     required: true },
      { name: "kou_name",        label: "発注者（甲）",       type: "text",     required: true,  placeholder: "山田 太郎" },
      { name: "kou_address",     label: "甲の住所",           type: "text",     required: true,  placeholder: "東京都世田谷区..." },
      { name: "otsu_name",       label: "請負者（乙）",       type: "text",     required: true,  placeholder: "○○建設株式会社" },
      { name: "otsu_address",    label: "乙の住所",           type: "text",     required: true,  placeholder: "東京都新宿区..." },
      { name: "work_name",       label: "名称",               type: "text",     required: true,  placeholder: "○○邸 新築 / サイン制作 など" },
      { name: "work_location",   label: "工事場所",           type: "text",     placeholder: "工事を行う場所（甲の住所と同じ場合は空欄可）" },
      { name: "amount_excl_tax", label: "請負金額（税抜・円）", type: "number" },
      { name: "tax_rate",        label: "消費税率（%）",      type: "number" },
      { name: "start_date",      label: "工期開始日",         type: "date",     synced: true },
      { name: "end_date",        label: "工期終了日",         type: "date",     synced: true },
      { name: "payment_terms",   label: "支払条件",           type: "textarea", placeholder: "着工時30%、上棟時30%、完成引渡時40%" },
      { name: "warranty_years",  label: "瑕疵担保期間（年）", type: "number",   placeholder: "10" },
      { name: "warranty_include",label: "瑕疵担保条項を含める", type: "toggle" },
      { name: "special_notes_fixed", label: "特記事項（固定）", type: "textarea", readonly: true },
      { name: "special_notes",   label: "特記事項（この案件で変わる部分）", type: "textarea", placeholder: "案件ごとに変わる特記事項" },
      { name: "terms_mode",      label: "約款をテキストで編集する", type: "toggle" },
      { name: "terms_text",      label: "約款（テキスト）", type: "textarea", placeholder: "約款を貼り付ける" },
      { name: "esign_only",      label: "電子文書として締結する", type: "toggle" },
    ],
  },
  {
    id: "design_supervision",
    name: "設計監理契約書",
    description: "設計監理業務委託用の契約書テンプレート",
    fields: [
      { name: "contract_date", label: "契約日",       type: "date",   required: true },
      { name: "kou_name",      label: "委託者（甲）", type: "text",     required: true },
      { name: "kou_address",   label: "甲の住所",     type: "text",     required: true },
      { name: "otsu_name",     label: "受託者（乙）", type: "text",     required: true,  placeholder: "○○設計事務所" },
      { name: "otsu_address",  label: "乙の住所",     type: "text",     required: true },
      { name: "work_name",     label: "業務名称",         type: "text",     required: true,  placeholder: "○○邸 設計監理業務" },
      { name: "work_location", label: "対象建物所在地",   type: "text",     placeholder: "東京都世田谷区..." },
      { name: "amount_excl_tax", label: "業務報酬（税抜・円）", type: "number" },
      { name: "tax_rate",      label: "消費税率（%）",   type: "number" },
      { name: "start_date",    label: "業務開始日",       type: "date",     synced: true },
      { name: "end_date",      label: "業務完了日",       type: "date",     synced: true },
      { name: "scope",         label: "業務範囲",         type: "textarea", placeholder: "基本設計、実施設計、確認申請、工事監理" },
      { name: "special_notes_fixed", label: "特記事項（固定）", type: "textarea", readonly: true },
      { name: "special_notes", label: "特記事項（この案件で変わる部分）", type: "textarea", placeholder: "特記事項があればここに記入してください" },
      { name: "terms_mode",    label: "約款をテキストで編集する", type: "toggle" },
      { name: "terms_text",    label: "約款（テキスト）", type: "textarea", placeholder: "約款を貼り付ける" },
      { name: "esign_only",    label: "電子文書として締結する", type: "toggle" },
    ],
  },
  {
    id: "change_order",
    name: "追加工事契約書",
    description: "既存契約に対する追加・変更工事用の契約書",
    fields: [
      { name: "contract_date",   label: "契約日",         type: "date",     required: true },
      { name: "kou_name",        label: "発注者（甲）",   type: "text",     required: true },
      { name: "kou_address",     label: "甲の住所",       type: "text",     required: true },
      { name: "otsu_name",       label: "請負者（乙）",   type: "text",     required: true },
      { name: "otsu_address",    label: "乙の住所",       type: "text",     required: true },
      { name: "original_work",   label: "原契約名称",   type: "text",     required: true },
      { name: "original_date",   label: "原契約締結日",   type: "date" },
      { name: "work_name",       label: "名称",           type: "text",     required: true, placeholder: "○○邸 新築工事" },
      { name: "change_summary",  label: "変更内容",       type: "textarea", required: true, placeholder: "・○○の追加\n・□□の仕様変更" },
      { name: "amount_excl_tax", label: "追加金額（税抜・円）", type: "number" },
      { name: "tax_rate",        label: "消費税率（%）",  type: "number" },
      { name: "end_date",        label: "変更後工期終了日", type: "date",   synced: true },
      { name: "special_notes_fixed", label: "特記事項（固定）", type: "textarea", readonly: true },
      { name: "special_notes",   label: "特記事項（この案件で変わる部分）", type: "textarea", placeholder: "特記事項があればここに記入してください" },
      { name: "terms_mode",      label: "約款をテキストで編集する", type: "toggle" },
      { name: "terms_text",      label: "約款（テキスト）", type: "textarea", placeholder: "約款を貼り付ける" },
      { name: "esign_only",      label: "電子文書として締結する", type: "toggle" },
    ],
  },
];

export const DEFAULT_CONTRACT_TERMS = `第1条（総則）
本約款は、本書面に添付する契約の一部をなす。

第2条（法令遵守）
乙は、関係法令を遵守して業務を遂行する。

第3条（協議）
本契約および本約款に定めのない事項は、甲乙誠意をもって協議のうえ定める。`;

const DESIGN_CONTRACT_TERMS = `第1条（総則）
本約款は、本設計監理業務委託契約の一部をなす。

第2条（業務の遂行）
乙は、関係法令および委託の趣旨に従い、善良な管理者の注意をもって業務を遂行する。

第3条（協議）
本契約および本約款に定めのない事項は、甲乙誠意をもって協議のうえ定める。`;

const CHANGE_ORDER_TERMS = `第1条（総則）
本約款は、原契約および本追加変更契約の一部をなす。原契約に定めのある事項は、本契約に別段の定めがない限り原契約による。

第2条（効力）
本契約は、原契約と一体として効力を有する。

第3条（協議）
本契約および本約款に定めのない事項は、甲乙誠意をもって協議のうえ定める。`;

export function termsForTemplate(templateId: string): string {
  if (templateId === "design_supervision") return DESIGN_CONTRACT_TERMS;
  if (templateId === "change_order") return CHANGE_ORDER_TERMS;
  return DEFAULT_CONTRACT_TERMS;
}

export function fixedSpecialNotes(templateId: string): string {
  if (templateId === "construction_contract") {
    return "本契約は、工期の着手日から効力を成す。\n本契約に定めのない事項は、関係法令および信義誠実の原則により協議のうえ定める。";
  }
  return "本契約に定めのない事項は、関係法令および信義誠実の原則により協議のうえ定める。";
}

export function findTemplate(id: string): ContractTemplate | undefined {
  return CONTRACT_TEMPLATES.find(t => t.id === id);
}

export function buildDefaults(template: ContractTemplate, ctx: RenderContext): FormValues {
  const today = new Date().toISOString().slice(0, 10);
  const v: FormValues = {};
  for (const f of template.fields) {
    switch (f.name) {
      case "contract_date":
      case "original_date":
        v[f.name] = today;
        break;
      case "kou_name":
        v[f.name] = ctx.customer?.name ?? "";
        break;
      case "kou_address":
      case "work_location":
        v[f.name] = ctx.customer?.address ?? "";
        break;
      case "start_date":
        v[f.name] = ctx.construction?.start_date ?? "";
        break;
      case "end_date":
        v[f.name] = ctx.construction?.end_date ?? "";
        break;
      case "otsu_name":
        v[f.name] = ctx.company?.name ?? "";
        break;
      case "otsu_address":
        v[f.name] = ctx.company?.address ?? "";
        break;
      case "work_name":
      case "original_work":
        v[f.name] = ctx.construction?.title ?? "";
        break;
      case "amount_excl_tax":
        v[f.name] = ctx.construction?.order_amount ?? 0;
        break;
      case "tax_rate":
        v[f.name] = 10;
        break;
      case "extension_days":
        v[f.name] = 0;
        break;
      case "warranty_years":
        v[f.name] = 10;
        break;
      case "warranty_include":
        v[f.name] = 1;
        break;
      case "payment_terms":
        v[f.name] = "着工時30%、上棟時30%、完成引渡時40%";
        break;
      case "special_notes_fixed":
        v[f.name] = fixedSpecialNotes(template.id);
        break;
      case "special_notes":
        v[f.name] = "";
        break;
      case "terms_mode":
        v[f.name] = 0;
        break;
      case "terms_text":
        v[f.name] = termsForTemplate(template.id);
        break;
      case "esign_only":
        v[f.name] = 1;
        break;
      default:
        v[f.name] = (f.type === "number" || f.type === "toggle") ? 0 : "";
    }
  }
  return v;
}

/** 設定のPDF発行元情報・会社情報から自社（乙）情報を解決 */
export function resolveCompanyContext(
  company: { name: string; settings?: Record<string, unknown> | null } | null | undefined,
  pdf: { issuerName?: string; issuerAddress?: string } | null | undefined,
): { name: string; address: string } {
  const settings = (company?.settings ?? {}) as Record<string, string>;
  return {
    name: pdf?.issuerName?.trim() || company?.name || "",
    address: pdf?.issuerAddress?.trim() || settings.address?.trim() || "",
  };
}

/** 顧客・工事・工程表のマスタデータをフォームに反映 */
export function syncFromContext(form: FormValues, ctx: RenderContext): FormValues {
  const next = { ...form };
  if (ctx.customer?.name) next.kou_name = ctx.customer.name;
  if (ctx.customer?.address) {
    next.kou_address = ctx.customer.address;
    if (!next.work_location) next.work_location = ctx.customer.address;
  }
  if (ctx.construction?.title) {
    next.work_name = ctx.construction.title;
    if (!next.original_work) next.original_work = ctx.construction.title;
  }
  if (ctx.construction?.order_amount != null) next.amount_excl_tax = ctx.construction.order_amount;
  if (ctx.construction?.start_date) next.start_date = ctx.construction.start_date;
  if (ctx.construction?.end_date) next.end_date = ctx.construction.end_date;
  if (ctx.company?.name && !next.otsu_name) next.otsu_name = ctx.company.name;
  if (ctx.company?.address && !next.otsu_address) next.otsu_address = ctx.company.address;
  return next;
}

/** PDF出力・CloudSign送信前に案件情報を埋め、固定特記をテンプレートに戻す */
export function prepareFormForOutput(
  template: ContractTemplate,
  ctx: RenderContext,
  current: FormValues,
  opts?: { esign?: boolean },
): FormValues {
  const synced = syncFromContext(current, ctx);
  const merged = mergeDefaults(template, ctx, synced);
  merged.special_notes_fixed = fixedSpecialNotes(template.id);
  if (getNum(merged, "terms_mode") === 0) {
    merged.terms_text = termsForTemplate(template.id);
  }
  if (opts?.esign) merged.esign_only = 1;
  return merged;
}

/** 空欄のみ buildDefaults で補完（既存入力は保持） */
export function mergeDefaults(
  template: ContractTemplate,
  ctx: RenderContext,
  current: FormValues,
): FormValues {
  const defaults = buildDefaults(template, ctx);
  const merged: FormValues = { ...defaults };
  for (const f of template.fields) {
    if (f.readonly || f.name === "special_notes_fixed") {
      merged[f.name] = defaults[f.name];
      continue;
    }
    const cur = current[f.name];
    if (cur === undefined || cur === null || cur === "") continue;
    if (f.type === "toggle") {
      merged[f.name] = cur === 0 || cur === "0" ? 0 : 1;
      continue;
    }
    merged[f.name] = cur;
  }
  if (getNum(merged, "terms_mode") === 0) {
    merged.terms_text = termsForTemplate(template.id);
  }
  return merged;
}

/* ───────────────────── プレビュー生成（プレーンHTML文字列） ───────────────────── */
function fmtAmount(amount: number, taxRate: number) {
  const tax = Math.floor(amount * taxRate / 100);
  return {
    excl: amount.toLocaleString(),
    rate: taxRate,
    tax:  tax.toLocaleString(),
    total: (amount + tax).toLocaleString(),
  };
}

function getStr(v: FormValues, k: string): string {
  const x = v[k];
  return x === undefined || x === null ? "" : String(x);
}
function getNum(v: FormValues, k: string): number {
  const x = v[k];
  return typeof x === "number" ? x : Number(x) || 0;
}

function specialNotesBlock(values: FormValues, templateId: string): string {
  const fixed = fixedSpecialNotes(templateId);
  const extra = getStr(values, "special_notes");
  const parts: string[] = [];
  if (fixed) {
    parts.push(`<p class="text-[11px] text-gray-500 mb-1">（テンプレート固定）</p><p class="whitespace-pre-line">${fixed}</p>`);
  }
  if (extra) {
    parts.push(`<p class="text-[11px] text-gray-500 mt-2 mb-1">（本件）</p><p class="whitespace-pre-line">${extra}</p>`);
  }
  if (parts.length === 0) {
    parts.push(`<p class="whitespace-pre-line min-h-[48px]"></p>`);
  }
  return `<div>
    <h3 class="font-bold mb-2">【特記事項】</h3>
    ${parts.join("")}
    <p class="border-b border-gray-300 pb-2"></p>
  </div>`;
}

function termsBlock(values: FormValues, templateId: string): string {
  const editInTextarea = getNum(values, "terms_mode") !== 0;
  const text = editInTextarea ? getStr(values, "terms_text") : termsForTemplate(templateId);
  if (!text.trim()) return "";
  return `<div>
    <h3 class="font-bold mb-2">【約款】</h3>
    <p class="text-[11px] text-gray-500 mb-1">${editInTextarea ? "（テキストエリアで編集）" : "（ひな形に含む）"}</p>
    <p class="whitespace-pre-line text-[12px]">${text}</p>
  </div>`;
}

function closingClause(values: FormValues): string {
  const esign = getNum(values, "esign_only") !== 0;
  return esign
    ? `<p class="text-sm mt-6">上記の契約を証するため、電子文書を作成し、甲乙双方がこれを保管する。</p>`
    : `<p class="text-sm mt-6">上記の契約を証するため、本書2通を作成し、甲乙記名捺印の上、各1通を保有する。</p>`;
}

export function renderPreview(template: ContractTemplate, values: FormValues, ctx: RenderContext): string {
  const startDate = getStr(values, "start_date") || ctx.construction?.start_date || "—";
  const endDate   = getStr(values, "end_date")   || ctx.construction?.end_date   || "—";
  const period    = `${startDate} ～ ${endDate}`;

  if (template.id === "construction_contract") {
    const amount = fmtAmount(getNum(values, "amount_excl_tax"), getNum(values, "tax_rate"));
    const warrantyYears   = getNum(values, "warranty_years") || 10;
    const warrantyInclude = getNum(values, "warranty_include") !== 0;
    return `
<div class="space-y-6 text-[13px] leading-relaxed">
  <h2 class="text-center text-xl font-bold tracking-wider mb-6">工事請負契約書</h2>
  <p>${getStr(values, "kou_name") || "［甲］"}（以下「甲」という）と${getStr(values, "otsu_name") || "［乙］"}（以下「乙」という）は、以下のとおり工事請負契約を締結する。</p>

  <div>
    <h3 class="font-bold mb-2">【第1条】工事概要</h3>
    <p>名称：${getStr(values, "work_name") || "—"}</p>
    <p>工事場所：${getStr(values, "work_location") || getStr(values, "kou_address") || "—"}</p>
    <p>工　　期：${period}</p>
  </div>

  <div>
    <h3 class="font-bold mb-2">【第2条】請負代金</h3>
    <p>金 ${amount.excl} 円（税抜）</p>
    <p>消費税率：${amount.rate}%　消費税額：${amount.tax} 円</p>
    <p class="font-semibold">合計請負代金：${amount.total} 円（税込）</p>
  </div>

  <div>
    <h3 class="font-bold mb-2">【第3条】支払条件</h3>
    <p class="whitespace-pre-line">${getStr(values, "payment_terms") || "—"}</p>
  </div>

  ${warrantyInclude ? `<div>
    <h3 class="font-bold mb-2">【第4条】瑕疵担保責任</h3>
    <p>乙は、本工事の引渡し後${warrantyYears}年間、瑕疵担保責任を負うものとする。</p>
  </div>` : ""}

  ${specialNotesBlock(values, template.id)}

  ${termsBlock(values, template.id)}

  ${closingClause(values)}

  <p class="text-right text-sm">契約日：${getStr(values, "contract_date") || "—"}</p>

  <div class="grid grid-cols-2 gap-8 text-sm pt-4">
    <div>
      <p class="font-semibold mb-2">甲（発注者）</p>
      <p>住所：${getStr(values, "kou_address") || "—"}</p>
      <p class="mt-3">氏名：${getStr(values, "kou_name") || "—"}　　　印</p>
    </div>
    <div>
      <p class="font-semibold mb-2">乙（請負者）</p>
      <p>住所：${getStr(values, "otsu_address") || "—"}</p>
      <p class="mt-3">氏名：${getStr(values, "otsu_name") || "—"}　　　印</p>
    </div>
  </div>
</div>`;
  }

  if (template.id === "design_supervision") {
    const amount = fmtAmount(getNum(values, "amount_excl_tax"), getNum(values, "tax_rate"));
    return `
<div class="space-y-6 text-[13px] leading-relaxed">
  <h2 class="text-center text-xl font-bold tracking-wider mb-6">設計監理業務委託契約書</h2>
  <p>${getStr(values, "kou_name") || "［甲］"}（以下「甲」という）と${getStr(values, "otsu_name") || "［乙］"}（以下「乙」という）は、以下のとおり設計監理業務委託契約を締結する。</p>

  <div>
    <h3 class="font-bold mb-2">【第1条】業務概要</h3>
    <p>業務名称：${getStr(values, "work_name") || "—"}</p>
    <p>対象建物所在地：${getStr(values, "work_location") || "—"}</p>
    <p>業務期間：${period}</p>
  </div>

  <div>
    <h3 class="font-bold mb-2">【第2条】業務範囲</h3>
    <p class="whitespace-pre-line">${getStr(values, "scope") || "—"}</p>
  </div>

  <div>
    <h3 class="font-bold mb-2">【第3条】業務報酬</h3>
    <p>金 ${amount.excl} 円（税抜）</p>
    <p>消費税率：${amount.rate}%　消費税額：${amount.tax} 円</p>
    <p class="font-semibold">合計報酬額：${amount.total} 円（税込）</p>
  </div>

  <div>
    <h3 class="font-bold mb-2">【第4条】支払条件</h3>
    <p class="whitespace-pre-line">${getStr(values, "payment_terms") || "—"}</p>
  </div>

  ${specialNotesBlock(values, template.id)}

  ${termsBlock(values, template.id)}

  ${closingClause(values)}

  <p class="text-right text-sm">契約日：${getStr(values, "contract_date") || "—"}</p>

  <div class="grid grid-cols-2 gap-8 text-sm pt-4">
    <div>
      <p class="font-semibold mb-2">甲（委託者）</p>
      <p>住所：${getStr(values, "kou_address") || "—"}</p>
      <p class="mt-3">氏名：${getStr(values, "kou_name") || "—"}　　　印</p>
    </div>
    <div>
      <p class="font-semibold mb-2">乙（受託者）</p>
      <p>住所：${getStr(values, "otsu_address") || "—"}</p>
      <p class="mt-3">氏名：${getStr(values, "otsu_name") || "—"}　　　印</p>
    </div>
  </div>
</div>`;
  }

  if (template.id === "change_order") {
    const amount = fmtAmount(getNum(values, "amount_excl_tax"), getNum(values, "tax_rate"));
    return `
<div class="space-y-6 text-[13px] leading-relaxed">
  <h2 class="text-center text-xl font-bold tracking-wider mb-6">追加変更工事契約書</h2>
  <p>${getStr(values, "kou_name") || "［甲］"}（以下「甲」という）と${getStr(values, "otsu_name") || "［乙］"}（以下「乙」という）は、________工事請負契約書（以下「原契約」という）に基づく下記工事について、追加変更契約を締結する。</p>

  <div>
    <h3 class="font-bold mb-2">【第1条】名称</h3>
    <p>${getStr(values, "work_name") || "—"}</p>
  </div>

  <div>
    <h3 class="font-bold mb-2">【第2条】変更内容</h3>
    <p class="whitespace-pre-line">${getStr(values, "change_summary") || "—"}</p>
  </div>

  <div>
    <h3 class="font-bold mb-2">【第3条】追加請負代金</h3>
    <p>金 ${amount.excl} 円（税抜）</p>
    <p>消費税率：${amount.rate}%　消費税額：${amount.tax} 円</p>
    <p class="font-semibold">合計金額：${amount.total} 円（税込）</p>
  </div>

  <div>
    <h3 class="font-bold mb-2">【第4条】変更後工期</h3>
    <p>変更後工期終了日：${endDate}</p>
  </div>

  ${specialNotesBlock(values, template.id)}

  ${termsBlock(values, template.id)}

  ${closingClause(values)}

  <p class="text-right text-sm">契約日：${getStr(values, "contract_date") || "—"}</p>

  <div class="grid grid-cols-2 gap-8 text-sm pt-4">
    <div>
      <p class="font-semibold mb-2">甲（発注者）</p>
      <p>住所：${getStr(values, "kou_address") || "—"}</p>
      <p class="mt-3">氏名：${getStr(values, "kou_name") || "—"}　　　印</p>
    </div>
    <div>
      <p class="font-semibold mb-2">乙（請負者）</p>
      <p>住所：${getStr(values, "otsu_address") || "—"}</p>
      <p class="mt-3">氏名：${getStr(values, "otsu_name") || "—"}　　　印</p>
    </div>
  </div>
</div>`;
  }

  return "<p>テンプレートが見つかりません</p>";
}
