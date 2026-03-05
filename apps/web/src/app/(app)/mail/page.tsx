"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageHeader } from "@/components/shared/page-header";
import {
  Inbox,
  Send,
  FileEdit,
  Trash2,
  Plus,
  Reply,
  Forward,
  Archive,
  Search,
  Star,
  Paperclip,
  ArrowLeft,
} from "lucide-react";

interface Email {
  id: string;
  from: string;
  fromEmail: string;
  to: string;
  subject: string;
  preview: string;
  body: string;
  date: string;
  time: string;
  read: boolean;
  starred: boolean;
  hasAttachment: boolean;
  folder: string;
}

const FOLDERS = [
  { id: "inbox",  label: "受信トレイ", icon: Inbox,    count: 5 },
  { id: "sent",   label: "送信済み",   icon: Send,     count: 0 },
  { id: "drafts", label: "下書き",     icon: FileEdit, count: 0 },
  { id: "trash",  label: "ゴミ箱",     icon: Trash2,   count: 0 },
];

const MOCK_EMAILS: Email[] = [
  {
    id: "1",
    from: "田中太郎",
    fromEmail: "tanaka@yamada-kensetsu.co.jp",
    to: "bridge-user@example.co.jp",
    subject: "【重要】山田邸リノベーション工事の進捗報告",
    preview: "お疲れ様です。山田邸の工事進捗についてご報告いたします。",
    body: `お疲れ様です。田中です。\n\n山田邸リノベーション工事の進捗についてご報告いたします。\n\n現在の進捗状況：\n- 2階内装工事：85%完了\n- キッチン設備設置：完了\n- 電気配線工事：90%完了\n- 外壁塗装：70%完了\n\n来週中に内装工事を完了させ、最終検査に入る予定です。\n施主様との打ち合わせを来週木曜日に設定しております。\n\nご確認のほどよろしくお願いいたします。\n\n田中太郎`,
    date: "2026-03-05", time: "10:30", read: false, starred: true, hasAttachment: true, folder: "inbox",
  },
  {
    id: "2",
    from: "鈴木花子",
    fromEmail: "suzuki@bridge-corp.co.jp",
    to: "bridge-user@example.co.jp",
    subject: "契約書の確認依頼",
    preview: "お世話になっております。添付の契約書をご確認ください。",
    body: `お世話になっております。鈴木です。\n\n田中ビル外壁工事の契約書を作成いたしました。\n添付ファイルをご確認いただき、修正点がございましたらご連絡ください。\n\n契約金額：3,200万円（税別）\n工期：2026年4月1日〜2026年7月31日\n支払条件：着手金30%、中間金40%、完了金30%\n\nなお、契約締結期限は3月15日となっておりますので、\nお早めにご確認いただけますと幸いです。\n\nよろしくお願いいたします。\n\n鈴木花子`,
    date: "2026-03-05", time: "09:15", read: false, starred: false, hasAttachment: true, folder: "inbox",
  },
  {
    id: "3",
    from: "佐藤一郎",
    fromEmail: "sato@material-supply.co.jp",
    to: "bridge-user@example.co.jp",
    subject: "資材の見積もり送付",
    preview: "いつもお世話になっております。ご依頼の資材見積もりを送付いたします。",
    body: `いつもお世話になっております。\nマテリアルサプライの佐藤です。\n\nご依頼いただいておりました資材の見積もりを送付いたします。\n\n主要資材：\n- 構造用合板 t=12mm：単価 ¥2,800/枚 x 200枚 = ¥560,000\n- 断熱材 グラスウール：単価 ¥1,500/本 x 150本 = ¥225,000\n- フローリング材 オーク：単価 ¥4,200/m2 x 80m2 = ¥336,000\n- 配管材一式：¥180,000\n\n合計：¥1,301,000（税別）\n\n有効期限は3月末日までとなります。\nご検討のほどよろしくお願いいたします。\n\n佐藤一郎`,
    date: "2026-03-04", time: "16:45", read: true, starred: false, hasAttachment: true, folder: "inbox",
  },
  {
    id: "4",
    from: "高橋誠",
    fromEmail: "takahashi@takahashi-corp.co.jp",
    to: "bridge-user@example.co.jp",
    subject: "倉庫建設の件 - 打ち合わせ日程調整",
    preview: "先日はお時間をいただきありがとうございました。次回の打ち合わせについて...",
    body: `お世話になっております。高橋商事の高橋です。\n\n先日はお忙しい中お時間をいただきありがとうございました。\n倉庫建設の件について、社内で検討した結果、前向きに進めたいと考えております。\n\n次回の打ち合わせについて、以下の日程でご都合はいかがでしょうか。\n\n候補日：\n1. 3月12日（木）14:00〜\n2. 3月13日（金）10:00〜\n3. 3月16日（月）13:00〜\n\n設計図の初回案もご用意いただけると助かります。\nご確認のほどよろしくお願いいたします。\n\n高橋誠`,
    date: "2026-03-04", time: "11:20", read: true, starred: true, hasAttachment: false, folder: "inbox",
  },
  {
    id: "5",
    from: "山本裕子",
    fromEmail: "yamamoto@bridge-corp.co.jp",
    to: "bridge-user@example.co.jp",
    subject: "【社内】安全衛生委員会の議事録",
    preview: "お疲れ様です。先日の安全衛生委員会の議事録を共有いたします。",
    body: `お疲れ様です。山本です。\n\n先日開催された安全衛生委員会の議事録を共有いたします。\n\n議題：\n1. 先月の安全パトロール結果報告\n2. ヒヤリハット事例の共有\n3. 来月の安全対策計画\n4. 熱中症対策について\n\n決定事項：\n- 全現場で朝礼時のKY活動を徹底する\n- 新規入場者教育の資料を更新する\n- 安全装備の点検を月1回実施する\n\n詳細は添付の議事録をご確認ください。\n\n山本裕子`,
    date: "2026-03-03", time: "14:00", read: true, starred: false, hasAttachment: true, folder: "inbox",
  },
  {
    id: "6",
    from: "中村健太",
    fromEmail: "nakamura@bridge-corp.co.jp",
    to: "bridge-user@example.co.jp",
    subject: "来月の工事スケジュールについて",
    preview: "お疲れ様です。来月の工事スケジュールを取りまとめましたので...",
    body: `お疲れ様です。中村です。\n\n来月の工事スケジュールを取りまとめましたのでご確認ください。\n\n4月の予定工事：\n- 山田邸リノベーション（最終検査・引き渡し）\n- 田中ビル外壁塗装（着工）\n- 佐藤邸新築（基礎工事継続）\n- 高橋倉庫（設計打ち合わせ）\n\n人員配置についても調整が必要ですので、\n来週の定例会議で相談させてください。\n\nよろしくお願いいたします。\n\n中村健太`,
    date: "2026-03-03", time: "09:30", read: false, starred: false, hasAttachment: false, folder: "inbox",
  },
  {
    id: "7",
    from: "渡辺美咲",
    fromEmail: "watanabe@design-office.co.jp",
    to: "bridge-user@example.co.jp",
    subject: "設計図面の修正版送付",
    preview: "お世話になっております。ご指摘いただいた箇所を修正した設計図面を...",
    body: `お世話になっております。渡辺設計事務所の渡辺です。\n\nご指摘いただいた箇所を修正した設計図面をお送りいたします。\n\n修正内容：\n- 1階リビングの窓サイズを変更（W1800→W2400）\n- キッチンカウンターの高さを850mmに変更\n- 2階バルコニーの手摺デザインを変更\n- 駐車場の配置を見直し\n\n修正箇所にはマーキングしておりますので、ご確認いただけますと幸いです。\n\n追加の修正がございましたらお知らせください。\n\n渡辺美咲`,
    date: "2026-03-02", time: "17:15", read: true, starred: false, hasAttachment: true, folder: "inbox",
  },
  {
    id: "8",
    from: "伊藤大輔",
    fromEmail: "ito@city-gov.lg.jp",
    to: "bridge-user@example.co.jp",
    subject: "建築確認申請の審査結果について",
    preview: "建築確認申請（第2026-0312号）の審査結果についてお知らせいたします。",
    body: `お世話になっております。市役所建築指導課の伊藤です。\n\n建築確認申請（第2026-0312号）の審査結果についてお知らせいたします。\n\n申請物件：佐藤邸新築工事\n所在地：東京都世田谷区○○町1-2-3\n\n審査の結果、建築基準法に適合していることを確認しましたので、確認済証を交付いたします。\n\n確認済証の受け取りについては、窓口までお越しください。\n受付時間：平日 9:00〜17:00\n\nご不明な点がございましたらお問い合わせください。\n\n建築指導課 伊藤大輔`,
    date: "2026-03-01", time: "10:00", read: false, starred: true, hasAttachment: false, folder: "inbox",
  },
  {
    id: "9",
    from: "小林真一",
    fromEmail: "kobayashi@subcon.co.jp",
    to: "bridge-user@example.co.jp",
    subject: "配管工事の日程変更のお願い",
    preview: "誠に申し訳ございませんが、資材の入荷遅れにより...",
    body: `お世話になっております。小林設備の小林です。\n\n誠に申し訳ございませんが、資材の入荷遅れにより、\n田中ビルの配管工事の日程を変更させていただきたくお願い申し上げます。\n\n当初予定：3月10日〜3月14日\n変更希望：3月17日〜3月21日\n\n遅延理由：メーカーからの配管材の納品が1週間遅れる見込みのため\n\n工期全体への影響を最小限に抑えるよう努力いたしますので、\n何卒ご理解のほどよろしくお願いいたします。\n\n小林真一`,
    date: "2026-02-28", time: "15:40", read: true, starred: false, hasAttachment: false, folder: "inbox",
  },
];

