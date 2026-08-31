"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Star,
  Pencil,
  RefreshCw,
  Mail,
  AlertCircle,
  CheckCircle2,
  LogOut,
  Plus,
  Reply,
  Send,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { humanizeClientError } from "@/lib/humanize-error";
import {
  getEmailThreads,
  getEmailThread,
  markThreadRead,
  toggleThreadStar,
  getEmailAccounts,
  disconnectEmailAccount,
  replyToThread,
  type EmailAccount,
  type MailProvider,
} from "@/lib/actions/mail";
import { MOCK_MAIL_THREADS, MOCK_MAIL_THREAD_DETAILS } from "@/lib/mocks/mail-mock";
import { ConnectMailDialog } from "@/components/mail/connect-mail-dialog";
import { guessReplyAddress } from "@/lib/mail-reply";

type Thread = Awaited<ReturnType<typeof getEmailThreads>>[number];
type ThreadDetail = Awaited<ReturnType<typeof getEmailThread>>;

const isMockId = (id: string) => id.startsWith("mock_");

const PROVIDER_LABEL: Record<MailProvider, string> = {
  gmail: "Gmail",
  imap: "Xserver / IMAP",
  forward: "手動フォワード",
};

const PROVIDER_COLOR: Record<MailProvider, string> = {
  gmail: "bg-red-100 text-red-700",
  imap: "bg-emerald-100 text-emerald-700",
  forward: "bg-slate-100 text-slate-700",
};

const SYNC_ENDPOINT: Record<MailProvider, string | null> = {
  gmail: "/api/gmail/sync",
  imap: "/api/imap/sync",
  forward: null,
};

function resolveInitialThreads(threads: Thread[], accounts: EmailAccount[]) {
  if (accounts.length > 0) {
    return { threads: threads ?? [], useMock: false };
  }
  if (!threads || threads.length === 0) {
    return { threads: MOCK_MAIL_THREADS as unknown as Thread[], useMock: true };
  }
  return { threads, useMock: false };
}

