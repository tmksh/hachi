/**
 * フェーズ1用のメールモックデータ。
 * 実データが無いとき（ビルダーが email_threads にレコードを持たないとき）の
 * プレビュー表示に利用する。フェーズ2で実IMAP連携が入ったら削除する。
 */

type MockMessage = {
  id: string;
  from_name: string | null;
  from_address: string | null;
  to_addresses: Array<{ name?: string; address: string }>;
  subject: string;
  body_text: string;
  received_at: string;
  direction: "inbound" | "outbound";
};

type MockThread = {
  id: string;
  subject: string;
  snippet: string;
  is_read: boolean;
  is_starred: boolean;
  last_message_at: string;
  participant_count: number;
  message_count: number;
};

type MockThreadDetail = MockThread & {
  messages: MockMessage[];
};

const daysAgo = (d: number, h = 9, m = 0) => {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  dt.setHours(h, m, 0, 0);
  return dt.toISOString();
};

export const MOCK_MAIL_THREADS: MockThread[] = [
  {
    id: "mock_1",
    subject: "【田中様邸】外壁タイル色の最終決定について",
    snippet:
      "お世話になっております、田中です。外壁タイルの件、家族で話し合った結果、添付のB案（ベージュ系）でお願いしたく…",
    is_read: false,
    is_starred: true,
    last_message_at: daysAgo(0, 10, 32),
    participant_count: 2,
    message_count: 3,
  },
  {
    id: "mock_2",
    subject: "Re: 佐藤邸 追加工事お見積の件",
    snippet:
      "金額ご確認いただきありがとうございます。追加項目のうち、造作棚のみ今回ご依頼させていただき、残りは…",
    is_read: false,
    is_starred: false,
    last_message_at: daysAgo(0, 9, 15),
    participant_count: 2,
    message_count: 4,
  },
  {
    id: "mock_3",
    subject: "伊藤建設さま｜4月分 請求書送付のご連絡",
    snippet:
      "平素より格別のお引き立てを賜り、誠にありがとうございます。標記の件、4月分の請求書を添付にてお送り致します…",
    is_read: true,
    is_starred: false,
    last_message_at: daysAgo(1, 17, 20),
    participant_count: 2,
    message_count: 1,
  },
  {
    id: "mock_4",
    subject: "鈴木様｜現場打合せ日程のご相談",
    snippet:
      "鈴木様、お世話になっております。先日ご相談いただきました現場打合せについて、下記日程いずれかでいかがでしょうか…",
    is_read: true,
    is_starred: true,
    last_message_at: daysAgo(2, 14, 5),
    participant_count: 3,
    message_count: 5,
  },
  {
    id: "mock_5",
    subject: "【発注書】高橋工務店さま（基礎工事一式）",
    snippet:
      "高橋工務店 山田様 いつもお世話になっております。標記の件、下記のとおり発注させていただきます。ご確認のほど…",
    is_read: true,
    is_starred: false,
    last_message_at: daysAgo(3, 11, 42),
    participant_count: 2,
    message_count: 2,
  },
  {
    id: "mock_6",
    subject: "渡辺様｜キッチンショールーム見学のご案内",
    snippet:
      "渡辺様 お世話になっております。本日はお電話ありがとうございました。ご希望のTOTOショールームのご予約について…",
    is_read: true,
    is_starred: false,
    last_message_at: daysAgo(4, 16, 10),
    participant_count: 2,
    message_count: 2,
  },
  {
    id: "mock_7",
    subject: "Re: Re: 建材納期遅延のご連絡（複合フローリング）",
    snippet:
      "◯◯建材 田島です。たびたびのご連絡申し訳ございません。先ほどメーカーより正式な入荷予定の回答がございまして…",
    is_read: true,
    is_starred: true,
    last_message_at: daysAgo(5, 9, 55),
    participant_count: 3,
    message_count: 6,
  },
  {
    id: "mock_8",
    subject: "山田様｜住宅ローン事前審査の結果について",
    snippet:
      "山田様 ハチ工務店 担当の森です。このたび、お申込みいただきました住宅ローンの事前審査結果につきまして…",
    is_read: true,
    is_starred: false,
    last_message_at: daysAgo(6, 13, 30),
    participant_count: 2,
    message_count: 3,
  },
  {
    id: "mock_9",
    subject: "【社内】今週の工程会議 議事メモ（4/13）",
    snippet:
      "お疲れ様です。本日の工程会議の議事メモを共有します。①田中様邸 外構着工予定→来週月曜→雨天予報のため火曜へ延期…",
    is_read: true,
    is_starred: false,
    last_message_at: daysAgo(7, 18, 0),
    participant_count: 5,
    message_count: 1,
  },
  {
    id: "mock_10",
    subject: "木村内装さま｜クロス工事完了報告のお願い",
    snippet:
      "木村内装 木村様 お世話になっております。先日完了いただきましたクロス工事につきまして、完了報告書の送付を…",
    is_read: true,
    is_starred: false,
    last_message_at: daysAgo(8, 10, 15),
    participant_count: 2,
    message_count: 2,
  },
];

