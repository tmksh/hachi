/** シート9: 発注〜帳票データ・納品検収の共通定義 */

export const PROCUREMENT_ACCOUNT_ITEMS = [
  { name: "外注加工費", hint: "最も多い" },
  { name: "材料費", hint: "最も多い" },
  { name: "委託費", hint: "外注を頼むと委託費になる" },
  { name: "労務費", hint: "" },
  { name: "消耗品費", hint: "" },
  { name: "支払手数料", hint: "" },
  { name: "その他", hint: "一覧はテナントごとに追加可" },
] as const;

export type ProcurementAccountItemName = (typeof PROCUREMENT_ACCOUNT_ITEMS)[number]["name"];

export const LEDGER_STATUSES = [
  "none",
  "ordered",
  "delivered",
  "inspected",
  "invoice_received",
  "confirmed",
  "payment_approved",
] as const;

export type LedgerStatus = (typeof LEDGER_STATUSES)[number];

export const LEDGER_STATUS_META: Record<
  LedgerStatus,
  { label: string; cls: string; bar: string; nextActor: string }
> = {
  none: {
    label: "未発注",
    cls: "bg-gray-100 text-gray-600",
    bar: "bg-gray-100 text-gray-700",
    nextActor: "",
  },
  ordered: {
    label: "発注済み",
    cls: "bg-slate-100 text-slate-700",
    bar: "bg-slate-100 text-slate-700",
    nextActor: "担当者が納品を登録",
  },
  delivered: {
    label: "納品済み（検収待ち）",
    cls: "bg-orange-100 text-orange-800",
    bar: "bg-orange-50 text-orange-800 border-orange-200",
    nextActor: "担当者が検収完了",
  },
  inspected: {
    label: "検収完了（請求待ち）",
    cls: "bg-emerald-100 text-emerald-800",
    bar: "bg-emerald-50 text-emerald-800 border-emerald-200",
    nextActor: "請求書の受領待ち",
  },
  invoice_received: {
    label: "請求書受領",
    cls: "bg-sky-100 text-sky-800",
    bar: "bg-sky-50 text-sky-800 border-sky-200",
    nextActor: "ディレクターが確認",
  },
  confirmed: {
    label: "確認済み",
    cls: "bg-violet-100 text-violet-800",
    bar: "bg-violet-50 text-violet-800 border-violet-200",
    nextActor: "経理が承認",
  },
  payment_approved: {
    label: "承認済み",
    cls: "bg-green-100 text-green-800",
    bar: "bg-green-50 text-green-800 border-green-200",
    nextActor: "帳票データへ",
  },
};

export type OrderDisplayStatus = "draft" | "submitted" | "approved" | "sent" | "concluded" | "rejected";

export const ORDER_DISPLAY_STATUS_META: Record<
  OrderDisplayStatus,
  { label: string; cls: string }
> = {
  draft: { label: "下書き", cls: "bg-gray-100 text-gray-600" },
  submitted: { label: "申請中", cls: "bg-orange-100 text-orange-800" },
  approved: { label: "承認済", cls: "bg-green-100 text-green-700" },
  sent: { label: "送信済", cls: "bg-blue-100 text-blue-700" },
  concluded: { label: "締結済", cls: "bg-teal-100 text-teal-800" },
  rejected: { label: "差戻し", cls: "bg-red-100 text-red-600" },
};

export const CSV_OUTPUT_COLUMNS = [
  { key: "projectNo", label: "案件番号", defaultOn: true },
  { key: "projectName", label: "案件名", defaultOn: true },
  { key: "vendorName", label: "業者名", defaultOn: true },
  { key: "department", label: "部門", defaultOn: true },
  { key: "deliveryDate", label: "納品日（取引日）", defaultOn: true },
  { key: "amountExcl", label: "税抜金額", defaultOn: true },
  { key: "tax", label: "消費税", defaultOn: true },
  { key: "amountIncl", label: "税込金額", defaultOn: true },
  { key: "accountItem", label: "勘定科目", defaultOn: false },
  { key: "invoiceNo", label: "請求番号", defaultOn: true },
  { key: "orderTitle", label: "発生元（工事台帳/発注者）", defaultOn: false },
] as const;

export type CsvOutputColumnKey = (typeof CSV_OUTPUT_COLUMNS)[number]["key"];

export const ACCOUNTING_ROLES = ["hq_admin", "admin", "administration", "executive"] as const;

export type InvoiceChannel = "email" | "paper";

