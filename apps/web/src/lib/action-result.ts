/**
 * Server Action の結果型。
 *
 * 本番の Next.js は Server Action 内の throw をすべて
 * 「An error occurred in the Server Components render」に伏せるため、
 * ユーザー向けエラーは throw せずこの形で返す。
 */
export type ActionOk<T> = { ok: true } & T;
export type ActionFail = { ok: false; error: string };
export type ActionResult<T extends Record<string, unknown> = Record<string, never>> =
  | ActionOk<T>
  | ActionFail;

export function actionOk<T extends Record<string, unknown>>(data: T): ActionOk<T> {
  return { ok: true, ...data };
}

export function actionFail(error: unknown, fallback: string): ActionFail {
  if (typeof error === "string" && error.trim()) {
    return { ok: false, error: error.trim() };
  }
  if (error instanceof Error && error.message.trim()) {
    // 本番で既に伏せられたメッセージはそのまま出さず、フォールバックへ
    if (error.message.includes("Server Components render")) {
      return { ok: false, error: fallback };
    }
    return { ok: false, error: error.message.trim() };
  }
  const msg = (error as { message?: string } | null)?.message?.trim();
  if (msg && !msg.includes("Server Components render")) {
    return { ok: false, error: msg };
  }
  return { ok: false, error: fallback };
}
