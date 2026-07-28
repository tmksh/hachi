/** 本番で Next.js が伏せた Server Action エラーをユーザー向け文言に変換 */
export function humanizeClientError(error: unknown, fallback: string): string {
  const msg =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : (error as { message?: string } | null)?.message ?? "";
  const trimmed = msg.trim();
  if (
    !trimmed
    || /Server Components render/i.test(trimmed)
    || /omitted in production/i.test(trimmed)
    || /digest property/i.test(trimmed)
    || /was not found on the server/i.test(trimmed)
    || /failed-to-find-server-action/i.test(trimmed)
  ) {
    return fallback;
  }
  return trimmed;
}
