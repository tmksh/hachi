"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useImeComposition } from "@/hooks/use-ime-composition";
import { format, parseISO, isSameDay } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  addContractCommunication,
  updateCommunicationAgreementStatus,
  syncContractPlatformMessages,
  seedContractMessagingDemo,
  saveContractPostSignInfo,
  getContractMessagingContext,
  type ContractMessagingContext,
} from "@/lib/actions/contract-features";
import { fetchContractCommunications, fetchContractPostSignInfo } from "@/lib/queries/details";
import { MessagingLinkSetup } from "@/components/contracts/messaging-link-setup";
import { CustomerAvatar } from "@/components/shared/customer-avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Loader2,
  RefreshCw,
  Send,
  User,
} from "lucide-react";
import { MESSAGING_PLATFORMS, type MessagingPlatform } from "@/components/shared/platform-icons";

type Platform = MessagingPlatform;
type Message = Awaited<ReturnType<typeof fetchContractCommunications>>[number];

const PLATFORMS = MESSAGING_PLATFORMS;

export function ContractMessagingTab({
  contractId,
  customerId,
}: {
  contractId: string;
  customerId?: string | null;
}) {
  const [platform, setPlatform] = useState<Platform>("line");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sending, setSending] = useState(false);
  const [body, setBody] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [linkContext, setLinkContext] = useState<ContractMessagingContext | null>(null);
  const [postSign, setPostSign] = useState<{ label: string; value: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const ime = useImeComposition();

  const load = () => {
    setLoading(true);
    fetchContractCommunications(contractId)
      .then(setMessages)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      try {
        const [existing, context] = await Promise.all([
          fetchContractCommunications(contractId),
          getContractMessagingContext(contractId),
        ]);
        if (cancelled) return;
        setMessages(existing);
        setLinkContext(context);
        if (existing.length > 0) {
          const latest = existing.reduce((a, b) => (a.sent_at > b.sent_at ? a : b));
          setLastSyncedAt(parseISO(latest.sent_at));
        }
      } catch {
        if (!cancelled) toast.error("やり取り履歴の読み込みに失敗しました");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    fetchContractPostSignInfo(contractId)
      .then((rows) => setPostSign(rows.map((r) => ({ label: r.label, value: r.value ?? "" }))))
      .catch(() => {});

    return () => { cancelled = true; };
  }, [contractId, customerId]);

  const platformMessages = useMemo(
    () => messages.filter((m) => m.platform === platform).sort((a, b) => a.sent_at.localeCompare(b.sent_at)),
    [messages, platform],
  );

  const important = useMemo(() => messages.filter((m) => m.is_important), [messages]);
  const addressedCount = important.filter((m) => m.agreement_status === "addressed").length;
  const activePlatform = PLATFORMS.find((p) => p.key === platform)!;

  const lastPreviewByPlatform = useMemo(() => {
    const map: Partial<Record<Platform, string>> = {};
    for (const p of PLATFORMS) {
      const last = messages.filter((m) => m.platform === p.key).sort((a, b) => b.sent_at.localeCompare(a.sent_at))[0];
      if (last) map[p.key] = last.body.slice(0, 36) + (last.body.length > 36 ? "…" : "");
    }
    return map;
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [platformMessages.length, platform]);

  const handleLoadDemo = async () => {
    setLoadingDemo(true);
    try {
      const result = await seedContractMessagingDemo(contractId);
      setMessages(result.messages);
      setLastSyncedAt(new Date());
      setIsDemo(true);
      toast.success("サンプルデータを読み込みました");
    } catch {
      toast.error("サンプルデータの読み込みに失敗しました");
    } finally {
      setLoadingDemo(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncContractPlatformMessages(contractId, platform);
      setMessages(result.messages);
      setLastSyncedAt(new Date());
      toast.success(
        result.extractedCount > 0
          ? `履歴を取得し、合意事項 ${result.extractedCount} 件を抽出しました`
          : "やり取り履歴を取得しました",
      );
    } catch {
      toast.error("履歴の取得に失敗しました");
    } finally {
      setSyncing(false);
    }
  };

  const handleSend = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      await addContractCommunication({ contract_id: contractId, platform, body, direction: "outbound" });
      setBody("");
      load();
    } catch {
      toast.error("送信に失敗");
    } finally {
      setSending(false);
    }
  };

  const toggleAgreement = async (id: string, addressed: boolean) => {
    try {
      await updateCommunicationAgreementStatus(id, addressed ? "addressed" : "pending");
      load();
    } catch {
      toast.error("更新に失敗しました");
    }
  };

  return (
    <div className="space-y-4">
      {linkContext && (
        <MessagingLinkSetup
          context={linkContext}
          onUpdated={setLinkContext}
          onLoadDemo={handleLoadDemo}
          loadingDemo={loadingDemo}
          defaultExpanded={!messages.length}
        />
      )}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4">
        {/* チャット本体 */}
        <div className="rounded-xl border border-border/60 bg-background overflow-hidden flex flex-col h-[min(72vh,620px)] shadow-sm">
          <div className="flex flex-1 min-h-0">
            {/* サイドバー: チャンネル一覧 */}
            <aside className="hidden sm:flex w-[200px] shrink-0 flex-col border-r border-border/50 bg-white dark:bg-[#1F2937]">
              <div className="px-3 py-3 border-b border-border/40 bg-white dark:bg-[#1F2937]">
                {linkContext?.customer ? (
                  <div className="flex items-center gap-2">
                    <CustomerAvatar
                      seed={linkContext.customer.id}
                      name={linkContext.customer.name}
                      className="h-6 w-6 text-[10px]"
                    />
                    <p className="text-xs font-semibold truncate">{linkContext.customer.name}</p>
                  </div>
                ) : (
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">チャンネル</p>
                )}
              </div>
              <nav className="flex-1 overflow-y-auto p-2 space-y-0.5 bg-white dark:bg-[#1F2937]">
                {PLATFORMS.map(({ key, label, Icon }) => {
                  const active = platform === key;
                  const preview = lastPreviewByPlatform[key];
                  const count = messages.filter((m) => m.platform === key).length;
                  const channelId =
                    key === "line" ? linkContext?.customer?.line_user_id :
                    key === "slack" ? linkContext?.customer?.slack_channel_id :
                    key === "email" ? linkContext?.customer?.email :
                    null;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPlatform(key)}
                      className={cn(
                        "w-full text-left rounded-lg px-2.5 py-2 transition-colors",
                        active
                          ? "bg-white dark:bg-[#111827] shadow-sm border border-border/50"
                          : "hover:bg-muted/30 border border-transparent",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "size-8 rounded-full flex items-center justify-center shrink-0",
                          active ? "bg-white dark:bg-[#111827] shadow-sm" : "bg-muted/50",
                        )}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-semibold truncate">{label}</span>
                            {count > 0 && (
                              <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{count}</span>
                            )}
                          </div>
                          {channelId ? (
                            <p className="text-[10px] text-muted-foreground truncate mt-0.5 font-mono">{channelId}</p>
                          ) : preview ? (
                            <p className="text-[10px] text-muted-foreground truncate mt-0.5">{preview}</p>
                          ) : (
                            <p className="text-[10px] text-amber-500/80 mt-0.5">未連携</p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </aside>

            {/* メインチャット */}
            <div className="flex flex-col flex-1 min-w-0">
              {/* チャットヘッダー */}
              <div className={cn("flex items-center gap-3 px-4 py-3 border-b shrink-0", activePlatform.headerBg)}>
                <div className="sm:hidden">
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value as Platform)}
                    className="text-xs font-medium bg-transparent border-none outline-none cursor-pointer"
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p.key} value={p.key}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div className="hidden sm:flex size-9 rounded-full bg-background/80 items-center justify-center shrink-0 shadow-sm">
                  <activePlatform.Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">
                      {linkContext?.customer?.name
                        ? `${linkContext.customer.name} — ${activePlatform.label}`
                        : activePlatform.label}
                    </p>
                    {isDemo && (
                      <Badge variant="secondary" className="text-[9px] h-4 px-1.5 shrink-0">デモ</Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate font-mono">
                    {platform === "line" && linkContext?.customer?.line_user_id
                      ? linkContext.customer.line_user_id
                      : platform === "slack" && linkContext?.customer?.slack_channel_id
                        ? linkContext.customer.slack_channel_id
                        : platform === "email" && linkContext?.customer?.email
                          ? linkContext.customer.email
                          : lastSyncedAt
                            ? `最終同期 ${format(lastSyncedAt, "M/d HH:mm", { locale: ja })}`
                            : "未連携 — 上の連携設定から登録してください"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleSync()}
                  disabled={syncing}
                  className="gap-1.5 h-8 text-xs bg-background/80 shrink-0"
                >
                  {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  履歴を取得
                </Button>
              </div>

              {/* メッセージエリア */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-white dark:bg-[#111827]/40"
              >
                {loading ? (
                  <div className="space-y-4 py-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className={cn("flex gap-2", i % 2 === 1 && "flex-row-reverse")}>
                        <Skeleton className="size-8 rounded-full shrink-0" />
                        <Skeleton className={cn("h-12 rounded-2xl", i % 2 === 0 ? "w-[65%]" : "w-[50%]")} />
                      </div>
                    ))}
                  </div>
                ) : platformMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[280px] text-center px-6">
                    <div className="size-16 rounded-full bg-muted/60 flex items-center justify-center mb-4">
                      <activePlatform.Icon className="h-9 w-9 opacity-90" />
                    </div>
                    <p className="text-sm font-medium text-foreground/80">メッセージがありません</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                      {activePlatform.label} のやり取り履歴を読み込んで会話を開始しましょう
                    </p>
                    <Button size="sm" variant="outline" onClick={() => void handleSync()} disabled={syncing} className="mt-4 gap-1.5">
                      {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      履歴を取得
                    </Button>
                  </div>
                ) : (
                  platformMessages.map((m, i) => {
                    const prev = platformMessages[i - 1];
                    const showDate = !prev || !isSameDay(parseISO(prev.sent_at), parseISO(m.sent_at));
                    return (
                      <div key={m.id}>
                        {showDate && <DateSeparator date={m.sent_at} />}
                        <MessageBubble message={m} theme={activePlatform} />
                      </div>
                    );
                  })
                )}
              </div>

              {/* 入力バー */}
              <div className="shrink-0 border-t border-border/50 bg-white dark:bg-[#1F2937] px-3 py-3">
                <form
                  className="flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (ime.shouldBlockSubmit()) return;
                    void handleSend();
                  }}
                >
                  <Input
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="メッセージを入力..."
                    disabled={sending}
                    onCompositionStart={ime.onCompositionStart}
                    onCompositionEnd={ime.onCompositionEnd}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" || e.shiftKey) return;
                      if (ime.shouldBlockSubmit(e)) {
                        e.preventDefault();
                      }
                    }}
                    className="flex-1 h-10 rounded-full bg-muted/40 border-transparent focus-visible:bg-background px-4"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    onPointerDown={ime.armSend}
                    disabled={sending || !body.trim()}
                    className="size-10 rounded-full shrink-0"
                    onClick={(e) => {
                      if (ime.shouldIgnoreSendClick()) e.preventDefault();
                    }}
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* 重要な合意事項（サイドパネル） */}
        <Card variant="inset" className="py-0 overflow-hidden flex flex-col h-[min(72vh,620px)] xl:sticky xl:top-4">
          <CardHeader className="pb-2 pt-4 px-4 border-b border-border/40 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold">
                重要な合意事項
              </CardTitle>
              {important.length > 0 && (
                <Badge variant="outline" className="text-[10px] tabular-nums">
                  {addressedCount}/{important.length}
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">AIが抽出 · タップで対応済みに</p>
          </CardHeader>
          <CardContent className="px-3 py-3 flex-1 min-h-0 overflow-y-auto">
            {important.length === 0 ? (
              <div className="flex flex-col items-center text-center py-8 px-2 text-muted-foreground">
                <AlertCircle className="h-5 w-5 mb-2 opacity-50" />
                <p className="text-xs">履歴取得後に<br />自動抽出されます</p>
              </div>
            ) : (
              <div className="space-y-2">
                {important.map((m) => (
                  <AgreementItem key={m.id} message={m} onToggle={toggleAgreement} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 契約後の情報入力 */}
      <Card variant="inset" className="py-0 overflow-hidden">
        <CardHeader className="pb-2 pt-4 px-4 border-b border-border/40">
          <CardTitle className="text-sm font-semibold">契約後の情報入力</CardTitle>
        </CardHeader>
        <CardContent className="px-4 py-4 space-y-2">
          {[
            { label: "振込口座", value: "" },
            { label: "建物用途", value: "" },
            { label: "法規確認事項", value: "" },
          ].map((item, i) => (
            <div key={i} className="grid grid-cols-[120px_1fr] gap-2 items-center">
              <Input value={postSign[i]?.label ?? item.label} readOnly className="h-8 text-xs bg-muted/30" />
              <Input
                value={postSign[i]?.value ?? ""}
                onChange={(e) => {
                  const next = [...postSign];
                  next[i] = { label: item.label, value: e.target.value };
                  setPostSign(next);
                }}
                className="h-8 text-sm"
              />
            </div>
          ))}
          <div className="flex justify-end pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await saveContractPostSignInfo(contractId, postSign.length ? postSign : [{ label: "振込口座", value: "" }]);
                toast.success("保存しました");
              }}
            >
              保存
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 h-px bg-border/50" />
      <span className="text-[10px] text-muted-foreground shrink-0 px-1">
        {format(parseISO(date), "yyyy年M月d日（E）", { locale: ja })}
      </span>
      <div className="flex-1 h-px bg-border/50" />
    </div>
  );
}

function MessageBubble({
  message,
  theme,
}: {
  message: Message;
  theme: (typeof PLATFORMS)[number];
}) {
  const outbound = message.direction === "outbound";
  const initial = (message.sender_name ?? "顧").charAt(0);

  return (
    <div className={cn("flex gap-2 py-0.5", outbound ? "flex-row-reverse" : "flex-row")}>
      {!outbound && (
        <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-auto mb-5">
          {message.sender_name ? (
            <span className="text-xs font-semibold text-muted-foreground">{initial}</span>
          ) : (
            <User className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      )}
      <div className={cn("flex flex-col max-w-[75%]", outbound ? "items-end" : "items-start")}>
        {!outbound && message.sender_name && (
          <span className="text-[10px] text-muted-foreground mb-1 ml-1">{message.sender_name}</span>
        )}
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2 shadow-sm text-sm leading-relaxed whitespace-pre-wrap",
            outbound ? cn(theme.bubbleOut, "rounded-br-sm") : cn(theme.bubbleIn, "rounded-bl-sm"),
          )}
        >
          {message.body}
        </div>
        <span className="text-[10px] text-muted-foreground/70 mt-1 mx-1 tabular-nums">
          {format(parseISO(message.sent_at), "HH:mm", { locale: ja })}
          {outbound && " · あなた"}
        </span>
      </div>
    </div>
  );
}

function AgreementItem({
  message,
  onToggle,
}: {
  message: Message;
  onToggle: (id: string, addressed: boolean) => void;
}) {
  const addressed = message.agreement_status === "addressed";
  const platformMeta = PLATFORMS.find((p) => p.key === message.platform);

  return (
    <button
      type="button"
      onClick={() => void onToggle(message.id, !addressed)}
      className={cn(
        "w-full text-left rounded-lg border p-2.5 transition-colors",
        addressed
          ? "border-emerald-200/70 bg-emerald-50/40 dark:border-emerald-900/30 dark:bg-emerald-950/15"
          : "border-amber-200/70 bg-amber-50/30 hover:bg-amber-50/60 dark:border-amber-900/30 dark:bg-amber-950/10",
      )}
    >
      <div className="flex items-start gap-2">
        {addressed ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
        ) : (
          <Circle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        )}
        <div className="min-w-0 flex-1">
          <p className={cn("text-xs leading-relaxed", addressed && "line-through text-muted-foreground decoration-emerald-400/50")}>
            {message.body}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5">
            {platformMeta && (
              <Badge variant="outline" className="text-[9px] h-4 px-1.5 gap-0.5">
                <platformMeta.Icon className="h-2.5 w-2.5" />
                {platformMeta.label}
              </Badge>
            )}
            <span className={cn("text-[9px] font-medium", addressed ? "text-emerald-600" : "text-amber-700")}>
              {addressed ? "対応済" : "未対応"}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
