/**
 * ブラウザ（クライアントコンポーネント）向けストレージ操作
 *
 * 将来別サービス（Cloudflare R2 等）へ移行する場合、
 * このファイルの実装だけ差し替えれば全画面に反映される。
 */
import { createClient } from "@/lib/supabase/client";

export type StorageBucket = "documents" | "voice-recordings";

/**
 * ファイルをアップロードする
 * @param bucket 保存先バケット
 * @param path   バケット内のパス（例: "customers/xxx/photo.jpg"）
 * @param file   アップロードするファイル
 * @param options contentType / upsert など
 */
export async function uploadToStorage(
  bucket: StorageBucket,
  path: string,
  file: File | Blob,
  options?: { contentType?: string; upsert?: boolean },
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.storage.from(bucket).upload(path, file, options);
  if (error) throw error;
}

/**
 * 署名付きダウンロードURLを取得する（デフォルト1時間有効）
 * @param bucket    バケット名
 * @param path      バケット内のパス
 * @param expiresIn 有効秒数（デフォルト 3600）
 */
export async function getSignedStorageUrl(
  bucket: StorageBucket,
  path: string,
  expiresIn = 3600,
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data) throw error ?? new Error("署名付きURL取得失敗");
  return data.signedUrl;
}
