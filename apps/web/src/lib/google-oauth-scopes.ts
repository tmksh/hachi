/** Google Calendar 書き込み連携に必要な OAuth スコープ */
export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

export function googleCalendarOAuthOptions(redirectTo: string) {
  return {
    redirectTo,
    scopes: GOOGLE_CALENDAR_SCOPES,
    queryParams: {
      access_type: "offline",
      prompt: "consent",
      scope: GOOGLE_CALENDAR_SCOPES,
    },
  };
}
