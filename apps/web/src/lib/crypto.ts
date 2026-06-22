/**
 * AES-256-GCM による対称暗号化ユーティリティ
 *
 * 環境変数 ENCRYPTION_KEY (32バイト hex, 64文字) が設定されている場合に有効。
 * 未設定の場合は平文のまま返す（開発環境後方互換）。
 *
 * 使用例:
 *   const encrypted = await encrypt(plaintext);   // 保存時
 *   const plain = await decrypt(encrypted);        // 読み出し時
 */

const ALG = "AES-GCM";
const IV_BYTES = 12; // 96-bit IV (GCM推奨)
const PREFIX = "enc:v1:"; // 暗号化済みであることを示すプレフィックス

function getKey(): string | null {
  return process.env.ENCRYPTION_KEY ?? null;
}

async function importKey(hexKey: string): Promise<CryptoKey> {
  const raw = Buffer.from(hexKey, "hex");
  return crypto.subtle.importKey("raw", raw, { name: ALG }, false, ["encrypt", "decrypt"]);
}

/**
 * 平文を AES-256-GCM で暗号化し `enc:v1:<base64>` 形式の文字列を返す。
 * ENCRYPTION_KEY 未設定時はそのまま返す。
 */
export async function encrypt(plaintext: string): Promise<string> {
  const hexKey = getKey();
  if (!hexKey) return plaintext; // 未設定時はフォールバック

  const key = await importKey(hexKey);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const encoded = new TextEncoder().encode(plaintext);

  const cipherBuf = await crypto.subtle.encrypt({ name: ALG, iv }, key, encoded);

  const combined = new Uint8Array(IV_BYTES + cipherBuf.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuf), IV_BYTES);

  return PREFIX + Buffer.from(combined).toString("base64");
}

/**
 * `enc:v1:<base64>` 形式の文字列を復号して平文を返す。
 * プレフィックスがない場合（旧平文データ）はそのまま返す。
 */
export async function decrypt(ciphertext: string): Promise<string> {
  if (!ciphertext.startsWith(PREFIX)) return ciphertext; // 平文データの後方互換

  const hexKey = getKey();
  if (!hexKey) return ciphertext.slice(PREFIX.length); // キー未設定: base64のまま

  const combined = Buffer.from(ciphertext.slice(PREFIX.length), "base64");
  const iv = combined.subarray(0, IV_BYTES);
  const cipherBuf = combined.subarray(IV_BYTES);

  const key = await importKey(hexKey);
  const plainBuf = await crypto.subtle.decrypt({ name: ALG, iv }, key, cipherBuf);
  return new TextDecoder().decode(plainBuf);
}
