/** 回覧・お知らせの閲覧可否（投稿者は常に自分の投稿を閲覧可能） */
export function canUserViewAnnouncement(
  announcement: {
    author_id?: string | null;
    target_type?: string | null;
    target_roles?: string[] | null;
    target_user_ids?: string[] | null;
  },
  userId: string,
  role: string | null,
): boolean {
  if (announcement.author_id === userId) return true;

  if (announcement.target_type === "individuals") {
    const targets: string[] = (announcement.target_user_ids as string[] | null) ?? [];
    return targets.length === 0 || targets.includes(userId);
  }

  if (announcement.target_type !== "roles") return true;

  if (!role) return false;
  const targets: string[] = (announcement.target_roles as string[] | null) ?? [];
  if (targets.length === 0) return true;
  return targets.includes(role);
}
