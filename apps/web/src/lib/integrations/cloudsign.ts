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
    const { createHmac, timingSafeEqual } = require("crypto") as typeof import("crypto");
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
  if (!config.enabled || !config.api_key) {
    return {
      document_id: `stub-${Date.now()}`,
      status: "sent",
      message: "クラウドサインAPI未設定のためスタブ送信しました（設定 > 連携からAPIキーを登録すると本番送信されます）",
    };
  }

  // TODO: クラウドサイン REST API 実装（/documents エンドポイント）
  const res = await fetch("https://api.cloudsign.jp/documents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.api_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: request.title,
      signers: request.signers,
    }),
  });

  if (!res.ok) {
    throw new Error(`クラウドサイン送信失敗: ${res.status}`);
  }

  const data = (await res.json()) as { id: string };
  return {
    document_id: data.id,
    status: "sent",
    message: "クラウドサインへ送信しました",
  };
}
