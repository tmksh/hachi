export async function postLineNotify(accessToken: string, message: string): Promise<void> {
  const token = accessToken.trim();
  if (!token) throw new Error("LINE Notify トークンを入力してください");

  const res = await fetch("https://notify-api.line.me/api/notify", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ message }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LINE Notify 送信失敗 (${res.status}): ${body.slice(0, 200)}`);
  }
}

export function formatLineNotifyMessage(title: string, body: string): string {
  return `${title}\n${body}`;
}
