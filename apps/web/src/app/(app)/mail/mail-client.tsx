"use client";

import { useState, useEffect, useCallback } from "react";
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
  Flag,
  Folder,
  FolderInput,
  FolderPlus,
  Inbox,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  markThreadRead,
  toggleThreadStar,
  toggleThreadFlag,
  setThreadSpam,
  moveThreadToFolder,
  listEmailFolders,
  createEmailFolder,
  renameEmailFolder,
  deleteEmailFolder,
  disconnectEmailAccount,
  replyToThread,
  type EmailAccount,
  type EmailFolder,
  type MailProvider,
} from "@/lib/actions/mail";
import { fetchMailAccounts, fetchMailThread, fetchMailThreads } from "@/lib/queries/portal";
import { MOCK_MAIL_THREADS, MOCK_MAIL_THREAD_DETAILS } from "@/lib/mocks/mail-mock";
import { ConnectMailDialog } from "@/components/mail/connect-mail-dialog";
import { threadMatchesFolder } from "@/lib/mail-folders";
import { guessReplyAddress } from "@/lib/mail-reply";

type Thread = Awaited<ReturnType<typeof fetchMailThreads>>[number] & {
  is_spam?: boolean | null;
  is_flagged?: boolean | null;
  folder_id?: string | null;
};
type ThreadDetail = Awaited<ReturnType<typeof fetchMailThread>>;