/** 議事録 2026/08/27: 紙発注・自社書式は社内PDF添付。未設定かつメールなしは紙発注とみなす。 */
export function invoiceChannelOf(craftsman?: {
  invoice_channel?: string | null;
  email?: string | null;
  kind?: string | null;
} | null): InvoiceChannel {
  if (craftsman?.kind === "system") return "email";
  if (craftsman?.invoice_channel === "paper") return "paper";
  if (craftsman?.invoice_channel === "email") return "email";
  return craftsman?.email ? "email" : "paper";
}

export function isPaperInvoice(craftsman?: {
  invoice_channel?: string | null;
  email?: string | null;
  kind?: string | null;
} | null): boolean {
  return invoiceChannelOf(craftsman) === "paper";
}

/** 請求書で確認した税抜金額。未入力なら発注金額。帳票・全銀はこれを使う。 */
export function billedExclOf(order: {
  vendor_invoice_amount?: number | string | null;
  amount?: number | string | null;
}): number {
  if (order.vendor_invoice_amount != null && order.vendor_invoice_amount !== "") {
    const n = Number(order.vendor_invoice_amount);
    if (Number.isFinite(n)) return n;
  }
  return Number(order.amount ?? 0);
}

export function isAccountingRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return (ACCOUNTING_ROLES as readonly string[]).includes(role);
}

