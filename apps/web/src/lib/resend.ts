import { Resend } from "resend";

export const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? "noreply@example.com";

/** Resend クライアントを遅延初期化（APIキー未設定時のクラッシュを防ぐ） */
export function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY が設定されていません。.env.local を確認してください。");
  return new Resend(key);
}

/** 招待メールのHTML本文を生成 */
export function buildInviteEmailHtml(opts: {
  inviteeName: string;
  inviterName: string;
  companyName: string;
  inviteUrl: string;
  appUrl: string;
}): string {
  const { inviteeName, inviterName, companyName, inviteUrl, appUrl } = opts;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${companyName} への招待</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- ヘッダー -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e293b 0%,#334155 100%);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">
                ${companyName}
              </h1>
              <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">業務管理システム</p>
            </td>
          </tr>

          <!-- 本文 -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">
                <strong style="color:#111827;">${inviteeName}</strong> さん、こんにちは。
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.7;">
                <strong style="color:#111827;">${inviterName}</strong> より
                <strong style="color:#111827;">${companyName}</strong> の業務管理システムへの招待が届いています。
                下のボタンからアカウントを有効化し、パスワードを設定してください。
              </p>

              <!-- CTA ボタン -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
                <tr>
                  <td align="center" style="background:linear-gradient(135deg,#2563eb 0%,#4f46e5 100%);border-radius:8px;">
                    <a href="${inviteUrl}"
                       style="display:inline-block;padding:14px 36px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.3px;">
                      アカウントを有効化する
                    </a>
                  </td>
                </tr>
              </table>

              <!-- 注意書き -->
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
                <p style="margin:0 0 8px;font-size:12px;color:#64748b;font-weight:600;">ご注意</p>
                <ul style="margin:0;padding:0 0 0 16px;font-size:12px;color:#64748b;line-height:1.8;">
                  <li>このリンクは <strong>72時間</strong> 有効です。</li>
                  <li>リンクは1回のみ使用できます。</li>
                  <li>ボタンが機能しない場合は、下記URLをブラウザに貼り付けてください。</li>
                </ul>
              </div>

              <p style="margin:0;font-size:11px;color:#94a3b8;word-break:break-all;">
                ${inviteUrl}
              </p>
            </td>
          </tr>

          <!-- フッター -->
          <tr>
            <td style="padding:20px 40px 32px;border-top:1px solid #f1f5f9;">
              <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.6;">
                このメールに心当たりがない場合は無視してください。<br/>
                <a href="${appUrl}" style="color:#6366f1;text-decoration:none;">${appUrl}</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
