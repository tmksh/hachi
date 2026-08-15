"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Mail, Copy, Check, ArrowLeft, Loader2 } from "lucide-react";

type Provider = "gmail" | "imap" | "forward" | null;
type Step = "select_provider" | "select_method" | "imap_form" | "forward_done";

interface ConnectMailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: () => void;
}

const PROVIDER_PRESETS: Record<
  string,
  { imap_host: string; imap_port: number; smtp_host: string; smtp_port: number }
> = {
  xserver: {
    imap_host: "sv%%.xserver.jp",
    imap_port: 993,
    smtp_host: "sv%%.xserver.jp",
    smtp_port: 465,
  },
  gmail_imap: {
    imap_host: "imap.gmail.com",
    imap_port: 993,
    smtp_host: "smtp.gmail.com",
    smtp_port: 465,
  },
};

export function ConnectMailDialog({
  open,
  onOpenChange,
  onConnected,
}: ConnectMailDialogProps) {
  const [step, setStep] = useState<Step>("select_provider");
  const [selectedProvider, setSelectedProvider] = useState<Provider>(null);
  const [loading, setLoading] = useState(false);
  const [forwardAddress, setForwardAddress] = useState("");
  const [copied, setCopied] = useState(false);
  const [gmailRedirectUri, setGmailRedirectUri] = useState("");

  // IMAP form state
  const [emailAddress, setEmailAddress] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState("993");
  const [imapUser, setImapUser] = useState("");
  const [imapPass, setImapPass] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("465");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");

  useEffect(() => {
    if (!open) return;
    void fetch("/api/gmail/oauth-status")
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.redirectUri === "string") setGmailRedirectUri(data.redirectUri);
      })
      .catch(() => {});
  }, [open]);

  const reset = () => {
    setStep("select_provider");
    setSelectedProvider(null);
    setLoading(false);
    setForwardAddress("");
    setCopied(false);
    setGmailRedirectUri("");
    setEmailAddress("");
    setDisplayName("");
    setImapHost("");
    setImapPort("993");
    setImapUser("");
    setImapPass("");
    setSmtpHost("");
    setSmtpPort("465");
    setSmtpUser("");
    setSmtpPass("");
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleSelectProvider = async (p: Provider) => {
    setSelectedProvider(p);
    if (p === "gmail") {
      setLoading(true);
      try {
        const res = await fetch("/api/gmail/oauth-status");
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data.error || "OAuth設定の確認に失敗しました");
          setLoading(false);
          return;
        }
        if (!data.configured) {
          const issueMsgs: Record<string, string> = {
            missing: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET が未設定です",
            placeholder: "Google OAuth 環境変数がプレースホルダのままです",
            invalid_format: "GOOGLE_CLIENT_ID の形式が不正です",
          };
          toast.error(
            issueMsgs[data.issue as string]
              ?? "Gmail OAuth が設定されていません",
            { description: data.redirectUri
              ? `GCPの承認済みリダイレクトURIに追加: ${data.redirectUri}`
              : undefined,
              duration: 10000 },
          );
          setLoading(false);
          return;
        }
        // 設定済みでも GCP 側でクライアント削除・種別違いがあると Google が 401 invalid_client を返す
        toast.message("Google 認証へ移動します", {
          description: `リダイレクトURI（GCPに登録必須）: ${data.redirectUri}`,
          duration: 4000,
        });
        window.location.href = "/api/gmail/auth";
      } catch {
        toast.error("OAuth設定の確認に失敗しました");
        setLoading(false);
      }
      return;
    }
    if (p === "imap") {
      setStep("imap_form");
      return;
    }
    if (p === "forward") {
      handleSetupForward();
    }
  };

  const handleXserverPreset = () => {
    setImapHost("sv%%.xserver.jp");
    setImapPort("993");
    setSmtpHost("sv%%.xserver.jp");
    setSmtpPort("465");
    if (emailAddress) {
      setImapUser((prev) => prev || emailAddress);
      setSmtpUser((prev) => prev || emailAddress);
    }
    toast.info("sv%% のサーバー番号を実際の番号に変更してください");
  };

  const handleSetupForward = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mail/forward-setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForwardAddress(data.forward_address);
      setStep("forward_done");
    } catch (e) {
      toast.error((e as Error).message ?? "セットアップに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyForward = () => {
    void navigator.clipboard.writeText(forwardAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImapConnect = async () => {
    if (!emailAddress || !imapHost || !imapUser || !imapPass) {
      toast.error("メールアドレス・IMAPホスト・ユーザー名・パスワードは必須です");
      return;
    }
    if (imapHost.includes("%%") || smtpHost.includes("%%")) {
      toast.error("ホスト名の sv%% を実際のサーバー番号に変更してください");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/imap/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email_address: emailAddress,
          display_name: displayName || undefined,
          imap_host: imapHost,
          imap_port: Number(imapPort),
          imap_username: imapUser || emailAddress,
          imap_password: imapPass,
          smtp_host: smtpHost || undefined,
          smtp_port: smtpPort ? Number(smtpPort) : undefined,
          smtp_username: smtpUser || emailAddress,
          smtp_password: smtpPass || imapPass,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.sync_error) {
        toast.success("IMAPアカウントを連携しました", {
          description: `スレッド同期は未完了です: ${data.sync_error}`,
        });
      } else {
        toast.success("IMAPアカウントを連携しました", {
          description: `${data.synced ?? 0} 件のスレッドを同期しました（受信トレイ ${data.total ?? 0} 件）`,
        });
      }
      handleClose(false);
      onConnected();
    } catch (e) {
      toast.error((e as Error).message ?? "接続に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step !== "select_provider" && (
              <button
                onClick={() => setStep("select_provider")}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            メールサービスを連携
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 min-h-0">

        {/* STEP 1: プロバイダ選択 */}
        {step === "select_provider" && (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">利用するメールサービスを選択してください。</p>

            <button
              onClick={() => handleSelectProvider("gmail")}
              className="w-full flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-accent/50 transition-colors"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white border border-gray-200 shrink-0">
                <svg viewBox="0 0 48 48" className="h-5 w-5">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">Gmail</div>
                <div className="text-xs text-muted-foreground">Google OAuth で安全に連携</div>
              </div>
              <Badge variant="secondary" className="text-xs">OAuth</Badge>
            </button>
            {gmailRedirectUri && (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground space-y-1">
                <p>Google Cloud Console の「承認済みのリダイレクト URI」に次を登録してください。</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all font-mono text-[10px] text-foreground">{gmailRedirectUri}</code>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={() => {
                      void navigator.clipboard.writeText(gmailRedirectUri);
                      toast.success("リダイレクトURIをコピーしました");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}

            <button
              onClick={() => handleSelectProvider("imap")}
              className="w-full flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-accent/50 transition-colors"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white border border-gray-200 shrink-0 overflow-hidden">
                <img
                  src="https://www.xserver.ne.jp/favicon.ico"
                  alt="Xserver"
                  className="h-5 w-5 object-contain"
                />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">Xserver / その他</div>
                <div className="text-xs text-muted-foreground">IMAP/SMTP で接続</div>
              </div>
              <Badge variant="secondary" className="text-xs">IMAP</Badge>
            </button>
          </div>
        )}

        {/* STEP 2: IMAP フォーム */}
        {step === "imap_form" && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-800 space-y-1.5">
              <p className="font-semibold">📋 Xserver の場合</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-700">
                <li>「Xserver プリセット適用」を押す</li>
                <li>ホスト名の <code className="bg-blue-100 px-1 rounded">sv%%</code> を実際のサーバー番号に変更<br/>
                  <span className="text-[11px]">（Xserver管理画面 → サーバー情報 で確認。例：<code className="bg-blue-100 px-1 rounded">sv12345.xserver.jp</code>）</span>
                </li>
                <li>メールアドレスとパスワードを入力<br/>
                  <span className="text-[11px]">※サーバーパスワードではなく、メールアカウントのパスワード</span>
                </li>
                <li>「接続して連携」を押す</li>
              </ol>
            </div>
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={handleXserverPreset} className="text-xs">
                Xserver プリセット適用
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">メールアドレス *</Label>
                <Input
                  value={emailAddress}
                  onChange={(e) => {
                    const v = e.target.value;
                    setEmailAddress(v);
                    setImapUser((prev) => (!prev || prev === emailAddress ? v : prev));
                    setSmtpUser((prev) => (!prev || prev === emailAddress ? v : prev));
                  }}
                  placeholder="you@example.com"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">表示名</Label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="山田 太郎"
                />
              </div>
            </div>

            <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
              受信 (IMAP)
            </div>
            <div className="grid grid-cols-[1fr_80px] gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">IMAPホスト *</Label>
                <Input
                  value={imapHost}
                  onChange={(e) => setImapHost(e.target.value)}
                  placeholder="imap.example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">ポート</Label>
                <Input
                  value={imapPort}
                  onChange={(e) => setImapPort(e.target.value)}
                  placeholder="993"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">ユーザー名 *</Label>
                <Input
                  value={imapUser}
                  onChange={(e) => setImapUser(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">パスワード *</Label>
                <Input
                  type="password"
                  value={imapPass}
                  onChange={(e) => setImapPass(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
              送信 (SMTP)
            </div>
            <div className="grid grid-cols-[1fr_80px] gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">SMTPホスト</Label>
                <Input
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">ポート</Label>
                <Input
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  placeholder="465"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">ユーザー名</Label>
                <Input
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">パスワード</Label>
                <Input
                  type="password"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                />
              </div>
            </div>

            <Button
              onClick={handleImapConnect}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />接続・同期中...</>
              ) : (
                "接続して連携"
              )}
            </Button>
          </div>
        )}

        {/* STEP 3: 手動フォワード完了 */}
        {step === "forward_done" && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 space-y-2">
              <p className="text-sm font-medium text-emerald-800">転送先アドレスを発行しました</p>
              <p className="text-xs text-emerald-700">
                以下のアドレスにメールを転送する設定をメールサービス側で行ってください。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted px-3 py-2 text-xs font-mono break-all">
                {forwardAddress}
              </code>
              <Button size="sm" variant="outline" onClick={handleCopyForward}>
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              メールサービスの「転送設定」でこのアドレスを宛先に指定してください。
              共有メール (info@ 等) にも同様の設定を行えます。
            </p>
            <Button
              className="w-full"
              onClick={() => {
                handleClose(false);
                onConnected();
              }}
            >
              完了
            </Button>
          </div>
        )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