export function yen(n: number): string {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export function taxOf(excl: number, rate = 0.1): number {
  return Math.round(excl * rate);
}

export function inclOf(excl: number, rate = 0.1): number {
  return Math.round(excl) + taxOf(excl, rate);
}

export function formatDateSlash(iso: string | null | undefined): string {
  if (!iso) return "—";
  return iso.slice(0, 10).replaceAll("-", "/");
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const ACCOUNT_HINTS: Array<{ re: RegExp; item: string }> = [
  { re: /資材|材料|コーナン|ホームセンター|商会|建材/, item: "材料費" },
  { re: /清掃|委託|管理|警備|デザイン|設計/, item: "委託費" },
  { re: /消耗|文具|オフィス/, item: "消耗品費" },
  { re: /手数料|振込/, item: "支払手数料" },
  { re: /塗装|建設|工事|施工|土木|設備|電気|水道/, item: "外注加工費" },
];

export function suggestAccountItem(vendorName: string | null | undefined): {
  item: string;
  source: "ai";
} {
  const name = vendorName?.trim() ?? "";
  for (const hint of ACCOUNT_HINTS) {
    if (hint.re.test(name)) return { item: hint.item, source: "ai" };
  }
  return { item: "外注加工費", source: "ai" };
}

export function deriveOrderDisplayStatus(order: {
  status: string;
  clouds_sign_sent_at?: string | null;
  concluded_at?: string | null;
  ledger_status?: string | null;
}): OrderDisplayStatus {
  if (order.status === "draft") return "draft";
  if (order.status === "submitted") return "submitted";
  if (order.status === "rejected") return "rejected";
  if (order.concluded_at || (order.ledger_status && order.ledger_status !== "none")) {
    return "concluded";
  }
  if (order.clouds_sign_sent_at) return "sent";
  return "approved";
}

export function deriveLedgerStatus(order: {
  status: string;
  ledger_status?: string | null;
  concluded_at?: string | null;
  clouds_sign_sent_at?: string | null;
}): LedgerStatus {
  const raw = order.ledger_status;
  if (raw && raw !== "none" && (LEDGER_STATUSES as readonly string[]).includes(raw)) {
    return raw as LedgerStatus;
  }
  if (order.status === "approved" || order.concluded_at || order.clouds_sign_sent_at) {
    return "ordered";
  }
  return "none";
}

export type TransferSender = {
  bankCode: string;
  bankName: string;
  branchCode: string;
  branchName: string;
  accountType: string;
  accountNumber: string;
  senderCode: string;
  senderName: string;
};

export const EMPTY_TRANSFER_SENDER: TransferSender = {
  bankCode: "",
  bankName: "",
  branchCode: "",
  branchName: "",
  accountType: "普通",
  accountNumber: "",
  senderCode: "",
  senderName: "",
};

export function parseTransferSender(
  settings: Record<string, unknown> | null | undefined,
  _companyName = "",
): TransferSender {
  const transfer = (settings?.transfer ?? {}) as Record<string, unknown>;
  return {
    bankCode: String(transfer.bankCode ?? transfer.bank_code ?? ""),
    bankName: String(transfer.bankName ?? transfer.bank_name ?? ""),
    branchCode: String(transfer.branchCode ?? transfer.branch_code ?? ""),
    branchName: String(transfer.branchName ?? transfer.branch_name ?? transfer.bank_branch ?? ""),
    accountType: String(transfer.accountType ?? transfer.bank_account_type ?? "普通"),
    accountNumber: String(transfer.accountNumber ?? transfer.bank_account_number ?? ""),
    senderCode: String(transfer.senderCode ?? transfer.sender_code ?? ""),
    senderName: String(transfer.senderName ?? transfer.sender_name ?? ""),
  };
}

export function isZenginSenderReady(sender: TransferSender): boolean {
  return Boolean(
    digitField(sender.senderCode, 10)
    && toZenginKana(sender.senderName).trim()
    && digitField(sender.bankCode, 4)
    && toZenginKana(sender.bankName).trim()
    && digitField(sender.branchCode, 3)
    && toZenginKana(sender.branchName).trim()
    && digitField(sender.accountNumber, 7),
  );
}

export type ZenginAccountInput = {
  bank_code?: string | null;
  bank_name?: string | null;
  bank_name_kana?: string | null;
  bank_branch?: string | null;
  bank_branch_code?: string | null;
  bank_branch_kana?: string | null;
  bank_account_type?: string | null;
  bank_account_number?: string | null;
  bank_account_kana?: string | null;
};

export type ZenginAccount = {
  bankCode: string;
  bankNameKana: string;
  branchCode: string;
  branchNameKana: string;
  accountType: string;
  accountNumber: string;
  accountKana: string;
};

export function splitLeadingCode(raw: string | null | undefined, len: number): { code: string; rest: string } {
  const s = (raw ?? "").trim();
  const m = s.match(new RegExp(`^(\\d{${len}})(?:\\s+|$)(.*)$`));
  if (m) return { code: m[1], rest: m[2].trim() };
  return { code: "", rest: s };
}

export function resolveZenginAccount(input: ZenginAccountInput): ZenginAccount {
  const bank = splitLeadingCode(input.bank_name, 4);
  const branch = splitLeadingCode(input.bank_branch, 3);
  return {
    bankCode: digitField(input.bank_code, 4) ?? digitField(bank.code, 4) ?? "",
    bankNameKana: (input.bank_name_kana ?? "").trim() || bank.rest || (input.bank_name ?? "").trim(),
    branchCode: digitField(input.bank_branch_code, 3) ?? digitField(branch.code, 3) ?? "",
    branchNameKana: (input.bank_branch_kana ?? "").trim() || branch.rest || (input.bank_branch ?? "").trim(),
    accountType: input.bank_account_type || "普通",
    accountNumber: digitField(input.bank_account_number, 7) ?? "",
    accountKana: (input.bank_account_kana ?? "").trim(),
  };
}

export function isZenginAccountReady(account: ZenginAccount): boolean {
  return Boolean(
    account.bankCode
    && account.branchCode
    && account.accountNumber
    && toZenginKana(account.bankNameKana).trim()
    && toZenginKana(account.branchNameKana).trim(),
  );
}

export function bankLabel(input: ZenginAccountInput): string | null {
  if (!input.bank_name && !input.bank_code && !input.bank_account_number) return null;
  if (!input.bank_account_number) return null;
  const z = resolveZenginAccount(input);
  const type = z.accountType || "普通";
  const bank = [z.bankCode, z.bankNameKana || input.bank_name].filter(Boolean).join(" ");
  const branch = [z.branchCode, z.branchNameKana || input.bank_branch].filter(Boolean).join(" ");
  return `${bank} ${branch} ${type} ${input.bank_account_number}`.replace(/\s+/g, " ").trim();
}

export function defaultTransferFee(amountIncl: number): number {
  if (amountIncl <= 0) return 0;
  return amountIncl >= 30_000 ? 440 : 220;
}

function digitField(value: string | null | undefined, len: number): string | null {
  const d = String(value ?? "").replace(/\D/g, "");
  if (!d) return null;
  return d.slice(-len).padStart(len, "0");
}

function pad(s: string, len: number): string {
  const t = s.slice(0, len);
  return t + " ".repeat(Math.max(0, len - t.length));
}

const KANA_TO_HW: Record<string, string> = {
  あ: "ｱ", い: "ｲ", う: "ｳ", え: "ｴ", お: "ｵ",
  か: "ｶ", き: "ｷ", く: "ｸ", け: "ｹ", こ: "ｺ",
  さ: "ｻ", し: "ｼ", す: "ｽ", せ: "ｾ", そ: "ｿ",
  た: "ﾀ", ち: "ﾁ", つ: "ﾂ", て: "ﾃ", と: "ﾄ",
  な: "ﾅ", に: "ﾆ", ぬ: "ﾇ", ね: "ﾈ", の: "ﾉ",
  は: "ﾊ", ひ: "ﾋ", ふ: "ﾌ", へ: "ﾍ", ほ: "ﾎ",
  ま: "ﾏ", み: "ﾐ", む: "ﾑ", め: "ﾒ", も: "ﾓ",
  や: "ﾔ", ゆ: "ﾕ", よ: "ﾖ",
  ら: "ﾗ", り: "ﾘ", る: "ﾙ", れ: "ﾚ", ろ: "ﾛ",
  わ: "ﾜ", を: "ｦ", ん: "ﾝ",
  ぁ: "ｧ", ぃ: "ｨ", ぅ: "ｩ", ぇ: "ｪ", ぉ: "ｫ",
  ゃ: "ｬ", ゅ: "ｭ", ょ: "ｮ", っ: "ｯ", ゎ: "ﾜ",
  が: "ｶﾞ", ぎ: "ｷﾞ", ぐ: "ｸﾞ", げ: "ｹﾞ", ご: "ｺﾞ",
  ざ: "ｻﾞ", じ: "ｼﾞ", ず: "ｽﾞ", ぜ: "ｾﾞ", ぞ: "ｿﾞ",
  だ: "ﾀﾞ", ぢ: "ﾁﾞ", づ: "ﾂﾞ", で: "ﾃﾞ", ど: "ﾄﾞ",
  ば: "ﾊﾞ", び: "ﾋﾞ", ぶ: "ﾌﾞ", べ: "ﾍﾞ", ぼ: "ﾎﾞ",
  ぱ: "ﾊﾟ", ぴ: "ﾋﾟ", ぷ: "ﾌﾟ", ぺ: "ﾍﾟ", ぽ: "ﾎﾟ",
  ゔ: "ｳﾞ",
  ア: "ｱ", イ: "ｲ", ウ: "ｳ", エ: "ｴ", オ: "ｵ",
  カ: "ｶ", キ: "ｷ", ク: "ｸ", ケ: "ｹ", コ: "ｺ",
  サ: "ｻ", シ: "ｼ", ス: "ｽ", セ: "ｾ", ソ: "ｿ",
  タ: "ﾀ", チ: "ﾁ", ツ: "ﾂ", テ: "ﾃ", ト: "ﾄ",
  ナ: "ﾅ", ニ: "ﾆ", ヌ: "ﾇ", ネ: "ﾈ", ノ: "ﾉ",
  ハ: "ﾊ", ヒ: "ﾋ", フ: "ﾌ", ヘ: "ﾍ", ホ: "ﾎ",
  マ: "ﾏ", ミ: "ﾐ", ム: "ﾑ", メ: "ﾒ", モ: "ﾓ",
  ヤ: "ﾔ", ユ: "ﾕ", ヨ: "ﾖ",
  ラ: "ﾗ", リ: "ﾘ", ル: "ﾙ", レ: "ﾚ", ロ: "ﾛ",
  ワ: "ﾜ", ヲ: "ｦ", ン: "ﾝ",
  ァ: "ｧ", ィ: "ｨ", ゥ: "ｩ", ェ: "ｪ", ォ: "ｫ",
  ャ: "ｬ", ュ: "ｭ", ョ: "ｮ", ッ: "ｯ", ヮ: "ﾜ", ヵ: "ｶ", ヶ: "ｹ",
  ガ: "ｶﾞ", ギ: "ｷﾞ", グ: "ｸﾞ", ゲ: "ｹﾞ", ゴ: "ｺﾞ",
  ザ: "ｻﾞ", ジ: "ｼﾞ", ズ: "ｽﾞ", ゼ: "ｾﾞ", ゾ: "ｿﾞ",
  ダ: "ﾀﾞ", ヂ: "ﾁﾞ", ヅ: "ﾂﾞ", デ: "ﾃﾞ", ド: "ﾄﾞ",
  バ: "ﾊﾞ", ビ: "ﾋﾞ", ブ: "ﾌﾞ", ベ: "ﾍﾞ", ボ: "ﾎﾞ",
  パ: "ﾊﾟ", ピ: "ﾋﾟ", プ: "ﾌﾟ", ペ: "ﾍﾟ", ポ: "ﾎﾟ",
  ヴ: "ｳﾞ",
  ー: "ｰ", "―": "ｰ", "‐": "-", "−": "-",
  "・": "･", "「": "｢", "」": "｣",
  "（": "(", "）": ")",
};

export function toZenginKana(input: string): string {
  let out = "";
  for (const ch of input) {
    const mapped = KANA_TO_HW[ch];
    if (mapped) {
      out += mapped;
      continue;
    }
    const code = ch.charCodeAt(0);
    if (code === 0x3000) {
      out += " ";
      continue;
    }
    if (code >= 0xff01 && code <= 0xff5e) {
      out += String.fromCharCode(code - 0xfee0);
      continue;
    }
    if (code < 0x80 || (code >= 0xff61 && code <= 0xff9f)) {
      out += ch;
    }
  }
  return out;
}

function padKana(input: string, len: number): string {
  return pad(toZenginKana(input), len);
}

function zenginAccountTypeCode(type: string | undefined): "1" | "2" {
  const t = (type ?? "").trim();
  if (t === "2" || t.includes("当座")) return "2";
  return "1";
}

function mmdd(isoDate: string): string {
  const compact = isoDate.replaceAll("-", "");
  if (compact.length >= 8) return compact.slice(4, 8);
  if (compact.length === 4) return compact;
  return pad(compact, 4);
}

export type ZenginSender = TransferSender & {
  transferDate: string;
};

export type ZenginRow = {
  vendorName: string;
  accountKana: string;
  amount: number;
  bankCode?: string;
  bankName?: string;
  branchCode?: string;
  branchName?: string;
  accountType?: string;
  accountNumber?: string;
};

/** 全銀協 総合振込（1行120バイト・SJIS・LF）。先方サンプルと同じ桁。 */
export function buildZenginText(sender: ZenginSender, rows: ZenginRow[]): string {
  const header = pad([
    "1",
    "21",
    "0",
    digitField(sender.senderCode, 10) ?? "0000000000",
    padKana(sender.senderName, 40),
    mmdd(sender.transferDate),
    digitField(sender.bankCode, 4) ?? "0000",
    padKana(sender.bankName, 15),
    digitField(sender.branchCode, 3) ?? "000",
    padKana(sender.branchName, 15),
    zenginAccountTypeCode(sender.accountType),
    digitField(sender.accountNumber, 7) ?? "0000000",
    pad("", 17),
  ].join(""), 120);

  const data = rows.map((row) => {
    const amt = String(Math.max(0, Math.round(row.amount))).padStart(10, "0").slice(-10);
    return pad([
      "2",
      digitField(row.bankCode, 4) ?? "0000",
      padKana(row.bankName ?? "", 15),
      digitField(row.branchCode, 3) ?? "000",
      padKana(row.branchName ?? "", 15),
      pad("", 4),
      zenginAccountTypeCode(row.accountType),
      digitField(row.accountNumber, 7) ?? "0000000",
      padKana(row.accountKana || row.vendorName, 30),
      amt,
      pad("", 30),
    ].join(""), 120);
  });

  const total = rows.reduce((s, r) => s + Math.max(0, Math.round(r.amount)), 0);
  const trailer = pad([
    "8",
    String(rows.length).padStart(6, "0"),
    String(total).padStart(12, "0"),
    pad("", 101),
  ].join(""), 120);
  const end = pad("9", 120);
  return [header, ...data, trailer, end].join("\n");
}

export function encodeZenginSjis(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 0x0a || c < 0x80) bytes[i] = c;
    else if (c >= 0xff61 && c <= 0xff9f) bytes[i] = c - 0xff61 + 0xa1;
    else bytes[i] = 0x20;
  }
  return bytes;
}

export function downloadZenginFile(filename: string, text: string): void {
  const bytes = encodeZenginSjis(text);
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  const blob = new Blob([copy], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadTextFile(filename: string, content: string, mime = "text/plain;charset=utf-8"): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function toCsv(headers: string[], rows: string[][]): string {
  const esc = (v: string) => {
    if (/[",\n]/.test(v)) return `"${v.replaceAll('"', '""')}"`;
    return v;
  };
  return [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
}

export function printHtml(title: string, body: string): void {
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>
      body { font-family: sans-serif; padding: 24px; color: #111; }
      table { border-collapse: collapse; width: 100%; font-size: 12px; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
      th { background: #f4f4f4; }
      .right { text-align: right; }
    </style></head><body>${body}</body></html>`);
  w.document.close();
  w.focus();
  w.print();
}
