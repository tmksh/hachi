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
    nextActor: "業者へURL送信済み",
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

export function bankLabel(input: {
  bank_name?: string | null;
  bank_branch?: string | null;
  bank_account_type?: string | null;
  bank_account_number?: string | null;
}): string | null {
  if (!input.bank_name || !input.bank_account_number) return null;
  const type = input.bank_account_type || "普通";
  return `${input.bank_name} ${input.bank_branch ?? ""} ${type} ${input.bank_account_number}`.replace(/\s+/g, " ").trim();
}

export function defaultTransferFee(amountIncl: number): number {
  if (amountIncl <= 0) return 0;
  return amountIncl >= 30_000 ? 440 : 220;
}

function pad(s: string, len: number): string {
  const t = s.slice(0, len);
  return t + " ".repeat(Math.max(0, len - t.length));
}

function toHalfWidthKana(input: string): string {
  return input
    .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/　/g, " ")
    .replace(/[ぁ-ん]/g, (ch) => {
      const map: Record<string, string> = {
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
      };
      return map[ch] ?? ch;
    });
}

export type ZenginSender = {
  bankName: string;
  branchName: string;
  accountType: string;
  accountNumber: string;
  senderCode: string;
  senderName: string;
  transferDate: string;
};

export type ZenginRow = {
  vendorName: string;
  accountKana: string;
  amount: number;
  bankName?: string;
  branchName?: string;
  accountType?: string;
  accountNumber?: string;
};

/** 全銀協フォーマットに近い固定長テキスト（UTF-8。銀行取込前にSJIS変換が必要な場合あり） */
export function buildZenginText(sender: ZenginSender, rows: ZenginRow[]): string {
  const date = sender.transferDate.replaceAll("-", "").slice(2, 8);
  const type = sender.accountType.includes("当座") ? "2" : "1";
  const header = [
    "1",
    "21",
    "0",
    pad(sender.senderCode.replace(/\D/g, "").padStart(10, "0"), 10),
    pad(toHalfWidthKana(sender.senderName || "BRIDGE"), 40),
    pad(date, 4),
    pad("", 40),
  ].join("");

  const data = rows.map((row) => {
    const amt = String(Math.max(0, Math.round(row.amount))).padStart(10, "0");
    return [
      "2",
      pad((row.bankName ?? "").replace(/\D/g, "").padStart(4, "0"), 4),
      pad((row.branchName ?? "").replace(/\D/g, "").padStart(3, "0"), 3),
      pad("", 4),
      type,
      pad((row.accountNumber ?? "").replace(/\D/g, ""), 7),
      pad(toHalfWidthKana(row.accountKana || row.vendorName), 30),
      amt,
      "1",
      pad("", 20),
    ].join("");
  });

  const total = rows.reduce((s, r) => s + Math.max(0, Math.round(r.amount)), 0);
  const trailer = [
    "8",
    String(rows.length).padStart(6, "0"),
    String(total).padStart(12, "0"),
    pad("", 101),
  ].join("");
  const end = `9${" ".repeat(119)}`;
  return [header, ...data, trailer, end].join("\r\n");
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
