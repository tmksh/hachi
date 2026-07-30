"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IntegrationBrandIcon } from "@/components/settings/integration-brand-icon";
import {
  connectAppIntegration,
  disconnectAppIntegration,
  getAppIntegrations,
  getProviderDefinitionsForClient,
  listChatworkRooms,
  testAppIntegration,
  updateAppIntegrationEvents,
} from "@/lib/actions/app-integrations";
import type { ProviderDefinition } from "@/lib/app-integrations/providers/registry";
import {
  DEFAULT_INTEGRATION_EVENTS,
  INTEGRATION_EVENT_OPTIONS,
  type AppIntegrationProvider,
  type AppIntegrationPublic,
  type ChatworkRoom,
} from "@/lib/app-integrations/types";
import { ExternalLink, Loader2 } from "lucide-react";

type ConnectProvider = AppIntegrationProvider | null;

type CatalogItem = Pick<
  ProviderDefinition,
  "provider" | "name" | "description" | "color" | "connectHint" | "fields" | "settingsFields"
>;

export type AppIntegrationsInitialData = {
  integrations: AppIntegrationPublic[];
  catalog: CatalogItem[];
};

export function AppIntegrationsTab({ initialData }: { initialData?: AppIntegrationsInitialData }) {
  const [catalog, setCatalog] = useState<CatalogItem[]>(initialData?.catalog ?? []);
  const [integrations, setIntegrations] = useState<AppIntegrationPublic[]>(
    initialData?.integrations ?? [],
  );
  const [loading, setLoading] = useState(!initialData);
  const [connectProvider, setConnectProvider] = useState<ConnectProvider>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [chatworkRooms, setChatworkRooms] = useState<ChatworkRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([...DEFAULT_INTEGRATION_EVENTS]);

  const integrationMap = useMemo(
    () => new Map(integrations.map((item) => [item.provider, item])),
    [integrations]
  );

  const activeDefinition = useMemo(
    () => catalog.find((item) => item.provider === connectProvider) ?? null,
    [catalog, connectProvider]
  );

  const reload = async () => {
    const [items, definitions] = await Promise.all([
      getAppIntegrations(),
      getProviderDefinitionsForClient(),
    ]);
    setIntegrations(items);
    setCatalog(definitions);
  };

  useEffect(() => {
    if (initialData) return;
    reload()
      .catch(() => toast.error("アプリ連携の取得に失敗しました"))
      .finally(() => setLoading(false));
  }, [initialData]);

  const openConnect = (provider: AppIntegrationProvider) => {
    const existing = integrationMap.get(provider);
    const definition = catalog.find((item) => item.provider === provider);
    setConnectProvider(provider);
    setSelectedEvents(existing?.events ?? [...DEFAULT_INTEGRATION_EVENTS]);
    setCredentials({});
    setSettings(
      existing?.settings ??
        Object.fromEntries((definition?.settingsFields ?? []).map((field) => [field.key, field.placeholder ?? ""]))
    );
    setChatworkRooms([]);
  };

  const closeConnect = () => {
    setConnectProvider(null);
    setSaving(false);
    setLoadingRooms(false);
  };

  const setCredential = (key: string, value: string) => {
    setCredentials((prev) => ({ ...prev, [key]: value }));
  };

  const setSetting = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const toggleEvent = (value: string, checked: boolean) => {
    setSelectedEvents((prev) => {
      if (checked) return prev.includes(value) ? prev : [...prev, value];
      return prev.filter((item) => item !== value);
    });
  };

  const handleLoadChatworkRooms = async () => {
    setLoadingRooms(true);
    try {
      const rooms = await listChatworkRooms(credentials.api_token ?? "");
      setChatworkRooms(rooms);
      if (!rooms.length) {
        toast.error("参加している Chatwork ルームが見つかりません");
      } else {
        toast.success(`${rooms.length} 件のルームを取得しました`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ルーム取得に失敗しました");
    } finally {
      setLoadingRooms(false);
    }
  };

  const canSubmitConnect = () => {
    if (!connectProvider || !activeDefinition || !selectedEvents.length) return false;
    if (integrationMap.get(connectProvider)) return true;

    for (const field of activeDefinition.fields) {
      if (!credentials[field.key]?.trim()) return false;
    }

    if (connectProvider === "chatwork") {
      if (!settings.room_id) return false;
    }

    return true;
  };

  const handleConnect = async () => {
    if (!connectProvider || !activeDefinition) return;
    if (!selectedEvents.length) {
      toast.error("通知イベントを1つ以上選択してください");
      return;
    }

    setSaving(true);
    try {
      if (connectProvider === "chatwork") {
        const room = chatworkRooms.find((item) => String(item.room_id) === settings.room_id);
        if (!room) {
          toast.error("通知ルームを選択してください");
          return;
        }
        await connectAppIntegration({
          provider: "chatwork",
          credentials,
          settings: { ...settings, room_name: room.name },
          events: selectedEvents,
        });
      } else {
        await connectAppIntegration({
          provider: connectProvider,
          credentials,
          settings,
          events: selectedEvents,
        });
      }
      await reload();
      closeConnect();
      toast.success("連携が完了しました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "連携に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async (provider: AppIntegrationProvider) => {
    if (!confirm("連携を解除しますか？")) return;
    try {
      await disconnectAppIntegration(provider);
      await reload();
      toast.success("連携を解除しました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "解除に失敗しました");
    }
  };

  const handleTest = async (provider: AppIntegrationProvider) => {
    setTesting(provider);
    try {
      const result = await testAppIntegration(provider);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("テスト通知を送信しました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "テスト送信に失敗しました");
    } finally {
      setTesting(null);
    }
  };

  const handleSaveEvents = async (provider: AppIntegrationProvider) => {
    try {
      await updateAppIntegrationEvents(provider, selectedEvents);
      await reload();
      toast.success("通知設定を更新しました");
      closeConnect();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "更新に失敗しました");
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">読み込み中...</p>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">アプリ連携</CardTitle>
          <CardDescription>
            使っているツールを選んで連携するだけ。顧客・商談の更新を自動通知できます。
            カスタム開発向けの REST API / Webhook は「API/Webhook」タブをご利用ください。
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {catalog.map((item) => {
          const connected = integrationMap.get(item.provider);
          return (
            <Card key={item.provider} className="relative gap-2 py-3">
              {!connected ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-3 top-2.5 z-10 h-6 shrink-0 px-2 text-[11px] text-primary hover:text-primary"
                  onClick={() => openConnect(item.provider)}
                >
                  連携する
                </Button>
              ) : (
                <Badge className="absolute right-3 top-2.5 z-10 shrink-0 px-1.5 py-0 text-[10px]" variant="default">
                  連携中
                </Badge>
              )}
              <CardHeader className="min-h-0 border-b-0 px-4 pb-0 pt-0">
                <div className="flex items-center gap-2.5 pr-14">
                  <IntegrationBrandIcon provider={item.provider} />
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-sm font-semibold">{item.name}</CardTitle>
                    <CardDescription className="mt-0.5 line-clamp-1 text-xs">
                      {item.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              {connected && (
              <CardContent className="space-y-2 px-4 py-0">
                    {(connected.summary || connected.credential_hint) && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {[connected.summary, connected.credential_hint && `認証: ${connected.credential_hint}`]
                          .filter(Boolean)
                          .join(" ・ ")}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        disabled={testing === item.provider}
                        onClick={() => handleTest(item.provider)}
                      >
                        {testing === item.provider ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          "テスト"
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => openConnect(item.provider)}
                      >
                        設定
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleDisconnect(item.provider)}
                      >
                        解除
                      </Button>
                    </div>
              </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <Dialog open={connectProvider !== null} onOpenChange={(open) => !open && closeConnect()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {activeDefinition && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <IntegrationBrandIcon provider={activeDefinition.provider} />
                  <div>
                    <DialogTitle>{activeDefinition.name} と連携</DialogTitle>
                    <DialogDescription>{activeDefinition.connectHint}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                {activeDefinition.fields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={`${activeDefinition.provider}-${field.key}`}>{field.label}</Label>
                    <Input
                      id={`${activeDefinition.provider}-${field.key}`}
                      type={field.type === "password" ? "password" : "text"}
                      value={credentials[field.key] ?? ""}
                      onChange={(e) => setCredential(field.key, e.target.value)}
                      placeholder={field.placeholder}
                    />
                    {field.helpText && (
                      <p className="text-xs text-muted-foreground">{field.helpText}</p>
                    )}
                    {field.helpUrl && (
                      <a
                        href={field.helpUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        設定画面を開く
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ))}

                {activeDefinition.provider === "chatwork" && (
                  <div className="space-y-3">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!credentials.api_token?.trim() || loadingRooms}
                      onClick={handleLoadChatworkRooms}
                    >
                      {loadingRooms ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                      ルームを読み込む
                    </Button>
                    {chatworkRooms.length > 0 && (
                      <div className="space-y-2">
                        <Label>通知ルーム</Label>
                        <Select value={settings.room_id ?? ""} onValueChange={(value) => setSetting("room_id", value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="ルームを選択" />
                          </SelectTrigger>
                          <SelectContent>
                            {chatworkRooms.map((room) => (
                              <SelectItem key={room.room_id} value={String(room.room_id)}>
                                {room.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}

                {(activeDefinition.settingsFields ?? []).map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={`${activeDefinition.provider}-setting-${field.key}`}>{field.label}</Label>
                    <Input
                      id={`${activeDefinition.provider}-setting-${field.key}`}
                      value={settings[field.key] ?? ""}
                      onChange={(e) => setSetting(field.key, e.target.value)}
                      placeholder={field.placeholder}
                    />
                    {field.helpText && (
                      <p className="text-xs text-muted-foreground">{field.helpText}</p>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <Label>通知するイベント</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {INTEGRATION_EVENT_OPTIONS.map((option) => (
                    <label key={option.value} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selectedEvents.includes(option.value)}
                        onCheckedChange={(checked) => toggleEvent(option.value, checked === true)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={closeConnect}>
                  キャンセル
                </Button>
                {integrationMap.get(activeDefinition.provider) ? (
                  <Button disabled={saving || !selectedEvents.length} onClick={() => handleSaveEvents(activeDefinition.provider)}>
                    設定を保存
                  </Button>
                ) : (
                  <Button disabled={saving || !canSubmitConnect()} onClick={handleConnect}>
                    {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                    連携を完了
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
