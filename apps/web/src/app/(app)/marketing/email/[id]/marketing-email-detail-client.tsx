"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { getEmailThread } from "@/lib/actions/mail";

type Detail = Awaited<ReturnType<typeof getEmailThread>>;

type MarketingEmailDetailClientProps = {
  initialData: Detail | null;
};

export function MarketingEmailDetailClient({ initialData }: MarketingEmailDetailClientProps) {
  if (!initialData) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Link href="/marketing/email" className="text-sm text-muted-foreground flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" />戻る
        </Link>
        <p className="mt-4">見つかりません</p>
      </div>
    );
  }

  const data = initialData;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <Link href="/marketing/email" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />配信一覧</Link>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{data.subject || "(件名なし)"}</h1>
      {(data.messages ?? []).map((msg: { id: string; from_address: string | null; received_at: string | null; body_text: string | null }) => (
        <Card key={msg.id}><CardContent className="p-5 space-y-2">
          <div className="flex justify-between text-sm"><span className="font-medium">{msg.from_address || "-"}</span><span className="text-muted-foreground">{msg.received_at ? format(parseISO(msg.received_at), "yyyy/MM/dd HH:mm", {locale:ja}) : ""}</span></div>
          <p className="text-sm whitespace-pre-wrap">{msg.body_text}</p>
        </CardContent></Card>
      ))}
    </div>
  );
}