export function MailClient({
  initialAccounts,
  initialThreads,
}: {
  initialAccounts: EmailAccount[];
  initialThreads: Thread[];
}) {
  const searchParams = useSearchParams();
  const initialResolved = resolveInitialThreads(initialThreads, initialAccounts);
  const [threads, setThreads] = useState<Thread[]>(initialResolved.threads);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState<ThreadDetail | null>(null);
  const [accounts, setAccounts] = useState<EmailAccount[]>(initialAccounts);
  const [useMock, setUseMock] = useState(initialResolved.useMock);
  const [connectOpen, setConnectOpen] = useState(false);
  const [replyTo, setReplyTo] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [replying, setReplying] = useState(false);

  useEffect(() => {
    const connected = searchParams.get("mail_connected") ?? searchParams.get("gmail_connected");
    const error = searchParams.get("mail_error") ?? searchParams.get("gmail_error");
    if (connected) {
      const labels: Record<string, string> = { "1": "Gmail", gmail: "Gmail" };
      toast.success(`${labels[connected] ?? "メールサービス"} を連携しました`);
      void loadData();
    }
    if (error) {
      const msgs: Record<string, string> = {
        access_denied: "アクセスが拒否されました（同意画面で拒否、またはテストユーザー未追加）",
        token_exchange: "認証トークンの取得に失敗しました",
        db_error: "アカウント情報の保存に失敗しました",
        unknown: "不明なエラーが発生しました",
        profile_not_found: "プロフィールが見つかりません",
        oauth_not_configured:
          "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET が未設定です。ホスティングの環境変数を設定してください",
        oauth_placeholder: "Google OAuth の環境変数がプレースホルダのままです",
        oauth_bad_format:
          "GOOGLE_CLIENT_ID の形式が不正です（*.apps.googleusercontent.com である必要があります）",
        invalid_client:
          "Google OAuth クライアントが無効です（401: invalid_client）。テストユーザーではなく、GCPの「ウェブアプリケーション」クライアントID/SecretとリダイレクトURIを確認してください",
        redirect_uri_mismatch:
          "リダイレクトURIが一致しません（400: redirect_uri_mismatch）。メール画面の連携診断に表示される redirectUri を Google Cloud Console の「承認済みのリダイレクト URI」に追加してください（例: https://bridge-linq.com/api/gmail/callback）",
      };
      toast.error(msgs[error] ?? `エラー: ${error}`, { duration: 8000 });
    }
  }, [searchParams]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [accs, data] = await Promise.all([
        getEmailAccounts(),
        getEmailThreads().catch(() => []),
      ]);
      setAccounts(accs);
      if (accs.length > 0) {
        setThreads(data ?? []);
        setUseMock(false);
      } else if (!data || data.length === 0) {
        setThreads(MOCK_MAIL_THREADS as unknown as Thread[]);
        setUseMock(true);
      } else {
        setThreads(data);
        setUseMock(false);
      }
    } catch {
      setThreads([]);
      setUseMock(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSync = async (provider?: MailProvider) => {
    const targetProvider = provider ?? accounts[0]?.provider;
    const endpoint = targetProvider ? SYNC_ENDPOINT[targetProvider] : null;
    if (!endpoint) {
      toast.info("手動フォワード方式はメールサーバー側で転送設定を行ってください");
      return;
    }
    setSyncing(true);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "同期に失敗しました");
      } else {
        toast.success(`${data.synced} 件の新着メールを取得しました`);
        await loadData();
      }
    } catch {
      toast.error("同期中にエラーが発生しました");
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async (provider: MailProvider) => {
    if (!confirm(`${PROVIDER_LABEL[provider]} の連携を解除しますか？`)) return;
    try {
      await disconnectEmailAccount(provider);
      toast.success(`${PROVIDER_LABEL[provider]} の連携を解除しました`);
      await loadData();
      setSelected(null);
    } catch {
      toast.error("連携解除に失敗しました");
    }
  };

  const selectThread = async (t: Thread) => {
    try {
      if (isMockId(t.id)) {
        const detail = MOCK_MAIL_THREAD_DETAILS[t.id];
        if (detail) setSelected(detail as unknown as ThreadDetail);
        if (!t.is_read) {
          setThreads((prev) => prev.map((x) => (x.id === t.id ? { ...x, is_read: true } : x)));
        }
        return;
      }
      // クリック直後にヘッダを出して体感遅延を消す（本文は後から差し替え）
      setSelected({
        ...t,
        messages: [],
      } as unknown as ThreadDetail);
      if (!t.is_read) {
        setThreads((prev) => prev.map((x) => (x.id === t.id ? { ...x, is_read: true } : x)));
        void markThreadRead(t.id);
      }
      const detail = await getEmailThread(t.id);
      setSelected(detail as ThreadDetail);
    } catch {
      toast.error("読み込みに失敗");
    }
  };

  useEffect(() => {
    setReplyBody("");
    setReplyTo("");
  }, [selected?.id]);

  useEffect(() => {
    if (!selected) return;
    const myEmails = accounts
      .map((a) => a.email_address)
      .filter((addr): addr is string => Boolean(addr));
    setReplyTo((prev) => prev || guessReplyAddress(selected.messages ?? [], myEmails));
  }, [selected, accounts]);

  const handleReply = async () => {
    if (!selected) return;
    if (!replyBody.trim()) {
      toast.error("本文を入力してください");
      return;
    }
    if (useMock || isMockId(selected.id)) {
      toast.error("デモ表示です。Gmail連携後に返信できます");
      return;
    }
    if (!accounts.some((a) => a.provider === "gmail")) {
      toast.error("Gmailを連携するとスレッドから返信できます");
      setConnectOpen(true);
      return;
    }
    if (!replyTo.trim() || !replyTo.includes("@")) {
      toast.error("返信先のメールアドレスを入力してください");
      return;
    }
    setReplying(true);
    try {
      const result = await replyToThread({
        threadId: selected.id,
        body_text: replyBody.trim(),
        to: replyTo.trim(),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("返信しました");
      setReplyBody("");
      setSelected(result.thread as ThreadDetail);
      setThreads((prev) =>
        prev.map((x) =>
          x.id === selected.id
            ? {
                ...x,
                snippet: replyBody.trim().slice(0, 200),
                last_message_at: new Date().toISOString(),
                is_read: true,
              }
            : x
        )
      );
    } catch (e) {
      toast.error(humanizeClientError(e, "返信に失敗しました。Gmail連携と返信先を確認してください"));
    } finally {
      setReplying(false);
    }
  };

  const handleStar = async (id: string, current: boolean) => {
    if (isMockId(id)) {
      setThreads((prev) => prev.map((x) => (x.id === id ? { ...x, is_starred: !current } : x)));
      return;
    }
    try {
      await toggleThreadStar(id, !current);
      setThreads((prev) => prev.map((x) => (x.id === id ? { ...x, is_starred: !current } : x)));
    } catch {}
  };

  const hasAccounts = accounts.length > 0;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">メール</h1>
        <div className="flex items-center gap-2">
          {accounts.map((acc) => (
            <DropdownMenu key={acc.id}>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="hidden md:inline max-w-[140px] truncate">
                    {acc.provider === "forward" ? "手動フォワード" : acc.email_address}
                  </span>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] px-1.5 py-0 ml-0.5 ${PROVIDER_COLOR[acc.provider]}`}
                  >
                    {PROVIDER_LABEL[acc.provider]}
                  </Badge>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {acc.provider !== "forward" && (
                  <>
                    <DropdownMenuItem
                      className="gap-2 text-sm"
                      onClick={() => handleSync(acc.provider)}
                      disabled={syncing}
                    >
                      <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                      同期
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive gap-2"
                  onClick={() => handleDisconnect(acc.provider)}
                >
                  <LogOut className="h-4 w-4" />
                  連携を解除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ))}

          {hasAccounts && accounts.some((a) => a.provider !== "forward") && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSync()}
              disabled={syncing}
              className="gap-1.5"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "同期中..." : "同期"}
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => setConnectOpen(true)}
            className="gap-1.5 border-orange-300 text-orange-700 hover:bg-orange-50"
          >
            {hasAccounts ? (
              <><Plus className="h-4 w-4" />追加</>
            ) : (
              <><Mail className="h-4 w-4" />メールを連携</>
            )}
          </Button>

          <Link href="/mail/compose">
            <Button size="sm" className="gap-1.5">
              <Pencil className="h-4 w-4" />
              新規作成
            </Button>
          </Link>
        </div>
      </div>

      {!hasAccounts && !loading && (
        <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            メールサービスが未連携です。「メールを連携」ボタンから Gmail・Xserver 等を接続してください。
          </span>
        </div>
      )}

      {useMock && hasAccounts && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <RefreshCw className="h-4 w-4 shrink-0" />
          <span>連携しました。「同期」ボタンを押してメールを取得してください。</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : threads.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {hasAccounts ? "同期済みのメールはありません。受信トレイが空か、右上の「同期」で再取得できます。" : "メールはありません"}
              </div>
            ) : (
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {threads.map((t) => (
                  <div
                    key={t.id}
                    className={`flex items-start gap-3 p-3 cursor-pointer glass-row transition-colors ${
                      selected?.id === t.id ? "bg-accent/30" : ""
                    } ${!t.is_read ? "bg-primary/5" : ""}`}
                    onClick={() => selectThread(t)}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStar(t.id, t.is_starred);
                      }}
                    >
                      <Star
                        className={`h-4 w-4 ${
                          t.is_starred
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-muted-foreground"
                        }`}
                      />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-sm truncate flex-1 ${!t.is_read ? "font-semibold" : ""}`}>
                          {t.subject || "(件名なし)"}
                        </p>
                        {!t.is_read && (
                          <Badge
                            variant="default"
                            className="h-1.5 w-1.5 p-0 rounded-full bg-primary shrink-0"
                          />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{t.snippet}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {t.last_message_at
                        ? format(parseISO(t.last_message_at), "M/d", { locale: ja })
                        : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            {selected ? (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">{selected.subject || "(件名なし)"}</h2>
                {(selected.messages ?? []).map(
                  (msg: {
                    id: string;
                    from_name: string | null;
                    from_address: string | null;
                    received_at: string | null;
                    body_text: string | null;
                  }) => (
                    <div key={msg.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">
                          {msg.from_name || msg.from_address || "-"}
                        </span>
                        <span className="text-muted-foreground">
                          {msg.received_at
                            ? format(parseISO(msg.received_at), "M/d HH:mm", { locale: ja })
                            : ""}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{msg.body_text}</p>
                    </div>
                  )
                )}
                <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Reply className="h-4 w-4" />
                    このスレッドに返信
                  </div>
                  <Input
                    value={replyTo}
                    onChange={(e) => setReplyTo(e.target.value)}
                    placeholder="返信先（name@example.com）"
                    disabled={replying}
                  />
                  <Textarea
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="返信内容を入力..."
                    rows={5}
                    disabled={replying}
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => void handleReply()}
                      disabled={replying}
                    >
                      <Send className="h-4 w-4" />
                      {replying ? "送信中..." : "返信する"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
                <Mail className="h-8 w-8 opacity-30" />
                <p>メールを選択してください</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ConnectMailDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        onConnected={loadData}
      />
    </div>
  );
}

