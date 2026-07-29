export type GoogleCalendarEvent = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end:   { dateTime?: string; date?: string; timeZone?: string };
  colorId?: string;
  htmlLink?: string;
};

/** Google Calendar API からイベントを取得する（クライアントサイド用） */
export async function fetchGoogleCalendarEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string,
): Promise<GoogleCalendarEvent[]> {
  try {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!res.ok) return [];
    const data = await res.json();
    return (data.items ?? []) as GoogleCalendarEvent[];
  } catch {
    return [];
  }
}

/** Google Calendar にイベントを作成する */
export async function createGoogleCalendarEvent(
  accessToken: string,
  event: {
    title: string;
    description?: string | null;
    location?: string | null;
    start_at: string;
    end_at: string;
    all_day?: boolean;
  },
): Promise<string | null> {
  const result = await createGoogleCalendarEventDetailed(accessToken, event);
  return "id" in result ? result.id : null;
}

/** サーバー側向け：失敗理由付き */
export async function createGoogleCalendarEventDetailed(
  accessToken: string,
  event: {
    title: string;
    description?: string | null;
    location?: string | null;
    start_at: string;
    end_at: string;
    all_day?: boolean;
  },
): Promise<{ id: string } | { error: string }> {
  try {
    const timeZone = "Asia/Tokyo";
    const body: Record<string, unknown> = {
      summary: event.title,
      description: event.description ?? undefined,
      location: event.location ?? undefined,
    };

    if (event.all_day) {
      body.start = { date: event.start_at.substring(0, 10) };
      body.end = { date: event.end_at.substring(0, 10) };
    } else {
      body.start = { dateTime: event.start_at, timeZone };
      body.end = { dateTime: event.end_at, timeZone };
    }

    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      if (res.status === 403) {
        return {
          error:
            "Googleカレンダーへの書き込み権限がありません。カレンダー画面から「再連携」し、カレンダーへのアクセスを許可してください",
        };
      }
      return {
        error: `Google Calendar API (${res.status}): ${errText.slice(0, 180) || "unknown error"}`,
      };
    }
    const data = (await res.json()) as { id?: string };
    if (!data.id) return { error: "Google Calendar API: イベントIDが返されませんでした" };
    return { id: data.id };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Google Calendar API 呼び出しに失敗しました",
    };
  }
}

/** Google Calendar のイベントを更新する */
export async function updateGoogleCalendarEvent(
  accessToken: string,
  googleEventId: string,
  event: {
    title?: string;
    description?: string | null;
    location?: string | null;
    start_at?: string;
    end_at?: string;
    all_day?: boolean;
  },
): Promise<boolean> {
  try {
    const timeZone = "Asia/Tokyo";
    const body: Record<string, unknown> = {};
    if (event.title !== undefined) body.summary = event.title;
    if (event.description !== undefined) body.description = event.description ?? undefined;
    if (event.location !== undefined) body.location = event.location ?? undefined;
    if (event.start_at !== undefined) {
      body.start = event.all_day
        ? { date: event.start_at.substring(0, 10) }
        : { dateTime: event.start_at, timeZone };
    }
    if (event.end_at !== undefined) {
      body.end = event.all_day
        ? { date: event.end_at.substring(0, 10) }
        : { dateTime: event.end_at, timeZone };
    }

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

/** Google Calendar のイベントを削除する */
export async function deleteGoogleCalendarEvent(
  accessToken: string,
  googleEventId: string,
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

/** Google Calendar イベントを表示用の共通型に変換 */
export function mapGoogleEvent(gEv: GoogleCalendarEvent) {
  const allDay = !gEv.start.dateTime;
  return {
    id: `gcal_${gEv.id}`,
    title: gEv.summary ?? "(タイトルなし)",
    description: gEv.description ?? null,
    location: gEv.location ?? null,
    start_at: gEv.start.dateTime ?? `${gEv.start.date}T00:00:00`,
    end_at:   gEv.end.dateTime   ?? (gEv.end.date ? `${gEv.end.date}T00:00:00` : null),
    all_day: allDay,
    category: null,
    color: null,
    company_id: "",
    created_by: "",
    created_at: "",
    updated_at: "",
    customer_id: null,
    assigned_to: null,
    customer: null,
    _isGoogle: true as const,
    _htmlLink: gEv.htmlLink,
    _googleId: gEv.id,
  };
}

export type MappedGoogleEvent = ReturnType<typeof mapGoogleEvent>;

