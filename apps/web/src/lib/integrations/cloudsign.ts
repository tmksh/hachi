import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * クラウドサイン API 連携（B案: 顧客が別途契約）
 * 議事録 2026/04/16: 原則クラウドサインAPI連携。未契約顧客はPDFダウンロード代替。
 */

export type CloudSignConfig = {
  enabled: boolean;
  api_key?: string;
  client_id?: string;
};

export type CloudSignSendRequest = {
  title: string;
  pdf_base64?: string;
  pdf_url?: string;
  html?: string;
  signers: Array<{ name: string; email: string; order: number }>;
  metadata?: Record<string, string>;
};

export type CloudSignSendResult = {
  document_id: string;
  status: "sent" | "draft";
  message: string;
};

export function getCloudSignConfig(settings: Record<string, unknown> | null | undefined): CloudSignConfig {
  const cs = (settings?.cloudsign ?? {}) as Partial<CloudSignConfig>;
  return {
    enabled: Boolean(cs.enabled),
    api_key: cs.api_key,
    client_id: cs.client_id,
  };
}

/** クラウドサイン Webhook 署名検証（HMAC-SHA256） */
export function verifyCloudSignWebhook(
  payload: string,
  signature: string | null,
  config: CloudSignConfig,
): boolean {
  // CloudSign未連携（enabled=false）の場合は全リクエストを拒否
  if (!config.enabled) return false;

  // APIキー未設定の場合も拒否
  if (!config.api_key) return false;

  // 署名ヘッダーがない場合は拒否
  if (!signature) return false;

  try {
    const expected = createHmac("sha256", config.api_key)
      .update(payload)
      .digest("hex");

    const sigBuf = Buffer.from(signature, "hex");
    const expBuf = Buffer.from(expected, "hex");

    if (sigBuf.length !== expBuf.length) return false;
    return timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

export type CloudSignWebhookEvent = {
  document_id: string;
  status: "signed" | "rejected" | "cancelled" | "sent";
  signed_at?: string;
  metadata?: Record<string, string>;
};
export async function sendToCloudSign(
  config: CloudSignConfig,
  request: CloudSignSendRequest,
): Promise<CloudSignSendResult> {
  if (!config.enabled || !config.client_id?.trim()) {
    throw new Error("クラウドサインが未設定です。会社のクライアントIDを確認してください。未送信のため送信済みには変更していません。");
  }
  // CloudSign accepts a PDF attachment, not HTML or a remote URL. Validate before
  // creating any external draft. Callers without a generated PDF must fail closed.
  const pdf = Buffer.from(request.pdf_base64 ?? "", "base64");
  if (pdf.subarray(0, 5).toString() !== "%PDF-" || !pdf.subarray(-1024).includes(Buffer.from("%%EOF"))) {
    throw new Error("送信するPDFが生成されていません。PDFを確認してから電子契約を送信してください。未送信です。");
  }
  if (pdf.length > 49 * 1024 * 1024) throw new Error("電子契約のPDFは49MB以下にしてください。");
  const signers = [...request.signers].sort((a, b) => a.order - b.order);
  if (!request.title.trim() || !signers.length || signers.some(s => !s.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email) || !Number.isInteger(s.order))) {
    throw new Error("電子契約のタイトル・宛先・送信順を確認してください。未送信です。");
  }
  if (new Set(signers.map(s => s.email.trim().toLowerCase())).size !== signers.length) {
    throw new Error("電子契約の宛先が重複しています。未送信です。");
  }

  // Official API: token → draft → PDF → participants (in order) → send.
  // Never retry a POST automatically: a timeout may have happened after acceptance.
  const base = "https://api.cloudsign.jp";
  let documentId: string | undefined;
  let sending = false;
  const post = async (path: string, body?: URLSearchParams | FormData, token?: string) => {
    const response = await fetch(`${base}${path}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`APIエラー (${response.status})`);
    return await response.json() as Record<string, unknown>;
  };
  try {
    const auth = await post("/token", new URLSearchParams({ client_id: config.client_id.trim() }));
    if (typeof auth.access_token !== "string" || !auth.access_token) throw new Error("認証結果が不正です");
    const token = auth.access_token;
    const draft = await post("/documents", new URLSearchParams({
      title: request.title,
      message: request.metadata?.message ?? "",
    }), token);
    if (typeof draft.id !== "string" || !draft.id) throw new Error("書類IDを取得できませんでした");
    documentId = draft.id;
    const path = `/documents/${encodeURIComponent(documentId)}`;
    const file = new FormData();
    file.set("name", "contract.pdf");
    file.set("uploadfile", new Blob([new Uint8Array(pdf)], { type: "application/pdf" }), "contract.pdf");
    await post(`${path}/files`, file, token);
    for (const signer of signers) {
      await post(`${path}/participants`, new URLSearchParams({ name: signer.name.trim(), email: signer.email.trim() }), token);
    }
    sending = true;
    const sent = await post(path, undefined, token);
    if (sent.id !== documentId || sent.status !== 1) throw new Error("送信完了を確認できませんでした");
    return { document_id: documentId, status: "sent", message: "クラウドサインへ送信しました" };
  } catch (error) {
    // Do not echo upstream bodies/tokens. Retain the draft ID for manual recovery
    // so a user can check an uncertain send instead of creating a duplicate.
    const detail = error instanceof Error && /^APIエラー/.test(error.message) ? error.message : "連携処理を完了できませんでした";
    const recovery = documentId
      ? ` 書類ID: ${documentId}。${sending ? "送信結果が不明です。再送せずクラウドサイン側の状態を確認してください。" : "下書きが残っています。クラウドサイン側で確認してください。"}`
      : " 送信済みには変更していません。";
    throw new Error(`クラウドサイン: ${detail}。${recovery}`);
  }
}
