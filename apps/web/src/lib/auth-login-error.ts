type AuthLikeError = {
  message?: string;
  status?: number;
  code?: string;
} | null | undefined;

export function isLoginRateLimitError(error: AuthLikeError): boolean {
  const status = error?.status;
  const code = (error?.code ?? "").toLowerCase();
  const message = (error?.message ?? "").toLowerCase();
  return (
    status === 429
    || code.includes("rate_limit")
    || message.includes("rate limit")
    || message.includes("too many")
  );
}

export function loginErrorToast(error: AuthLikeError): { title: string; description: string } {
  if (isLoginRateLimitError(error)) {
    return {
      title: "ログイン試行が多すぎます",
      description: "同じアカウントへのログインが集中しています。しばらく待ってから再度お試しください",
    };
  }
  return {
    title: "ログインに失敗しました",
    description: "メールアドレスまたはパスワードが正しくありません",
  };
}
