type CookieRecord = { name: string; value: string };

type CookieWrite = CookieRecord & {
  options?: {
    domain?: string;
    path?: string;
    maxAge?: number;
    sameSite?: string | boolean;
    secure?: boolean;
  };
};

export function isRefreshTokenRequest(url: string): boolean {
  if (!url.includes("/auth/v1/token")) return false;
  return /(?:\?|&)grant_type=refresh_token(?:&|$)/.test(url);
}

/** 失効・拒否・レート制限は同じトークンで再送しない */
export function shouldAbandonRefresh(status: number): boolean {
  return status === 400 || status === 401 || status === 403 || status === 429;
}

export function isAuthCookieName(name: string): boolean {
  return name.includes("-auth-token");
}

export function filterAuthCookies<T extends { name: string }>(cookies: T[], suppressed: boolean): T[] {
  if (!suppressed) return cookies;
  return cookies.filter((cookie) => !isAuthCookieName(cookie.name));
}

export function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

export function abandonedRefreshResponse(): Response {
  return new Response(
    JSON.stringify({
      error: "invalid_grant",
      error_description: "Refresh Token Not Found",
      msg: "Refresh Token Not Found",
    }),
    { status: 400, headers: { "content-type": "application/json" } },
  );
}

/**
 * 無効な refresh token を消したあとの getSession が、Realtime の setAuth 経由で
 * 同じトークンを再送し続ける循環を止める。
 */
export function createBrowserAuthGuard(deps: {
  fetchImpl: typeof fetch;
  readCookies: () => CookieRecord[];
  writeCookie: (name: string, value: string, options?: CookieWrite["options"]) => void;
  clearAuthCookie: (name: string) => void;
}) {
  let suppressed = false;

  const suppress = () => {
    if (suppressed) return;
    suppressed = true;
    for (const cookie of deps.readCookies()) {
      if (isAuthCookieName(cookie.name)) deps.clearAuthCookie(cookie.name);
    }
  };

  return {
    get suppressed() {
      return suppressed;
    },
    getAll(): CookieRecord[] {
      return filterAuthCookies(deps.readCookies(), suppressed);
    },
    setAll(cookies: CookieWrite[]) {
      for (const cookie of cookies) {
        if (suppressed && isAuthCookieName(cookie.name) && cookie.value) continue;
        deps.writeCookie(cookie.name, cookie.value, cookie.options);
      }
    },
    fetch: async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = requestUrl(input);
      if (isRefreshTokenRequest(url) && suppressed) return abandonedRefreshResponse();
      const response = await deps.fetchImpl(input, init);
      if (isRefreshTokenRequest(url) && shouldAbandonRefresh(response.status)) suppress();
      return response;
    },
  };
}
