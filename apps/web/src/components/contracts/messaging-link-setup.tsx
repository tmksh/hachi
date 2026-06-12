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
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Link2,
  Loader2,
  Save,
  UserRound,
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

function StatusBadge({ linked, label }: { linked: boolean; label?: string }) {
  return linked ? (
    <Badge variant="secondary" className="gap-1 text-[10px] h-5 bg-emerald-50 text-emerald-700 border-emerald-200">
      <CheckCircle2 className="h-3 w-3" />
      {label ?? "連携済み"}
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
  const companyReady = context.company.slackConnected
    && context.company.lineWorksConnected
    && context.company.emailConnected;
  const customerReady = context.readiness.email === "linked"
    && context.readiness.line === "linked"
    && context.readiness.slack === "linked";
  const linkedCount = [
    context.readiness.email === "linked",
    context.readiness.line === "linked",
    context.readiness.slack === "linked",
  ].filter(Boolean).length;

  const refreshContext = (patch: Partial<{
    email: string | null;
    line_user_id: string | null;
    slack_channel_id: string | null;
  }>) => {
    if (!context.customer) return;
    const nextCustomer = {
      ...context.customer,
      email: patch.email !== undefined ? patch.email : context.customer.email,
      line_user_id: patch.line_user_id !== undefined ? patch.line_user_id : context.customer.line_user_id,
      slack_channel_id: patch.slack_channel_id !== undefined ? patch.slack_channel_id : context.customer.slack_channel_id,
    };
    onUpdated({
      ...context,
      customer: nextCustomer,
      readiness: {
        line: !context.company.lineWorksConnected
          ? "needs_company_line"
          : nextCustomer.line_user_id?.trim()
            ? "linked"
            : "needs_customer_line_id",
        slack: !context.company.slackConnected
          ? "needs_company_slack"
          : nextCustomer.slack_channel_id?.trim()
            ? "linked"
            : "needs_customer_channel",
        email: !context.company.emailConnected
          ? "needs_mail_connect"
          : nextCustomer.email?.trim()
            ? "linked"
            : "needs_customer_email",
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
      toast.success("顧客の連携先を保存しました");
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
          顧客が紐づいていないため、やり取りを表示できません。「顧客情報」タブから顧客を登録してください。
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-border/60", customerReady && "border-emerald-200/80 bg-emerald-50/30")}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-sm flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              メッセージ連携
            </CardTitle>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="font-medium text-foreground">LINE / Slack / メールの接続は会社単位</strong>
              （設定 → アプリ連携・メール）で行います。
              ここではこの顧客の連携先 ID のみ登録します。
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
          {/* 会社連携（テナント共通） */}
          <div className="rounded-lg border border-primary/15 bg-primary/5 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">会社連携（全契約・全顧客で共通）</p>
                <p className="text-[11px] text-muted-foreground">
                  管理者が一度設定すれば、すべての契約のやり取り取得で利用されます
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="rounded-md border border-border/50 bg-background px-3 py-2.5 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium flex items-center gap-1.5">
                    <linePlatform.Icon className="h-3.5 w-3.5" />
                    LINE WORKS
                  </span>
                  <StatusBadge linked={context.company.lineWorksConnected} label="接続済" />
                </div>
                {!context.company.lineWorksConnected && (
                  <Button size="sm" variant="outline" className="h-7 w-full text-[11px] gap-1" asChild>
                    <Link href="/settings?tab=integrations_group">
                      設定で接続
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </Button>
                )}
              </div>
              <div className="rounded-md border border-border/50 bg-background px-3 py-2.5 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium flex items-center gap-1.5">
                    <slackPlatform.Icon className="h-3.5 w-3.5" />
                    Slack
                  </span>
                  <StatusBadge linked={context.company.slackConnected} label="接続済" />
                </div>
                {!context.company.slackConnected && (
                  <Button size="sm" variant="outline" className="h-7 w-full text-[11px] gap-1" asChild>
                    <Link href="/settings?tab=integrations_group">
                      設定で接続
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </Button>
                )}
              </div>
              <div className="rounded-md border border-border/50 bg-background px-3 py-2.5 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium flex items-center gap-1.5">
                    <emailPlatform.Icon className="h-3.5 w-3.5" />
                    メール
                  </span>
                  <StatusBadge linked={context.company.emailConnected} label="接続済" />
                </div>
                {context.company.emailConnected ? (
                  <p className="text-[10px] text-muted-foreground truncate">{context.company.emailAddress ?? "—"}</p>
                ) : (
                  <Button size="sm" variant="outline" className="h-7 w-full text-[11px] gap-1" asChild>
                    <Link href="/mail">
                      メールで接続
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </Button>
                )}
              </div>
            </div>
            {!companyReady && (
              <p className="text-[11px] text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30 rounded-md px-2.5 py-2">
                会社連携が未完了です。設定画面で接続してから、下の顧客連携先を登録してください。
              </p>
            )}
          </div>

          {/* 顧客連携先 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <UserRound className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium">顧客の連携先（{context.customer?.name}）</p>
                <p className="text-[11px] text-muted-foreground">
                  顧客マスタに保存され、CRM・他の契約でも共通利用されます
                </p>
              </div>
            </div>

            {/* メール */}
            <div className="rounded-lg border border-border/50 bg-background p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">メールアドレス</p>
                <StatusBadge linked={context.readiness.email === "linked"} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
                <div className="space-y-1.5">
                  <Label className="text-xs">顧客メール</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="customer@example.com"
                    className="h-9"
                    disabled={!context.company.emailConnected}
                  />
                </div>
                <Button
                  size="sm"
                  className="h-9 gap-1.5"
                  disabled={saving === "email" || !context.company.emailConnected}
                  onClick={() => void saveField("email", { email })}
                >
                  {saving === "email" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  保存
                </Button>
              </div>
            </div>

            {/* LINE */}
            <div className="rounded-lg border border-border/50 bg-background p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">LINE ユーザー ID</p>
                <StatusBadge linked={context.readiness.line === "linked"} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
                <div className="space-y-1.5">
                  <Label className="text-xs">ユーザー ID</Label>
                  <Input
                    value={lineUserId}
                    onChange={(e) => setLineUserId(e.target.value)}
                    placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="h-9 font-mono text-xs"
                    disabled={!context.company.lineWorksConnected}
                  />
                </div>
                <Button
                  size="sm"
                  className="h-9 gap-1.5"
                  disabled={saving === "line" || !context.company.lineWorksConnected}
                  onClick={() => void saveField("line", { line_user_id: lineUserId })}
                >
                  {saving === "line" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  保存
                </Button>
              </div>
            </div>

            {/* Slack */}
            <div className="rounded-lg border border-border/50 bg-background p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Slack チャンネル ID</p>
                <StatusBadge linked={context.readiness.slack === "linked"} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
                <div className="space-y-1.5">
                  <Label className="text-xs">チャンネル ID</Label>
                  <Input
                    value={slackChannelId}
                    onChange={(e) => setSlackChannelId(e.target.value)}
                    placeholder="C0123456789"
                    className="h-9 font-mono text-xs"
                    disabled={!context.company.slackConnected}
                  />
                </div>
                <Button
                  size="sm"
                  className="h-9 gap-1.5"
                  disabled={saving === "slack" || !context.company.slackConnected}
                  onClick={() => void saveField("slack", { slack_channel_id: slackChannelId })}
                >
                  {saving === "slack" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  保存
                </Button>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              顧客の連携先は
              <Link href={`/crm/${customerId}?tab=entry`} className="text-primary hover:underline mx-1">
                CRM 記入画面
              </Link>
              からも編集できます。
            </p>
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
