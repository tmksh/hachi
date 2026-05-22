import { redirect } from "next/navigation";

/** 旧 URL 互換: ダッシュボード上の Dialog で期首設定を開く */
export default function BiSettingsRedirectPage() {
  redirect("/bi?settings=1");
}
