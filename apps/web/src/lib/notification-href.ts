/** notifySalesFlowUser が本文末尾に付ける遷移先（例: `詳細: /constructions/uuid?tab=change`） */
const DETAIL_HREF_RE = /詳細\s*[:：]\s*(\/[^\s\u3000<]+)/;

/**
 * お知らせ・ToDo本文からアプリ内パスを取り出す。
 * クエリ（?tab= / &changeOrderId=）を含めて返す。
 */
export function extractDetailHref(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(DETAIL_HREF_RE);
  if (!match?.[1]) return null;
  let href = match[1].replace(/[)\]}.,，。、；;」』】>]+$/u, "");
  try {
    href = decodeURI(href);
  } catch {
    /* keep raw */
  }
  if (!href.startsWith("/") || href.startsWith("//")) return null;
  const path = href.split("?")[0];
  if (!/^\/[a-zA-Z0-9/_-]+$/.test(path)) return null;
  return href;
}

/** お知らせクリック先。承認依頼などは対象画面、それ以外は回覧詳細 */
export function announcementActionHref(announcement: {
  id: string;
  body?: string | null;
}): string {
  return extractDetailHref(announcement.body) ?? `/circulation/${announcement.id}`;
}