/** 固定フォルダ: 受信トレイ / 迷惑メール / スター / フラグ。それ以外は email_folders.id */
type FolderKey = "inbox" | "starred" | "flagged" | string;

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

  // フォルダ分け・フラグ（No.143）
  const [folders, setFolders] = useState<EmailFolder[]>([]);
  const [activeFolder, setActiveFolder] = useState<FolderKey>("inbox");
  const [folderDialog, setFolderDialog] = useState<{ mode: "create" } | { mode: "rename"; folder: EmailFolder } | null>(null);
  const [folderName, setFolderName] = useState("");
  const [folderSaving, setFolderSaving] = useState(false);

  useEffect(() => {
    listEmailFolders().then(setFolders).catch(() => setFolders([]));
  }, []);

  const visibleThreads = threads.filter((t) => threadMatchesFolder(t, activeFolder));
  const countFor = (key: FolderKey) => threads.filter((t) =>
    threadMatchesFolder(t, key) && (key !== "inbox" || !t.is_read),
  ).length;

  const handleSpam = async (id: string, spam: boolean) => {
    try {
      if (!isMockId(id)) {
        const result = await setThreadSpam(id, spam);
        if (!result.ok) throw new Error(result.error);
      }
      setThreads((prev) => prev.map((t) => t.id === id ? { ...t, is_spam: spam, folder_id: null } : t));
      if (selected?.id === id) setSelected(null);
      toast.success(spam ? "迷惑メールへ移動しました" : "受信トレイへ戻しました");
    } catch (error) {
      toast.error(humanizeClientError(error, "迷惑メールの振り分けに失敗しました"));
    }
  };

  const handleFlag = async (id: string, current: boolean) => {
    setThreads((prev) => prev.map((x) => (x.id === id ? { ...x, is_flagged: !current } : x)));
    if (isMockId(id)) return;
    const res = await toggleThreadFlag(id, !current);
    if (!res.ok) {
      setThreads((prev) => prev.map((x) => (x.id === id ? { ...x, is_flagged: current } : x)));
      toast.error(res.error);
    }
  };

  const handleMove = async (id: string, folderId: string | null) => {
    const previous = threads.find((x) => x.id === id);
    const prevFolder = previous?.folder_id ?? null;
    setThreads((prev) => prev.map((x) => (x.id === id ? { ...x, folder_id: folderId, is_spam: false } : x)));
    if (isMockId(id)) {
      toast.success(folderId ? `「${folders.find((f) => f.id === folderId)?.name ?? ""}」へ移動しました` : "受信トレイへ戻しました");
      return;
    }
    const res = await moveThreadToFolder(id, folderId);
    if (!res.ok) {
      setThreads((prev) => prev.map((x) => (x.id === id ? { ...x, folder_id: prevFolder, is_spam: previous?.is_spam } : x)));
      toast.error(res.error);
      return;
    }
    toast.success(folderId ? `「${folders.find((f) => f.id === folderId)?.name ?? ""}」へ移動しました` : "受信トレイへ戻しました");
  };

  const openCreateFolder = () => { setFolderName(""); setFolderDialog({ mode: "create" }); };
  const openRenameFolder = (folder: EmailFolder) => { setFolderName(folder.name); setFolderDialog({ mode: "rename", folder }); };

  const saveFolder = async () => {
    if (!folderDialog) return;
    setFolderSaving(true);
    try {
      if (folderDialog.mode === "create") {
        const res = await createEmailFolder(folderName);
        if (!res.ok) { toast.error(res.error); return; }
        setFolders((prev) => [...prev, res.folder]);
        setActiveFolder(res.folder.id);
        toast.success(`フォルダ「${res.folder.name}」を作成しました`);
      } else {
        const res = await renameEmailFolder(folderDialog.folder.id, folderName);
        if (!res.ok) { toast.error(res.error); return; }
        setFolders((prev) => prev.map((f) => (f.id === folderDialog.folder.id ? { ...f, name: folderName.trim() } : f)));
        toast.success("フォルダ名を変更しました");
      }
      setFolderDialog(null);
    } finally {
      setFolderSaving(false);
    }
  };

  const removeFolder = async (folder: EmailFolder) => {
    if (!confirm(`フォルダ「${folder.name}」を削除しますか？（中のメールは受信トレイに戻ります）`)) return;
    const res = await deleteEmailFolder(folder.id);
    if (!res.ok) { toast.error(res.error); return; }
    setFolders((prev) => prev.filter((f) => f.id !== folder.id));
    setThreads((prev) => prev.map((x) => (x.folder_id === folder.id ? { ...x, folder_id: null } : x)));
    if (activeFolder === folder.id) setActiveFolder("inbox");
    toast.success("フォルダを削除しました");
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [accs, data] = await Promise.all([
        fetchMailAccounts(),
        fetchMailThreads().catch(() => []),
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
  }, [searchParams, loadData]);



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
      const detail = await fetchMailThread(t.id);
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

      <div className="grid grid-cols-1 lg:grid-cols-[200px_360px_1fr] gap-4">
        {/* フォルダ（受信一覧の前段） */}
        <Card className="overflow-hidden h-fit">
          <CardContent className="p-2 space-y-0.5">
            {([
              { key: "inbox" as FolderKey, label: "受信トレイ", icon: Inbox, badge: "unread" as const },
              { key: "spam" as FolderKey, label: "迷惑メール", icon: AlertCircle, badge: "count" as const },
              { key: "starred" as FolderKey, label: "スター付き", icon: Star, badge: "count" as const },
              { key: "flagged" as FolderKey, label: "フラグ付き", icon: Flag, badge: "count" as const },
            ]).map(({ key, label, icon: Icon }) => {
              const n = countFor(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveFolder(key)}
                  className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                    activeFolder === key ? "bg-accent font-medium" : "hover:bg-muted/60 text-foreground/80"
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${key === "starred" ? "text-yellow-500" : key === "flagged" ? "text-rose-500" : "text-muted-foreground"}`} />
                  <span className="flex-1 text-left truncate">{label}</span>
                  {n > 0 && (
                    <span className={`text-[10px] tabular-nums rounded-full px-1.5 py-0.5 ${key === "inbox" ? "bg-primary/10 text-primary font-semibold" : "bg-muted text-muted-foreground"}`}>
                      {n}
                    </span>
                  )}
                </button>
              );
            })}

            <div className="flex items-center justify-between px-2.5 pt-3 pb-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">フォルダ</span>
              <button
                type="button"
                onClick={openCreateFolder}
                className="text-muted-foreground hover:text-foreground"
                aria-label="フォルダを作成"
                title="フォルダを作成"
              >
                <FolderPlus className="h-4 w-4" />
              </button>
            </div>
            {folders.length === 0 && (
              <p className="px-2.5 pb-2 text-[11px] text-muted-foreground leading-snug">
                会社別・請求書などのフォルダを作成して、メールを振り分けられます。
              </p>
            )}
            {folders.map((f) => {
              const n = countFor(f.id);
              return (
                <div
                  key={f.id}
                  className={`group flex items-center gap-1 rounded-lg pr-1 transition-colors ${
                    activeFolder === f.id ? "bg-accent" : "hover:bg-muted/60"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveFolder(f.id)}
                    className={`flex-1 min-w-0 flex items-center gap-2 px-2.5 py-2 text-sm ${activeFolder === f.id ? "font-medium" : "text-foreground/80"}`}
                  >
                    <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 text-left truncate">{f.name}</span>
                    {n > 0 && <span className="text-[10px] tabular-nums rounded-full px-1.5 py-0.5 bg-muted text-muted-foreground">{n}</span>}
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-background"
                        aria-label="フォルダ操作"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => openRenameFolder(f)} className="gap-2 text-sm">
                        <Pencil className="h-3.5 w-3.5" />名前を変更
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void removeFolder(f)} className="gap-2 text-sm text-destructive focus:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />削除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : visibleThreads.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                {threads.length === 0
                  ? (hasAccounts ? "同期済みのメールはありません。受信トレイが空か、右上の「同期」で再取得できます。" : "メールはありません")
                  : activeFolder === "starred"
                    ? "スター付きのメールはありません"
                    : activeFolder === "flagged"
                      ? "フラグ付きのメールはありません"
                      : "このフォルダにメールはありません。一覧の「…」から移動できます。"}
              </div>
            ) : (
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {visibleThreads.map((t: Thread) => {
                  const folderName = t.folder_id ? folders.find((f) => f.id === t.folder_id)?.name : null;
                  return (
                  <div
                    key={t.id}
                    className={`group flex items-start gap-2 p-3 cursor-pointer glass-row transition-colors ${
                      selected?.id === t.id ? "bg-accent/30" : ""
                    } ${!t.is_read ? "bg-primary/5" : ""}`}
                    onClick={() => selectThread(t)}
                  >
                    <div className="flex flex-col items-center gap-1.5 pt-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStar(t.id, t.is_starred);
                        }}
                        aria-label={t.is_starred ? "スターを外す" : "スターを付ける"}
                      >
                        <Star
                          className={`h-4 w-4 ${
                            t.is_starred
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground/60 hover:text-yellow-400"
                          }`}
                        />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleFlag(t.id, Boolean(t.is_flagged));
                        }}
                        aria-label={t.is_flagged ? "フラグを外す" : "フラグを付ける"}
                      >
                        <Flag
                          className={`h-4 w-4 ${
                            t.is_flagged
                              ? "fill-rose-500 text-rose-500"
                              : "text-muted-foreground/60 hover:text-rose-500"
                          }`}
                        />
                      </button>
                    </div>
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
                      {folderName && activeFolder === "inbox" && (
                        <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                          <Folder className="h-2.5 w-2.5" />{folderName}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] text-muted-foreground">
                        {t.last_message_at
                          ? format(parseISO(t.last_message_at), "M/d", { locale: ja })
                          : ""}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100 hover:bg-background"
                            aria-label="フォルダへ移動"
                            title="フォルダへ移動"
                          >
                            <FolderInput className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">フォルダへ移動</div>
                          {folders.map((f) => (
                            <DropdownMenuItem
                              key={f.id}
                              disabled={t.folder_id === f.id}
                              onClick={() => void handleMove(t.id, f.id)}
                              className="gap-2 text-sm"
                            >
                              <Folder className="h-3.5 w-3.5" />{f.name}
                            </DropdownMenuItem>
                          ))}
                          {folders.length > 0 && <DropdownMenuSeparator />}
                          <DropdownMenuItem onClick={() => void handleSpam(t.id, !t.is_spam)} className="gap-2 text-sm">
                            <AlertCircle className="h-3.5 w-3.5" />{t.is_spam ? "迷惑メールを解除" : "迷惑メールへ移動"}
                          </DropdownMenuItem>
                          {t.folder_id && (
                            <DropdownMenuItem onClick={() => void handleMove(t.id, null)} className="gap-2 text-sm">
                              <Inbox className="h-3.5 w-3.5" />受信トレイに戻す
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={openCreateFolder} className="gap-2 text-sm">
                            <FolderPlus className="h-3.5 w-3.5" />新しいフォルダ...
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  );
                })}
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

      <Dialog open={!!folderDialog} onOpenChange={(o) => !o && setFolderDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{folderDialog?.mode === "rename" ? "フォルダ名を変更" : "フォルダを作成"}</DialogTitle>
          </DialogHeader>
          <Input
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="例: 〇〇建材、請求書、社内"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) void saveFolder();
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialog(null)}>キャンセル</Button>
            <Button onClick={() => void saveFolder()} disabled={folderSaving || !folderName.trim()}>
              {folderSaving ? "保存中..." : folderDialog?.mode === "rename" ? "変更" : "作成"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

