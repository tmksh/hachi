type KintoneCredentials = {
  subdomain: string;
  api_token: string;
  app_id: string;
};

type KintoneSettings = {
  title_field?: string;
  body_field?: string;
  event_field?: string;
};

export function validateKintoneCredentials(credentials: Record<string, string>): KintoneCredentials {
  const subdomain = credentials.subdomain?.trim() ?? "";
  const api_token = credentials.api_token?.trim() ?? "";
  const app_id = credentials.app_id?.trim() ?? "";
  if (!subdomain || !api_token || !app_id) {
    throw new Error("kintone のサブドメイン・API トークン・アプリ ID を入力してください");
  }
  if (!/^\d+$/.test(app_id)) throw new Error("kintone アプリ ID は数字で入力してください");
  return { subdomain, api_token, app_id };
}

export function resolveKintoneSettings(settings: Record<string, string>): Required<KintoneSettings> {
  return {
    title_field: settings.title_field?.trim() || "タイトル",
    body_field: settings.body_field?.trim() || "本文",
    event_field: settings.event_field?.trim() || "イベント",
  };
}

export async function postKintoneRecord(
  credentials: KintoneCredentials,
  settings: Record<string, string>,
  input: { title: string; body: string; event: string }
): Promise<void> {
  const fields = resolveKintoneSettings(settings);
  const url = `https://${credentials.subdomain}.cybozu.com/k/v1/record.json`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-Cybozu-API-Token": credentials.api_token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      app: Number(credentials.app_id),
      record: {
        [fields.title_field]: { value: input.title },
        [fields.body_field]: { value: input.body },
        [fields.event_field]: { value: input.event },
      },
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`kintone 登録失敗 (${res.status}): ${body.slice(0, 300)}`);
  }
}