const ME = { name: "ハチ工務店 営業部 森", address: "mori@hachi-koumuten.jp" };

export const MOCK_MAIL_THREAD_DETAILS: Record<string, MockThreadDetail> = {
  mock_1: {
    ...MOCK_MAIL_THREADS[0],
    messages: [
      {
        id: "mock_1_m1",
        from_name: "ハチ工務店 営業部 森",
        from_address: "mori@hachi-koumuten.jp",
        to_addresses: [{ name: "田中 様", address: "tanaka@example.com" }],
        subject: "【田中様邸】外壁タイル色 A案／B案のご提案",
        body_text:
          "田中様\n\nいつもお世話になっております、ハチ工務店の森です。\n\n先日ご相談いただきました外壁タイルの件、候補を2案に絞りましたので、添付の画像にてご確認いただけますと幸いです。\n\n・A案：LIXIL はるかべ「クォーツ・グレージュ」\n・B案：INAX 「エコカラット ベージュ」\n\nどちらも周辺住宅との調和、および10年後の経年変化を考慮したご提案です。\nご家族でご検討の上、ご返信お待ちしております。\n\n森",
        received_at: daysAgo(2, 14, 30),
        direction: "outbound",
      },
      {
        id: "mock_1_m2",
        from_name: "田中 太郎",
        from_address: "tanaka@example.com",
        to_addresses: [ME],
        subject: "Re: 【田中様邸】外壁タイル色 A案／B案のご提案",
        body_text:
          "森様\n\nご提案ありがとうございました。\n妻と子供たちと相談したところ、意見が割れておりまして…\nもう少し時間をいただけますでしょうか。週末までには必ず回答いたします。\n\n田中",
        received_at: daysAgo(1, 20, 12),
        direction: "inbound",
      },
      {
        id: "mock_1_m3",
        from_name: "田中 太郎",
        from_address: "tanaka@example.com",
        to_addresses: [ME],
        subject: "Re: 【田中様邸】外壁タイル色の最終決定について",
        body_text:
          "森様\n\nお世話になっております、田中です。\n外壁タイルの件、家族で話し合った結果、添付のB案（ベージュ系）でお願いしたく、ご連絡いたしました。\n\n決め手は、母屋のレンガ調アプローチとの馴染みの良さでした。\nお手数をおかけしますが、正式な発注をお願いいたします。\n\n田中",
        received_at: daysAgo(0, 10, 32),
        direction: "inbound",
      },
    ],
  },
  mock_2: {
    ...MOCK_MAIL_THREADS[1],
    messages: [
      {
        id: "mock_2_m1",
        from_name: "ハチ工務店 営業部 森",
        from_address: "mori@hachi-koumuten.jp",
        to_addresses: [{ name: "佐藤 様", address: "sato@example.com" }],
        subject: "佐藤邸 追加工事お見積の件",
        body_text:
          "佐藤様\n\nお世話になっております、森です。\n先日ご相談いただいた追加工事について、下記の通りお見積をお送りします。\n\n①造作棚（LDK）… 185,000円（税別）\n②室内物干し増設 … 42,000円（税別）\n③玄関シューズBOX拡張 … 128,000円（税別）\n\nご不明点ございましたらお気軽にお問い合わせください。",
        received_at: daysAgo(3, 10, 15),
        direction: "outbound",
      },
      {
        id: "mock_2_m2",
        from_name: "佐藤 花子",
        from_address: "sato@example.com",
        to_addresses: [ME],
        subject: "Re: 佐藤邸 追加工事お見積の件",
        body_text:
          "森様\n\nお見積ありがとうございます。\n②と③については家族と相談させてください。\n①の造作棚はぜひお願いしたく思います。",
        received_at: daysAgo(2, 9, 45),
        direction: "inbound",
      },
      {
        id: "mock_2_m3",
        from_name: "ハチ工務店 営業部 森",
        from_address: "mori@hachi-koumuten.jp",
        to_addresses: [{ name: "佐藤 様", address: "sato@example.com" }],
        subject: "Re: 佐藤邸 追加工事お見積の件",
        body_text:
          "佐藤様\n\n承知いたしました。\n①造作棚につきまして、発注進めさせていただきます。工期は約2週間を予定しております。\n\nよろしくお願いいたします。",
        received_at: daysAgo(2, 11, 10),
        direction: "outbound",
      },
      {
        id: "mock_2_m4",
        from_name: "佐藤 花子",
        from_address: "sato@example.com",
        to_addresses: [ME],
        subject: "Re: 佐藤邸 追加工事お見積の件",
        body_text:
          "森様\n\n金額ご確認いただきありがとうございます。\n追加項目のうち、造作棚のみ今回ご依頼させていただき、残りは改めてご相談させてください。\n\nよろしくお願いいたします。\n\n佐藤",
        received_at: daysAgo(0, 9, 15),
        direction: "inbound",
      },
    ],
  },
  mock_3: {
    ...MOCK_MAIL_THREADS[2],
    messages: [
      {
        id: "mock_3_m1",
        from_name: "伊藤建設 経理部",
        from_address: "keiri@ito-kensetsu.co.jp",
        to_addresses: [ME],
        subject: "伊藤建設さま｜4月分 請求書送付のご連絡",
        body_text:
          "ハチ工務店 御中\n\n平素より格別のお引き立てを賜り、誠にありがとうございます。\n標記の件、4月分の請求書を添付にてお送り致します。\n\nご査収のほど、よろしくお願い申し上げます。\n\n────────────────\n伊藤建設株式会社 経理部\n〒xxx-xxxx 東京都…\nTEL: 03-xxxx-xxxx\n────────────────",
        received_at: daysAgo(1, 17, 20),
        direction: "inbound",
      },
    ],
  },
  mock_4: {
    ...MOCK_MAIL_THREADS[3],
    messages: [
      {
        id: "mock_4_m1",
        from_name: "ハチ工務店 営業部 森",
        from_address: "mori@hachi-koumuten.jp",
        to_addresses: [{ name: "鈴木 様", address: "suzuki@example.com" }],
        subject: "鈴木様｜現場打合せ日程のご相談",
        body_text:
          "鈴木様\n\nお世話になっております。\n先日ご相談いただきました現場打合せについて、下記日程いずれかでいかがでしょうか。\n\n①4/24（金）10:00-\n②4/25（土）13:00-\n③4/28（火）15:00-\n\nご都合のよろしい日程をお知らせください。",
        received_at: daysAgo(4, 10, 0),
        direction: "outbound",
      },
      {
        id: "mock_4_m2",
        from_name: "鈴木 健一",
        from_address: "suzuki@example.com",
        to_addresses: [ME],
        subject: "Re: 鈴木様｜現場打合せ日程のご相談",
        body_text:
          "森様\n\nご連絡ありがとうございます。\n②4/25（土）13:00- でお願いできますでしょうか。\n妻も参加予定です。",
        received_at: daysAgo(3, 18, 30),
        direction: "inbound",
      },
      {
        id: "mock_4_m3",
        from_name: "ハチ工務店 営業部 森",
        from_address: "mori@hachi-koumuten.jp",
        to_addresses: [{ name: "鈴木 様", address: "suzuki@example.com" }],
        subject: "Re: 鈴木様｜現場打合せ日程のご相談",
        body_text:
          "鈴木様\n\n4/25（土）13:00 承知いたしました。\n現場にて、設計担当の山本とともにお待ちしております。",
        received_at: daysAgo(3, 19, 5),
        direction: "outbound",
      },
      {
        id: "mock_4_m4",
        from_name: "鈴木 健一",
        from_address: "suzuki@example.com",
        to_addresses: [ME],
        subject: "Re: 鈴木様｜現場打合せ日程のご相談",
        body_text:
          "森様\n\nすみません、当日の資料として、最新の間取り図と外構プランもお持ちいただけますでしょうか。",
        received_at: daysAgo(2, 14, 5),
        direction: "inbound",
      },
      {
        id: "mock_4_m5",
        from_name: "ハチ工務店 営業部 森",
        from_address: "mori@hachi-koumuten.jp",
        to_addresses: [{ name: "鈴木 様", address: "suzuki@example.com" }],
        subject: "Re: 鈴木様｜現場打合せ日程のご相談",
        body_text:
          "鈴木様\n\n承知いたしました。\n最新版の間取り図と外構プラン（A3で2部）をお持ちいたします。\n\nどうぞよろしくお願いいたします。",
        received_at: daysAgo(2, 14, 40),
        direction: "outbound",
      },
    ],
  },
  mock_5: {
    ...MOCK_MAIL_THREADS[4],
    messages: [
      {
        id: "mock_5_m1",
        from_name: "ハチ工務店 工務部 森",
        from_address: "mori@hachi-koumuten.jp",
        to_addresses: [{ name: "高橋工務店 山田様", address: "yamada@takahashi.co.jp" }],
        subject: "【発注書】高橋工務店さま（基礎工事一式）",
        body_text:
          "高橋工務店 山田様\n\nいつもお世話になっております。\n標記の件、下記のとおり発注させていただきます。\n\n■現場：田中様邸（xxx市xxx町）\n■工種：基礎工事一式\n■着工予定：5/7\n■完了予定：5/20\n■金額：1,840,000円（税別）\n\n発注書PDFを添付しておりますので、ご確認のほどよろしくお願い申し上げます。",
        received_at: daysAgo(3, 11, 42),
        direction: "outbound",
      },
      {
        id: "mock_5_m2",
        from_name: "高橋工務店 山田",
        from_address: "yamada@takahashi.co.jp",
        to_addresses: [ME],
        subject: "Re: 【発注書】高橋工務店さま（基礎工事一式）",
        body_text:
          "ハチ工務店 森様\n\n発注書、確かに受領いたしました。\n5/7着工にて手配を進めさせていただきます。\n\n引き続きよろしくお願いいたします。\n\n山田",
        received_at: daysAgo(3, 15, 20),
        direction: "inbound",
      },
    ],
  },
  mock_6: {
    ...MOCK_MAIL_THREADS[5],
    messages: [
      {
        id: "mock_6_m1",
        from_name: "ハチ工務店 営業部 森",
        from_address: "mori@hachi-koumuten.jp",
        to_addresses: [{ name: "渡辺 様", address: "watanabe@example.com" }],
        subject: "渡辺様｜キッチンショールーム見学のご案内",
        body_text:
          "渡辺様\n\nお世話になっております。\n本日はお電話ありがとうございました。\nご希望のTOTOショールームのご予約について、下記日程でお取りしております。\n\n■日時：4/27（月）14:00〜15:30\n■場所：TOTO新宿ショールーム\n\n当日は現地でお待ちしております。お気をつけてお越しください。",
        received_at: daysAgo(4, 16, 10),
        direction: "outbound",
      },
      {
        id: "mock_6_m2",
        from_name: "渡辺 由美子",
        from_address: "watanabe@example.com",
        to_addresses: [ME],
        subject: "Re: 渡辺様｜キッチンショールーム見学のご案内",
        body_text:
          "森様\n\nご手配ありがとうございました。\n当日はよろしくお願いいたします。\n\n渡辺",
        received_at: daysAgo(4, 18, 0),
        direction: "inbound",
      },
    ],
  },
  mock_7: {
    ...MOCK_MAIL_THREADS[6],
    messages: [
      {
        id: "mock_7_m1",
        from_name: "◯◯建材 田島",
        from_address: "tajima@marumaru-kenzai.co.jp",
        to_addresses: [ME],
        subject: "建材納期遅延のご連絡（複合フローリング）",
        body_text:
          "ハチ工務店 森様\n\nお世話になっております、◯◯建材の田島です。\n先日ご発注いただきました複合フローリング（品番: XX-3030）について、メーカー欠品のため納期が遅れる見込みです。\n\nご迷惑をおかけし大変申し訳ございません。",
        received_at: daysAgo(7, 14, 10),
        direction: "inbound",
      },
      {
        id: "mock_7_m2",
        from_name: "ハチ工務店 工務部 森",
        from_address: "mori@hachi-koumuten.jp",
        to_addresses: [{ name: "◯◯建材 田島様", address: "tajima@marumaru-kenzai.co.jp" }],
        subject: "Re: 建材納期遅延のご連絡（複合フローリング）",
        body_text:
          "田島様\n\nご連絡ありがとうございます。\n恐れ入りますが、具体的な入荷予定日をお教えいただけますか。\n現場工程への影響を確認する必要がございます。",
        received_at: daysAgo(7, 14, 50),
        direction: "outbound",
      },
      {
        id: "mock_7_m3",
        from_name: "◯◯建材 田島",
        from_address: "tajima@marumaru-kenzai.co.jp",
        to_addresses: [ME],
        subject: "Re: Re: 建材納期遅延のご連絡（複合フローリング）",
        body_text:
          "森様\n\nメーカーに確認中です。回答があり次第すぐにご連絡いたします。\n引き続きよろしくお願いいたします。",
        received_at: daysAgo(6, 10, 20),
        direction: "inbound",
      },
      {
        id: "mock_7_m4",
        from_name: "◯◯建材 田島",
        from_address: "tajima@marumaru-kenzai.co.jp",
        to_addresses: [ME],
        subject: "Re: Re: 建材納期遅延のご連絡（複合フローリング）",
        body_text:
          "森様\n\n◯◯建材 田島です。\nたびたびのご連絡申し訳ございません。\n先ほどメーカーより正式な入荷予定の回答がございまして、5/12週の見通しとのことです。\n\n代替品のご提案も可能ですので、ご希望があればお知らせください。",
        received_at: daysAgo(5, 9, 55),
        direction: "inbound",
      },
    ],
  },
  mock_8: {
    ...MOCK_MAIL_THREADS[7],
    messages: [
      {
        id: "mock_8_m1",
        from_name: "ハチ工務店 営業部 森",
        from_address: "mori@hachi-koumuten.jp",
        to_addresses: [{ name: "山田 様", address: "yamada@example.com" }],
        subject: "山田様｜住宅ローン事前審査の結果について",
        body_text:
          "山田様\n\nハチ工務店 担当の森です。\nこのたび、お申込みいただきました住宅ローンの事前審査結果につきまして、金融機関よりご連絡がございました。\n\n◯◯銀行：承認（金利1.2%／35年）\n△△銀行：承認（金利1.15%／35年）\n\n比較のうえ、本申込みへ進みたいと存じます。\nご都合のよろしい日時をお知らせください。",
        received_at: daysAgo(6, 13, 30),
        direction: "outbound",
      },
      {
        id: "mock_8_m2",
        from_name: "山田 次郎",
        from_address: "yamada@example.com",
        to_addresses: [ME],
        subject: "Re: 山田様｜住宅ローン事前審査の結果について",
        body_text:
          "森様\n\n結果のご連絡ありがとうございました。\n△△銀行で進めさせていただきたいです。\n今週末にお時間いただけますでしょうか。",
        received_at: daysAgo(5, 20, 45),
        direction: "inbound",
      },
      {
        id: "mock_8_m3",
        from_name: "ハチ工務店 営業部 森",
        from_address: "mori@hachi-koumuten.jp",
        to_addresses: [{ name: "山田 様", address: "yamada@example.com" }],
        subject: "Re: 山田様｜住宅ローン事前審査の結果について",
        body_text:
          "山田様\n\n承知いたしました。\n4/26（日）13:00〜 弊社にてお待ちしております。",
        received_at: daysAgo(5, 21, 15),
        direction: "outbound",
      },
    ],
  },
  mock_9: {
    ...MOCK_MAIL_THREADS[8],
    messages: [
      {
        id: "mock_9_m1",
        from_name: "ハチ工務店 工務部 中村",
        from_address: "nakamura@hachi-koumuten.jp",
        to_addresses: [
          { name: "営業部", address: "sales@hachi-koumuten.jp" },
          { name: "工務部", address: "kouji@hachi-koumuten.jp" },
        ],
        subject: "【社内】今週の工程会議 議事メモ（4/13）",
        body_text:
          "お疲れ様です。\n本日の工程会議の議事メモを共有します。\n\n①田中様邸 外構着工予定→来週月曜→雨天予報のため火曜へ延期\n②佐藤様邸 追加造作棚 → 発注済み（納期2週間）\n③鈴木様邸 設計変更 → 次回打合せで最終確認\n④伊藤建設さま引渡し → 書類チェック進行中、4/30完了予定\n⑤渡辺様 ショールーム見学 → 4/27 TOTO新宿\n\n以上、ご確認お願いします。\n\n中村",
        received_at: daysAgo(7, 18, 0),
        direction: "inbound",
      },
    ],
  },
  mock_10: {
    ...MOCK_MAIL_THREADS[9],
    messages: [
      {
        id: "mock_10_m1",
        from_name: "ハチ工務店 工務部 森",
        from_address: "mori@hachi-koumuten.jp",
        to_addresses: [{ name: "木村内装 木村様", address: "kimura@kimura-naisou.co.jp" }],
        subject: "木村内装さま｜クロス工事完了報告のお願い",
        body_text:
          "木村内装 木村様\n\nお世話になっております。\n先日完了いただきましたクロス工事につきまして、完了報告書の送付をお願いできますでしょうか。\n\n内容の確認後、ご請求のご案内を差し上げます。\n恐れ入りますが、よろしくお願いいたします。",
        received_at: daysAgo(8, 10, 15),
        direction: "outbound",
      },
      {
        id: "mock_10_m2",
        from_name: "木村内装 木村",
        from_address: "kimura@kimura-naisou.co.jp",
        to_addresses: [ME],
        subject: "Re: 木村内装さま｜クロス工事完了報告のお願い",
        body_text:
          "ハチ工務店 森様\n\nお世話になっております、木村内装の木村です。\n完了報告書、添付にてお送りいたします。\nご確認のほど、よろしくお願い申し上げます。",
        received_at: daysAgo(8, 14, 50),
        direction: "inbound",
      },
    ],
  },
};
