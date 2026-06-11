"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Link2,
  Loader2,
  Save,
} from "lucide-react";
import {
  updateCustomerMessagingLinks,
  type ContractMessagingContext,
} from "@/lib/actions/contract-features";
import { MESSAGING_PLATFORMS } from "@/components/shared/platform-icons";
import { cn } from "@/lib/utils";

type MessagingLinkSetupProps = {
  context: ContractMessagingContext;
  onUpdated: (context: ContractMessagingContext) => void;
  onLoadDemo?: () => void;
  loadingDemo?: boolean;
  defaultExpanded?: boolean;
};

function StatusBadge({ linked }: { linked: boolean }) {
  return linked ? (
    <Badge variant="secondary" className="gap-1 text-[10px] h-5 bg-emerald-50 text-emerald-700 border-emerald-200">
      <CheckCircle2 className="h-3 w-3" />
      連携済み
    </Badge>
  ) : (
    <Badge variant="outline" className="text-[10px] h-5 text-amber-700 border-amber-200 bg-amber-50">
      未設定
    </Badge>
  );
}

export function MessagingLinkSetup({
  context,
  onUpdated,
  onLoadDemo,
  loadingDemo,
  defaultExpanded = true,
}: MessagingLinkSetupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [saving, setSaving] = useState<string | null>(null);
  const [email, setEmail] = useState(context.customer?.email ?? "");
  const [lineUserId, setLineUserId] = useState(context.customer?.line_user_id ?? "");
  const [slackChannelId, setSlackChannelId] = useState(context.customer?.slack_channel_id ?? "");

  const customerId = context.customer?.id;
  const linkedCount = [
    context.readiness.email === "linked",
    context.readiness.line === "linked",
    context.readiness.slack === "linked",
  ].filter(Boolean).length;
  const allLinked = linkedCount === 3;

  const refreshContext = (patch: Partial<{
    email: string | null;
    line_user_id: string | null;
    slack_channel_id: string | null;
  }>) => {
    if (!context.customer) return;
    onUpdated({
      ...context,
      customer: {
        ...context.customer,
        email: patch.email !== undefined ? patch.email : context.customer.email,
        line_user_id: patch.line_user_id !== undefined ? patch.line_user_id : context.customer.line_user_id,
        slack_channel_id: patch.slack_channel_id !== undefined ? patch.slack_channel_id : context.customer.slack_channel_id,
      },
      readiness: {
        line: (patch.line_user_id ?? context.customer.line_user_id)?.trim()
          ? "linked"
          : "needs_customer_line_id",
        slack: (patch.slack_channel_id ?? context.customer.slack_channel_id)?.trim()
          ? "linked"
          : context.company.slackConnected
            ? "needs_customer_channel"
            : "needs_company_slack",
        email: (patch.email ?? context.customer.email)?.trim() && context.company.emailConnected
          ? "linked"
          : context.company.emailConnected
            ? "needs_customer_email"
            : "needs_mail_connect",
      },
    });
  };

  const saveField = async (
    field: "email" | "line" | "slack",
    payload: { email?: string | null; line_user_id?: string | null; slack_channel_id?: string | null },
  ) => {
    if (!customerId) {
      toast.error("顧客が紐づいていません");
      return;
    }
    setSaving(field);
    try {
      const data = await updateCustomerMessagingLinks(customerId, payload);
      refreshContext(data);
      toast.success("連携情報を保存しました");
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setSaving(null);
    }
  };

  const linePlatform = MESSAGING_PLATFORMS.find((p) => p.key === "line")!;
  const slackPlatform = MESSAGING_PLATFORMS.find((p) => p.key === "slack")!;
  const emailPlatform = MESSAGING_PLATFORMS.find((p) => p.key === "email")!;

  if (!customerId) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          顧客が紐づいていないため、メッセージ連携を設定できません。「顧客情報」タブから顧客を登録してください。
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-border/60", allLinked && "border-emerald-200/80 bg-emerald-50/30")}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-sm flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              メッセージ連携
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {context.customer?.name} さんとのやり取りを LINE / Slack / メール から取得するための設定です
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground tabular-nums">{linkedCount}/3</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? "折りたたむ" : "展開する"}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 pt-0">
          {/* メール */}
          <div className="rounded-lg border border-border/50 bg-background p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="size-8 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
                  <emailPlatform.Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">メール</p>
                  <p className="text-[11px] text-muted-foreground">
                    {context.company.emailConnected
                      ? `連携中: ${context.company.emailAddress ?? "—"}`
                      : "Gmail / IMAP を接続してください"}
                  </p>
                </div>
              </div>
              <StatusBadge linked={context.readiness.email === "linked"} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs">顧客メールアドレス</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="customer@example.com"
                  className="h-9"
                />
              </div>
              <Button
                size="sm"
                className="h-9 gap-1.5"
                disabled={saving === "email"}
                onClick={() => void saveField("email", { email })}
              >
                {saving === "email" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                保存
              </Button>
              {!context.company.emailConnected && (
                <Button size="sm" variant="outline" className="h-9 gap-1.5" asChild>
                  <Link href="/mail">
                    <ExternalLink className="h-3.5 w-3.5" />
                    メール連携
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {/* LINE */}
          <div className="rounded-lg border border-border/50 bg-background p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="size-8 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
                  <linePlatform.Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">LINE</p>
                  <p className="text-[11px] text-muted-foreground">
                    顧客の LINE ユーザー ID を登録すると、この契約のやり取りだけを表示できます
                  </p>
                </div>
              </div>
              <StatusBadge linked={context.readiness.line === "linked"} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs">LINE ユーザー ID</Label>
                <Input
                  value={lineUserId}
                  onChange={(e) => setLineUserId(e.target.value)}
                  placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="h-9 font-mono text-xs"
                />
              </div>
              <Button
                size="sm"
                className="h-9 gap-1.5"
                disabled={saving === "line"}
                onClick={() => void saveField("line", { line_user_id: lineUserId })}
              >
                {saving === "line" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                保存
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              LINE Developers の Webhook イベント、または管理画面の友だち一覧から ID を確認できます（自動取得は今後対応予定）
            </p>
          </div>

          {/* Slack */}
          <div className="rounded-lg border border-border/50 bg-background p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="size-8 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
                  <slackPlatform.Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Slack</p>
                  <p className="text-[11px] text-muted-foreground">
                    {context.company.slackConnected
                      ? "顧客用チャンネル ID を登録してください"
                      : "まず会社の Slack Webhook を設定してください"}
                  </p>
                </div>
              </div>
              <StatusBadge linked={context.readiness.slack === "linked"} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs">Slack チャンネル ID</Label>
                <Input
                  value={slackChannelId}
                  onChange={(e) => setSlackChannelId(e.target.value)}
                  placeholder="C0123456789"
                  className="h-9 font-mono text-xs"
                />
              </div>
              <Button
                size="sm"
                className="h-9 gap-1.5"
                disabled={saving === "slack"}
                onClick={() => void saveField("slack", { slack_channel_id: slackChannelId })}
              >
                {saving === "slack" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                保存
              </Button>
              {!context.company.slackConnected && (
                <Button size="sm" variant="outline" className="h-9 gap-1.5" asChild>
                  <Link href="/settings">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Slack 設定
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {onLoadDemo && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40">
              <p className="text-xs text-muted-foreground">
                連携前に UI を確認したい場合はサンプルデータを読み込めます
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-xs h-8"
                disabled={loadingDemo}
                onClick={onLoadDemo}
              >
                {loadingDemo ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                サンプルデータで試す
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
