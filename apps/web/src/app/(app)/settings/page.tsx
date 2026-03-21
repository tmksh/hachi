"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { updateProfile, getCompany } from "@/lib/actions/profiles";
import type { Company } from "@/lib/database.types";

export default function SettingsPage() {
  const { profile, loading: authLoading } = useAuth();
  const [saving, setSaving] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [position, setPosition] = useState("");

  useEffect(() => {
    if (profile) { setDisplayName(profile.display_name); setPhone(profile.phone ?? ""); setDepartment(profile.department ?? ""); setPosition(profile.position ?? ""); }
  }, [profile]);

  useEffect(() => { getCompany().then(setCompany).catch(() => {}); }, []);

  const handleSave = async () => {
    setSaving(true);
    try { await updateProfile({ display_name: displayName.trim(), phone: phone || undefined, department: department || undefined, position: position || undefined }); toast.success("プロフィールを更新しました"); } catch { toast.error("更新に失敗"); } finally { setSaving(false); }
  };

  if (authLoading) return <div className="p-4 md:p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-xl font-semibold">設定</h1>
      <Tabs defaultValue="profile">
        <TabsList><TabsTrigger value="profile">プロフィール</TabsTrigger><TabsTrigger value="company">会社情報</TabsTrigger><TabsTrigger value="notifications">通知</TabsTrigger></TabsList>
        <TabsContent value="profile" className="mt-4">
          <Card><CardHeader className="pb-3"><CardTitle className="text-base">プロフィール</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>表示名</Label><Input value={displayName} onChange={e=>setDisplayName(e.target.value)} /></div>
                <div className="space-y-2"><Label>メール</Label><Input value={profile?.email ?? ""} disabled /></div>
                <div className="space-y-2"><Label>電話</Label><Input value={phone} onChange={e=>setPhone(e.target.value)} /></div>
                <div className="space-y-2"><Label>部署</Label><Input value={department} onChange={e=>setDepartment(e.target.value)} /></div>
                <div className="space-y-2"><Label>役職</Label><Input value={position} onChange={e=>setPosition(e.target.value)} /></div>
                <div className="space-y-2"><Label>権限</Label><Input value={profile?.role ?? ""} disabled /></div>
              </div>
              <div className="flex justify-end"><Button onClick={handleSave} disabled={saving}><Save className="size-4 mr-1" />{saving?"保存中...":"保存"}</Button></div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="company" className="mt-4">
          <Card><CardHeader className="pb-3"><CardTitle className="text-base">会社情報</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">{company ? <><div className="flex justify-between"><span className="text-muted-foreground">会社名</span><span className="font-medium">{company.name}</span></div></> : <p className="text-muted-foreground">会社情報を読み込み中...</p>}</CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="notifications" className="mt-4">
          <Card><CardHeader className="pb-3"><CardTitle className="text-base">通知設定</CardTitle></CardHeader>
            <CardContent className="space-y-4">{["メール通知","プッシュ通知","承認リマインダー","日報リマインダー"].map(label => (
              <div key={label} className="flex items-center justify-between"><Label>{label}</Label><Switch defaultChecked /></div>
            ))}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
