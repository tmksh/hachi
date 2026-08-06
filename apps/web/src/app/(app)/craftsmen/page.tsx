import { ensureSystemCraftsmen, getCraftsmen } from "@/lib/actions/craftsmen";
import { CraftsmenClient } from "./craftsmen-client";

export default async function CraftsmenPage() {
  // システム予約（未登録業者・予備費）をテナントごとに自動作成（No.66）
  await ensureSystemCraftsmen().catch(() => {});
  const initialRows = await getCraftsmen().catch(() => []);

  return <CraftsmenClient initialRows={initialRows} />;
}
