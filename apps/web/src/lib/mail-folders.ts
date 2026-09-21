export type FolderThread = {
  is_spam?: boolean | null;
  is_starred?: boolean | null;
  is_flagged?: boolean | null;
  folder_id?: string | null;
};

/** 迷惑メールは通常フォルダ・スター・フラグの一覧から分離する。 */
export function threadMatchesFolder(thread: FolderThread, folder: string): boolean {
  if (folder === "spam") return Boolean(thread.is_spam);
  if (thread.is_spam) return false;
  if (folder === "inbox") return !thread.folder_id;
  if (folder === "starred") return Boolean(thread.is_starred);
  if (folder === "flagged") return Boolean(thread.is_flagged);
  return thread.folder_id === folder;
}
