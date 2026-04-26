/**
 * 契約書テンプレート定義
 *
 * 各テンプレートは:
 *  - fields:  入力フォームのスキーマ
 *  - render:  入力値からプレビュー JSX を生成
 *  - defaults(ctx): 初期値（construction/customer から自動入力）
 */

export type FieldType = "text" | "textarea" | "date" | "number";

export type TemplateField = {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
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
      { name: "work_name",       label: "工事名称",           type: "text",     required: true,  placeholder: "○○邸 新築工事" },
      { name: "work_location",   label: "工事場所",           type: "text",     placeholder: "工事を行う場所（甲の住所と同じ場合は空欄可）" },
      { name: "amount_excl_tax", label: "請負金額（税抜・円）", type: "number" },
      { name: "tax_rate",        label: "消費税率（%）",      type: "number" },
      { name: "payment_terms",   label: "支払条件",           type: "textarea", placeholder: "契約時：30%、上棟時：30%、引渡時：40%" },
      { name: "warranty",        label: "瑕疵担保期間",       type: "text",     placeholder: "2年" },
      { name: "special_notes",   label: "特記事項",           type: "textarea", placeholder: "特記事項があればここに記入してください" },
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
      { name: "work_name",     label: "業務名称",     type: "text",     required: true,  placeholder: "○○邸 設計監理業務" },
      { name: "scope",         label: "業務範囲",     type: "textarea", placeholder: "・基本設計　・実施設計　・工事監理　など" },
      { name: "amount_excl_tax", label: "業務報酬（税抜・円）", type: "number" },
      { name: "tax_rate",      label: "消費税率（%）", type: "number" },
      { name: "payment_terms", label: "支払条件",     type: "textarea", placeholder: "契約時：50%、業務完了時：50%" },
      { name: "special_notes", label: "特記事項",     type: "textarea", placeholder: "特記事項があればここに記入してください" },
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
      { name: "original_work",   label: "原契約工事名",   type: "text",     required: true },
      { name: "original_date",   label: "原契約締結日",   type: "date" },
      { name: "change_summary",  label: "変更・追加内容", type: "textarea", required: true, placeholder: "・○○の追加\n・□□の仕様変更" },
      { name: "amount_excl_tax", label: "追加金額（税抜・円）", type: "number" },
      { name: "tax_rate",        label: "消費税率（%）",  type: "number" },
      { name: "extension_days",  label: "工期延長日数",   type: "number",   placeholder: "延長なしの場合は0" },
      { name: "special_notes",   label: "特記事項",       type: "textarea", placeholder: "特記事項があればここに記入してください" },
    ],
  },
];

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
      case "otsu_name":
        v[f.name] = "";
        break;
      case "otsu_address":
        v[f.name] = "";
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
      case "special_notes":
        v[f.name] = "";
        break;
      default:
        v[f.name] = (f.type === "number") ? 0 : "";
    }
  }
  return v;
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

export function renderPreview(template: ContractTemplate, values: FormValues, ctx: RenderContext): string {
  const period = ctx.construction
    ? `${ctx.construction.start_date ?? "—"} ～ ${ctx.construction.end_date ?? "—"}`
    : "—";

  if (template.id === "construction_contract") {
    const amount = fmtAmount(getNum(values, "amount_excl_tax"), getNum(values, "tax_rate"));
    const warranty = getStr(values, "warranty") || "2年";
    const specialNotes = getStr(values, "special_notes");
    return `
<div class="space-y-6 text-[13px] leading-relaxed">
  <h2 class="text-center text-xl font-bold tracking-wider mb-6">工事請負契約書</h2>
  <p>${getStr(values, "kou_name") || "［甲］"}（以下「甲」という）と${getStr(values, "otsu_name") || "［乙］"}（以下「乙」という）は、以下のとおり工事請負契約を締結する。</p>

  <div>
    <h3 class="font-bold mb-2">【第1条】工事概要</h3>
    <p>工事名称：${getStr(values, "work_name") || "—"}</p>
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

  <div>
    <h3 class="font-bold mb-2">【第4条】瑕疵担保責任</h3>
    <p>乙は、本工事の引渡し後${warranty}間、瑕疵担保責任を負うものとする。</p>
  </div>

  <div>
    <h3 class="font-bold mb-2">【特記事項】</h3>
    <p class="whitespace-pre-line border-b border-gray-300 pb-2 min-h-[48px]">${specialNotes || ""}</p>
  </div>

  <p class="text-sm mt-6">上記の契約を証するため、本書2通を作成し、甲乙記名捺印の上、各1通を保有する。</p>

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
    const specialNotes = getStr(values, "special_notes");
    return `
<div class="space-y-6 text-[13px] leading-relaxed">
  <h2 class="text-center text-xl font-bold tracking-wider mb-6">設計監理業務委託契約書</h2>
  <p>${getStr(values, "kou_name") || "［甲］"}（以下「甲」という）と${getStr(values, "otsu_name") || "［乙］"}（以下「乙」という）は、以下のとおり設計監理業務委託契約を締結する。</p>

  <div>
    <h3 class="font-bold mb-2">【第1条】業務概要</h3>
    <p>業務名称：${getStr(values, "work_name") || "—"}</p>
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

  <div>
    <h3 class="font-bold mb-2">【特記事項】</h3>
    <p class="whitespace-pre-line border-b border-gray-300 pb-2 min-h-[48px]">${specialNotes || ""}</p>
  </div>

  <p class="text-sm mt-6">上記の契約を証するため、本書2通を作成し、甲乙記名捺印の上、各1通を保有する。</p>

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
    const ext = getNum(values, "extension_days");
    const specialNotes = getStr(values, "special_notes");
    return `
<div class="space-y-6 text-[13px] leading-relaxed">
  <h2 class="text-center text-xl font-bold tracking-wider mb-6">追加工事契約書</h2>
  <p>${getStr(values, "kou_name") || "［甲］"}（以下「甲」という）と${getStr(values, "otsu_name") || "［乙］"}（以下「乙」という）は、以下のとおり追加工事契約を締結する。</p>

  <div>
    <h3 class="font-bold mb-2">【第1条】原契約</h3>
    <p>原契約工事名：${getStr(values, "original_work") || "—"}</p>
    <p>原契約締結日：${getStr(values, "original_date") || "—"}</p>
  </div>

  <div>
    <h3 class="font-bold mb-2">【第2条】変更・追加内容</h3>
    <p class="whitespace-pre-line">${getStr(values, "change_summary") || "—"}</p>
  </div>

  <div>
    <h3 class="font-bold mb-2">【第3条】追加請負代金</h3>
    <p>金 ${amount.excl} 円（税抜）</p>
    <p>消費税率：${amount.rate}%　消費税額：${amount.tax} 円</p>
    <p class="font-semibold">合計追加金額：${amount.total} 円（税込）</p>
  </div>

  <div>
    <h3 class="font-bold mb-2">【第4条】工期</h3>
    <p>${ext === 0 ? "原契約の工期に変更はない。" : `原契約の工期を ${ext} 日延長する。`}</p>
  </div>

  <div>
    <h3 class="font-bold mb-2">【特記事項】</h3>
    <p class="whitespace-pre-line border-b border-gray-300 pb-2 min-h-[48px]">${specialNotes || ""}</p>
  </div>

  <p class="text-sm mt-6">上記の契約を証するため、本書2通を作成し、甲乙記名捺印の上、各1通を保有する。</p>

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