function getInitials(name: string) {
  return name.charAt(0);
}

function formatDate(date: string, time: string) {
  if (date === "2026-03-05") return time;
  const [, m, d] = date.split("-");
  return `${m}/${d}`;
}

export default function MailPage() {
  const [activeFolder, setActiveFolder] = useState("inbox");
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>("1");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEmails = MOCK_EMAILS.filter(
    (e) =>
      e.folder === activeFolder &&
      (searchQuery === "" || e.subject.includes(searchQuery) || e.from.includes(searchQuery))
  );

  const selectedEmail = MOCK_EMAILS.find((e) => e.id === selectedEmailId);
  const unreadCount = MOCK_EMAILS.filter((e) => e.folder === "inbox" && !e.read).length;
  const showDetail = !!selectedEmail;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="メール" />

      <Card className="overflow-hidden">
        <div className="flex h-[calc(100vh-180px)] min-h-[520px]">

          {/* ── Folder sidebar ─────────────────────────────── */}
          <div className={`md:flex flex-col w-52 shrink-0 border-r border-white/30 bg-white/10 ${showDetail ? "hidden" : "hidden md:flex"}`}>
            {/* New mail button */}
            <div className="p-3 border-b border-white/20">
              <Link href="/mail/compose">
                <Button size="sm" className="w-full gap-2 justify-start">
                  <Plus className="h-3.5 w-3.5" />
                  新規メール
                </Button>
              </Link>
            </div>

            {/* Search */}
            <div className="px-3 pt-3 pb-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="検索..."
                  className="pl-8 h-8 text-xs bg-white/30 border-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Folder list */}
            <nav className="flex-1 px-2 py-1 space-y-0.5">
              {FOLDERS.map((folder) => {
                const Icon = folder.icon;
                const count = folder.id === "inbox" ? unreadCount : folder.count;
                const isActive = activeFolder === folder.id;
                return (
                  <button
                    key={folder.id}
                    onClick={() => { setActiveFolder(folder.id); setSelectedEmailId(null); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all duration-150 ${
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-white/40 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left">{folder.label}</span>
                    {count > 0 && (
                      <Badge className="bg-primary/15 text-primary hover:bg-primary/15 text-[10px] h-5 min-w-[20px] justify-center px-1.5 font-semibold">
                        {count}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* ── Email list ─────────────────────────────────── */}
          <div className={`flex-col border-r border-white/30 min-w-0 h-full ${showDetail ? "hidden" : "flex"} w-full`}>
            {/* List header */}
            <div className="px-4 py-3 border-b border-white/20 flex items-center justify-between">
              <span className="text-sm font-semibold">
                {FOLDERS.find((f) => f.id === activeFolder)?.label}
              </span>
              {unreadCount > 0 && activeFolder === "inbox" && (
                <span className="text-xs text-muted-foreground">{unreadCount}件未読</span>
              )}
            </div>

            <ScrollArea className="flex-1">
              {filteredEmails.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <p className="text-sm text-muted-foreground">メールはありません</p>
                </div>
              ) : (
                <div className="py-1">
                  {filteredEmails.map((email) => {
                    const isSelected = selectedEmailId === email.id;
                    return (
                      <button
                        key={email.id}
                        onClick={() => { setSelectedEmailId(email.id); }}
                        className={`w-full text-left px-3 py-3 mx-1 rounded-xl transition-all duration-150 group relative ${
                          isSelected ? "bg-primary/10" : "hover:bg-white/40"
                        }`}
                        style={{ width: "calc(100% - 8px)" }}
                      >
                        {/* Unread dot */}
                        {!email.read && (
                          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-primary" />
                        )}
                        <div className="flex items-start gap-2.5 pl-2">
                          {/* Avatar */}
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold mt-0.5 ${
                            isSelected ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                          }`}>
                            {getInitials(email.from)}
                          </div>
                          <div className="flex-1 min-w-0">
                            {/* Row 1: name + time */}
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span className={`text-xs truncate ${!email.read ? "font-bold text-foreground" : "font-medium text-foreground/80"}`}>
                                {email.from}
                              </span>
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                                {formatDate(email.date, email.time)}
                              </span>
                            </div>
                            {/* Row 2: subject */}
                            <p className={`text-xs truncate mb-0.5 ${!email.read ? "font-medium text-foreground" : "text-foreground/70"}`}>
                              {email.subject}
                            </p>
                            {/* Row 3: preview + icons */}
                            <div className="flex items-center gap-1.5">
                              <p className="text-[11px] text-muted-foreground truncate flex-1">
                                {email.preview}
                              </p>
                              <div className="flex items-center gap-1 shrink-0">
                                {email.starred && <Star className="h-2.5 w-2.5 text-yellow-500 fill-yellow-500" />}
                                {email.hasAttachment && <Paperclip className="h-2.5 w-2.5 text-muted-foreground" />}
                              </div>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* ── Email detail ───────────────────────────────── */}
          <div className={`flex-1 flex flex-col min-w-0 ${showDetail ? "flex" : "hidden md:flex"}`}>
            {selectedEmail ? (
              <>
                {/* Detail toolbar */}
                <div className="flex items-center gap-1 px-4 py-2.5 border-b border-white/20">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 mr-1"
                    onClick={() => setSelectedEmailId(null)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex-1" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs h-8 text-muted-foreground hover:text-foreground"
                    onClick={() => toast.success("返信画面を開きました")}
                  >
                    <Reply className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">返信</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs h-8 text-muted-foreground hover:text-foreground"
                    onClick={() => toast.success("転送画面を開きました")}
                  >
                    <Forward className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">転送</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs h-8 text-muted-foreground hover:text-foreground"
                    onClick={() => toast.success("アーカイブしました")}
                  >
                    <Archive className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">アーカイブ</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs h-8 text-destructive/70 hover:text-destructive"
                    onClick={() => toast.success("削除しました")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">削除</span>
                  </Button>
                </div>

                {/* Mail header */}
                <div className="px-6 py-4 border-b border-white/20 space-y-3">
                  <h2 className="text-base font-semibold leading-snug">{selectedEmail.subject}</h2>

                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-primary">{getInitials(selectedEmail.from)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{selectedEmail.from}</span>
                        <span className="text-xs text-muted-foreground truncate">&lt;{selectedEmail.fromEmail}&gt;</span>
                      </div>
                      <p className="text-xs text-muted-foreground">To: {selectedEmail.to}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                      {selectedEmail.date.slice(5).replace("-", "/")} {selectedEmail.time}
                    </span>
                  </div>

                  {/* Attachment chip */}
                  {selectedEmail.hasAttachment && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/30 text-xs text-muted-foreground">
                      <Paperclip className="h-3 w-3" />
                      添付ファイルあり
                    </div>
                  )}
                </div>

                {/* Body */}
                <ScrollArea className="flex-1">
                  <div className="px-6 py-5">
                    <p className="text-sm whitespace-pre-wrap leading-7 text-foreground/90">
                      {selectedEmail.body}
                    </p>
                  </div>
                </ScrollArea>
              </>
            ) : null}
          </div>

        </div>
      </Card>
    </div>
  );
}
