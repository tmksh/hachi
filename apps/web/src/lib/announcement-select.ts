/**
 * announcements の通知用 select。
 * リモート DB にマイグレーション未適用のカラムがあると PostgREST が 400 を返すため、
 * 段階的にフォールバックする。
 */

export type AnnouncementNotifRow = {
  id: string;
  title: string;
  body: string | null;
  is_urgent: boolean | null;
  published_at: string;
  target_type: string | null;
  author_id?: string | null;
  target_roles?: string[] | null;
  target_user_ids?: string[] | null;
};

type QueryBuilder = {
  select: (cols: string) => {
    order: (
      col: string,
      opts: { ascending: boolean },
    ) => {
      limit: (n: number) => PromiseLike<{
        data: AnnouncementNotifRow[] | null;
        error: { message?: string } | null;
      }>;
    };
  };
};

type MinimalSupabase = {
  from: (table: string) => QueryBuilder;
};

const SELECT_FULL =
  "id, title, body, is_urgent, published_at, target_type, author_id, target_roles, target_user_ids";
const SELECT_ROLES =
  "id, title, body, is_urgent, published_at, target_type, author_id, target_roles";
const SELECT_BASIC =
  "id, title, body, is_urgent, published_at, target_type, author_id";

export async function selectAnnouncementsForNotifications(
  supabase: MinimalSupabase,
  limit = 30,
): Promise<AnnouncementNotifRow[]> {
  const trySelect = async (cols: string) => {
    const { data, error } = await supabase
      .from("announcements")
      .select(cols)
      .order("published_at", { ascending: false })
      .limit(limit);
    if (error) return null;
    return data ?? [];
  };

  return (
    (await trySelect(SELECT_FULL))
    ?? (await trySelect(SELECT_ROLES))
    ?? (await trySelect(SELECT_BASIC))
    ?? []
  );
}
