/**
 * サーバー（Server Actions / Route Handlers）向けストレージ操作
 *
 * 将来別サービス（Cloudflare R2 等）へ移行する場合、
 * このファイルの実装だけ差し替えれば全サーバー処理に反映される。
 */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type StorageBucket = "documents" | "voice-recordings";

/**
 * ファイルをアップロードする（ログイン済みユーザー権限）
 */
export async function uploadToStorage(
  bucket: StorageBucket,
  path: string,
  file: Blob | Buffer,
  options?: { contentType?: string; upsert?: boolean },
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.storage.from(bucket).upload(path, file, options);
  if (error) throw error;
}

/**
 * ファイルをアップロードする（サービスロール権限 / RLS バイパス）
 * 音声録音など、RLS を超えて保存が必要な場合に使う
 */
export async function uploadToStorageAsAdmin(
  bucket: StorageBucket,
  path: string,
  file: Blob | Buffer,
  options?: { contentType?: string; upsert?: boolean },
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.storage.from(bucket).upload(path, file, options);
  if (error) throw error;
}

/**
 * 署名付きダウンロードURLを取得する（デフォルト1時間有効）
 */
export async function getSignedStorageUrl(
  bucket: StorageBucket,
  path: string,
  expiresIn = 3600,
): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data) throw error ?? new Error("署名付きURL取得失敗");
  return data.signedUrl;
}
