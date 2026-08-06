/**
 * 発注業者名の表記ゆれ吸収（No.71）
 * - 「㈱」「（株）」⇔「株式会社」などの法人格表記
 * - 全角/半角（英数・カナ）
 * - カタカナ/ひらがな
 * を正規化して候補マッチングに使う。表示名は変更しない。
 */

const CORPORATE_ALIASES: Array<[RegExp, string]> = [
  [/㈱/g, "株式会社"],
  [/㈲/g, "有限会社"],
  [/㈾/g, "合資会社"],
  [/㈴/g, "合名会社"],
  [/[（(]株[）)]/g, "株式会社"],
  [/[（(]有[）)]/g, "有限会社"],
  [/[（(]合[）)]/g, "合同会社"],
];

/** カタカナ→ひらがな（Unicode差分 0x60） */
function katakanaToHiragana(text: string): string {
  return text.replace(/[\u30a1-\u30f6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60),
  );
}

/** 業者名をマッチング用に正規化する */
export function normalizeVendorName(raw: string): string {
  let text = raw.normalize("NFKC"); // 全角英数→半角、半角カナ→全角カナ 等
  for (const [pattern, replacement] of CORPORATE_ALIASES) {
    text = text.replace(pattern, replacement);
  }
  text = katakanaToHiragana(text);
  return text.toLowerCase().replace(/[\s\u3000・.、,，]/g, "");
}

/** 正規化後の部分一致（インクリメンタルサーチ用） */
export function vendorNameMatches(candidate: string, query: string): boolean {
  const q = normalizeVendorName(query);
  if (!q) return true;
  return normalizeVendorName(candidate).includes(q);
}
