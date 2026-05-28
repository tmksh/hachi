"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export default function ConstructionReportDetailPage() {
  const { id } = useParams();
  return (
    <div className="p-4 md:p-6 space-y-4">
      <Link href={`/constructions/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />工事詳細に戻る</Link>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">日報詳細</h1>
      <Card><CardContent className="py-12 text-center text-muted-foreground">日報機能は準備中です</CardContent></Card>
    </div>
  );
}
