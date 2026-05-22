"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  createApiKey,
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  getApiKeys,
  getWebhookEndpoints,
  getWebhookLogs,
  revokeApiKey,
} from "@/lib/actions/integrations";

export function IntegrationsTab() {
  const [apiKeys, setApiKeys] = useState<Awaited<ReturnType<typeof getApiKeys>>>([]);
  const [webhooks, setWebhooks] = useState<Awaited<ReturnType<typeof getWebhookEndpoints>>>([]);
  const [logs, setLogs] = useState<Awaited<ReturnType<typeof getWebhookLogs>>>([]);
  const [keyName, setKeyName] = useState("");
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEvents, setWebhookEvents] = useState("customer.created,deal.updated");
  const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    const [keys, endpoints, webhookLogs] = await Promise.all([
      getApiKeys(),
      getWebhookEndpoints(),
      getWebhookLogs(),
    ]);
    setApiKeys(keys);
    setWebhooks(endpoints);
    setLogs(webhookLogs);
  };

  useEffect(() => {
    reload().catch(() => toast.error("外部連携設定の取得に失敗しました")).finally(() => setLoading(false));
  }, []);

  const handleCreateKey = async () => {
    if (!keyName.trim()) return;
    try {
      const created = await createApiKey(keyName.trim());
      setNewRawKey(created.rawKey);
      setKeyName("");
      await reload();
      toast.success("API キーを発行しました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "発行に失敗しました");
    }
  };

  const handleCreateWebhook = async () => {
    if (!webhookUrl.trim()) return;
    try {
      const created = await createWebhookEndpoint({
        url: webhookUrl.trim(),
        events: webhookEvents.split(",").map((e) => e.trim()).filter(Boolean),
      });
      setNewWebhookSecret(created.secret);
      setWebhookUrl("");
      await reload();
      toast.success("Webhook エンドポイントを登録しました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "登録に失敗しました");
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">読み込み中...</p>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">開発者向け REST API</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            カスタム連携・kintone 等の開発向け設定です。Chatwork / Slack の通知連携は「アプリ連携」タブをご利用ください。
          </p>
          <p className="text-sm text-muted-foreground">
            Bearer トークンで <code>/api/v1/customers</code> などのエンドポイントにアクセスできます。
          </p>
          <div className="flex gap-2">
            <Input value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="キー名（例: kintone連携）" />
            <Button onClick={handleCreateKey}>キーを発行</Button>
          </div>
          {newRawKey && (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <p className="font-medium mb-1">発行された API キー（再表示不可）</p>
              <code className="break-all">{newRawKey}</code>
            </div>
          )}
          <div className="space-y-2">
            {apiKeys.map((key) => (
              <div key={key.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">{key.name}</p>
                  <p className="text-xs text-muted-foreground">{key.key_prefix}… ・ {key.scopes.join(", ")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={key.is_active ? "default" : "secondary"}>{key.is_active ? "有効" : "無効"}</Badge>
                  {key.is_active && (
                    <Button size="sm" variant="outline" onClick={async () => { await revokeApiKey(key.id); await reload(); }}>
                      無効化
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Webhook（アウトバウンド通知）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            <div className="space-y-2">
              <Label>通知先 URL</Label>
              <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://example.com/webhook" />
            </div>
            <div className="space-y-2">
              <Label>イベント（カンマ区切り）</Label>
              <Input value={webhookEvents} onChange={(e) => setWebhookEvents(e.target.value)} />
            </div>
            <Button className="w-fit" onClick={handleCreateWebhook}>Webhook を登録</Button>
          </div>
          {newWebhookSecret && (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <p className="font-medium mb-1">署名検証用シークレット</p>
              <code className="break-all">{newWebhookSecret}</code>
            </div>
          )}
          <div className="space-y-2">
            {webhooks.map((hook) => (
              <div key={hook.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium break-all">{hook.url}</p>
                  <p className="text-xs text-muted-foreground">{(hook.events ?? []).join(", ") || "全イベント"}</p>
                </div>
                <Button size="sm" variant="outline" onClick={async () => { await deleteWebhookEndpoint(hook.id); await reload(); }}>
                  削除
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Webhook 配信ログ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">配信履歴はまだありません</p>
          ) : logs.map((log) => (
            <div key={log.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <div>
                <p className="font-medium">{log.event}</p>
                <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString("ja-JP")}</p>
              </div>
              <Badge variant={log.success ? "default" : "destructive"}>
                {log.success ? "成功" : "失敗"} {log.response_status ?? ""}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
