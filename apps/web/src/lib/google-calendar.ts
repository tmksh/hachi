export type GoogleCalendarEvent = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end:   { dateTime?: string; date?: string };
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
    /* Google イベントであることを示すフラグ */
    _isGoogle: true as const,
    _htmlLink: gEv.htmlLink,
  };
}

export type MappedGoogleEvent = ReturnType<typeof mapGoogleEvent>;
