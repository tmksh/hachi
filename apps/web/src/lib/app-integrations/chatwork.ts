import type { ChatworkRoom } from "./types";

const CHATWORK_API = "https://api.chatwork.com/v2";

export async function fetchChatworkRooms(apiToken: string): Promise<ChatworkRoom[]> {
  const res = await fetch(`${CHATWORK_API}/rooms`, {
    headers: { "X-ChatWorkToken": apiToken.trim() },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Chatwork API エラー (${res.status}): ${body.slice(0, 200)}`);
  }

  const rooms = (await res.json()) as Array<{ room_id: number; name: string; type: string }>;
  return rooms.map((room) => ({
    room_id: room.room_id,
    name: room.name,
    type: room.type,
  }));
}

export async function postChatworkMessage(
  apiToken: string,
  roomId: string,
  message: string
): Promise<void> {
  const res = await fetch(`${CHATWORK_API}/rooms/${roomId}/messages`, {
    method: "POST",
    headers: {
      "X-ChatWorkToken": apiToken.trim(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ body: message }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Chatwork 送信失敗 (${res.status}): ${body.slice(0, 200)}`);
  }
}

export function formatChatworkMessage(title: string, body: string): string {
  return `[info][title]${title}[/title]${body}[/info]`;
}
