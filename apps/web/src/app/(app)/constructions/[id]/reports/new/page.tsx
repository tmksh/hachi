"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save } from "lucide-react";

export default function ConstructionReportNewPage() {
  const { id } = useParams();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [weather, setWeather] = useState("晴れ");

  const handleSave = () => { toast.success("日報を保存しました"); router.push(`/constructions/${id}`); };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3"><Link href={`/constructions/${id}`}><Button variant="ghost" size="icon" className="size-8"><ArrowLeft className="size-4" /></Button></Link><h1 className="text-2xl font-semibold tracking-tight text-foreground">日報作成</h1></div>
      <Card><CardHeader className="pb-3"><CardTitle className="text-base">日報情報</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>件名</Label><Input value={title} onChange={e=>setTitle(e.target.value)} placeholder="作業内容" /></div>
            <div className="space-y-2"><Label>天候</Label><Input value={weather} onChange={e=>setWeather(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>作業内容</Label><Textarea rows={6} value={content} onChange={e=>setContent(e.target.value)} placeholder="本日の作業内容を記入..." /></div>
        </CardContent>
      </Card>
      <div className="flex justify-end gap-3"><Link href={`/constructions/${id}`}><Button variant="outline">キャンセル</Button></Link><Button onClick={handleSave}><Save className="size-4 mr-1" />保存</Button></div>
    </div>
  );
}
