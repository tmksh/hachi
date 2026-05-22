import type { AppIntegrationProvider } from "../types";

export type ProviderField = {
  key: string;
  label: string;
  type: "text" | "password" | "url";
  placeholder?: string;
  helpText?: string;
  helpUrl?: string;
};

export type ProviderDefinition = {
  provider: AppIntegrationProvider;
  name: string;
  description: string;
  color: string;
  connectHint: string;
  fields: ProviderField[];
  settingsFields?: ProviderField[];
};

export const PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  {
    provider: "chatwork",
    name: "Chatwork",
    description: "商談・顧客の更新を Chatwork ルームへ自動通知",
    color: "#E01E5A",
    connectHint: "API トークンを入力し、通知ルームを選択してください。",
    fields: [
      {
        key: "api_token",
        label: "API トークン",
        type: "password",
        placeholder: "API トークンを貼り付け",
        helpUrl: "https://www.chatwork.com/service/packages/chatwork/subpackages/api/token.php",
      },
    ],
  },
  {
    provider: "slack",
    name: "Slack",
    description: "Incoming Webhook で Slack チャンネルへ自動通知",
    color: "#4A154B",
    connectHint: "Slack の Incoming Webhook URL を貼り付けてください。",
    fields: [
      {
        key: "webhook_url",
        label: "Incoming Webhook URL",
        type: "url",
        placeholder: "https://hooks.slack.com/services/...",
        helpText: "Slack アプリ管理画面 → Incoming Webhooks から取得",
      },
    ],
  },
  {
    provider: "teams",
    name: "Microsoft Teams",
    description: "Teams チャンネルの Incoming Webhook へ自動通知",
    color: "#6264A7",
    connectHint: "Teams チャンネルの Incoming Webhook URL を貼り付けてください。",
    fields: [
      {
        key: "webhook_url",
        label: "Incoming Webhook URL",
        type: "url",
        placeholder: "https://....webhook.office.com/...",
        helpText: "Teams チャンネル → コネクタ → Incoming Webhook から取得",
      },
    ],
  },
  {
    provider: "google_chat",
    name: "Google Chat",
    description: "Google Chat スペースの Webhook へ自動通知",
    color: "#1A73E8",
    connectHint: "Google Chat スペースの Webhook URL を貼り付けてください。",
    fields: [
      {
        key: "webhook_url",
        label: "Webhook URL",
        type: "url",
        placeholder: "https://chat.googleapis.com/v1/spaces/...",
        helpText: "Google Chat スペース → アプリと統合 → Webhook から取得",
      },
    ],
  },
  {
    provider: "discord",
    name: "Discord",
    description: "Discord チャンネルの Webhook へ自動通知",
    color: "#5865F2",
    connectHint: "Discord チャンネル設定の Webhook URL を貼り付けてください。",
    fields: [
      {
        key: "webhook_url",
        label: "Webhook URL",
        type: "url",
        placeholder: "https://discord.com/api/webhooks/...",
        helpText: "Discord チャンネル設定 → 連携サービス → Webhook から取得",
      },
    ],
  },
  {
    provider: "line_notify",
    name: "LINE Notify",
    description: "LINE Notify で個人・グループへ自動通知",
    color: "#06C755",
    connectHint: "LINE Notify のアクセストークンを貼り付けてください。",
    fields: [
      {
        key: "access_token",
        label: "アクセストークン",
        type: "password",
        placeholder: "LINE Notify トークン",
        helpUrl: "https://notify-bot.line.me/my/",
      },
    ],
  },
  {
    provider: "line_works",
    name: "LINE WORKS",
    description: "LINE WORKS Bot でトークルームへ自動通知",
    color: "#00C300",
    connectHint: "Developer Console の Bot 情報と Service Account を入力してください。",
    fields: [
      {
        key: "client_id",
        label: "Client ID",
        type: "text",
        placeholder: "Service Account Client ID",
      },
      {
        key: "client_secret",
        label: "Client Secret",
        type: "password",
        placeholder: "Service Account Client Secret",
      },
      {
        key: "bot_id",
        label: "Bot ID",
        type: "text",
        placeholder: "Bot ID",
      },
      {
        key: "channel_id",
        label: "Channel ID",
        type: "text",
        placeholder: "通知先 Channel ID",
        helpUrl: "https://developers.worksmobile.com/jp/document/100500801",
      },
    ],
  },
  {
    provider: "kintone",
    name: "kintone",
    description: "BRIDGE の更新を kintone アプリへレコード登録",
    color: "#FFE600",
    connectHint: "kintone のサブドメイン・API トークン・アプリ ID を入力してください。",
    fields: [
      {
        key: "subdomain",
        label: "サブドメイン",
        type: "text",
        placeholder: "example（example.cybozu.com の example 部分）",
      },
      {
        key: "api_token",
        label: "API トークン",
        type: "password",
        placeholder: "kintone API トークン",
      },
      {
        key: "app_id",
        label: "アプリ ID",
        type: "text",
        placeholder: "123",
      },
    ],
    settingsFields: [
      {
        key: "title_field",
        label: "タイトルフィールドコード",
        type: "text",
        placeholder: "タイトル",
        helpText: "kintone アプリ側のフィールドコード（文字列1行）",
      },
      {
        key: "body_field",
        label: "本文フィールドコード",
        type: "text",
        placeholder: "本文",
        helpText: "kintone アプリ側のフィールドコード（文字列複数行）",
      },
      {
        key: "event_field",
        label: "イベントフィールドコード",
        type: "text",
        placeholder: "イベント",
        helpText: "kintone アプリ側のフィールドコード（文字列1行）",
      },
    ],
  },
];

export function getProviderDefinition(provider: AppIntegrationProvider): ProviderDefinition {
  const definition = PROVIDER_DEFINITIONS.find((item) => item.provider === provider);
  if (!definition) throw new Error(`Unknown provider: ${provider}`);
  return definition;
}
