"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Save, Building2, Lock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { updateProfile, getCompany, updateCompany } from "@/lib/actions/profiles";
import { createClient } from "@/lib/supabase/client";
import type { Company } from "@/lib/database.types";

export default function SettingsPage() {
  const { profile, loading: authLoading } = useAuth();
  const [saving, setSaving] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [position, setPosition] = useState("");

  // 会社情報
  const [companyName, setCompanyName] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPostal, setCompanyPostal] = useState("");
  const [savingCompany, setSavingCompany] = useState(false);

  // パスワード変更
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const notifKeys = ["email_notif", "push_notif", "approval_reminder", "daily_report_reminder"] as const;
  const notifLabels = ["メール通知", "プッシュ通知", "承認リマインダー", "日報リマインダー"];
  const [notifSettings, setNotifSettings] = useState<Record<string, boolean>>(
    Object.fromEntries(notifKeys.map((k) => [k, true])),
  );
  const [notifLoading, setNotifLoading] = useState(false);

  const canEditCompany = profile?.role === "owner" || profile?.role === "hq_admin";

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.user_metadata?.notif_settings) {
        setNotifSettings(user.user_metadata.notif_settings);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name);
      setPhone(profile.phone ?? "");
      setDepartment(profile.department ?? "");
      setPosition(profile.position ?? "");
    }
  }, [profile]);

  useEffect(() => {
    getCompany().then((c) => {
      setCompany(c);
      setCompanyName(c.name);
      const s = c.settings as Record<string, string>;
      setCompanyPhone(s?.phone ?? "");
      setCompanyAddress(s?.address ?? "");
      setCompanyPostal(s?.postal_code ?? "");
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({
        display_name: displayName.trim(),
        phone: phone || undefined,
        department: department || undefined,
        position: position || undefined,
      });
      toast.success("プロフィールを更新しました");
    } catch {
      toast.error("更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCompany = async () => {
    setSavingCompany(true);
    try {
      const updated = await updateCompany({
        name: companyName.trim() || undefined,
        phone: companyPhone,
        address: companyAddress,
        postal_code: companyPostal,
      });
      setCompany(updated);
      toast.success("会社情報を更新しました");
    } catch {
      toast.error("更新に失敗しました（owner/hq_admin 権限が必要です）");
    } finally {
      setSavingCompany(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("新しいパスワードは6文字以上で入力してください");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("パスワードが一致しません");
      return;
    }
    setSavingPassword(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("パスワードを変更しました");
    } catch (e: unknown) {
      toast.error("パスワード変更に失敗しました", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const planLabel =
    (company?.settings as Record<string, string>)?.plan === "starter" ? "Starter"
    : (company?.settings as Record<string, string>)?.plan === "pro" ? "Pro"
    : (company?.settings as Record<string, string>)?.plan === "enterprise" ? "Enterprise"
    : "Free";

  if (authLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-xl font-semibold">設定</h1>
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">プロフィール</TabsTrigger>
          <TabsTrigger value="company">会社情報</TabsTrigger>
          <TabsTrigger value="security">セキュリティ</TabsTrigger>
          <TabsTrigger value="notifications">通知</TabsTrigger>
        </TabsList>

        {/* ── プロフィール ─── */}
        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">プロフィール</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>表示名</Label>
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>メール</Label>
                  <Input value={profile?.email ?? ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label>電話</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="090-0000-0000" />
                </div>
                <div className="space-y-2">
                  <Label>部署</Label>
                  <Input value={department} onChange={(e) => setDepartment(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>役職</Label>
                  <Input value={position} onChange={(e) => setPosition(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>権限</Label>
                  <Input value={profile?.role ?? ""} disabled />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="size-4 mr-1" />
                  {saving ? "保存中..." : "保存"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 会社情報 ─── */}
        <TabsContent value="company" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                会社情報
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {company ? (
                <>
                  {/* 読み取り専用情報 */}
                  <div className="flex flex-wrap gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">会社ID</span>
                      <code className="text-xs bg-muted rounded px-1.5 py-0.5 font-mono">{company.id.slice(0, 8)}…</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">プラン</span>
                      <Badge variant="secondary" className="text-xs">{planLabel}</Badge>
                    </div>
                    {company.slug && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs">サブドメイン slug</span>
                        <code className="text-xs bg-muted rounded px-1.5 py-0.5 font-mono">{company.slug}</code>
                      </div>
                    )}
                  </div>

                  {canEditCompany ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2 sm:col-span-2">
                          <Label>会社名</Label>
                          <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>電話番号</Label>
                          <Input value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} placeholder="03-0000-0000" />
                        </div>
                        <div className="space-y-2">
                          <Label>郵便番号</Label>
                          <Input value={companyPostal} onChange={(e) => setCompanyPostal(e.target.value)} placeholder="000-0000" />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label>住所</Label>
                          <Input value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} placeholder="東京都〇〇区〇〇 1-2-3" />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button onClick={handleSaveCompany} disabled={savingCompany}>
                          <Save className="size-4 mr-1" />
                          {savingCompany ? "保存中..." : "会社情報を保存"}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between py-1.5 border-b border-border/50">
                        <span className="text-muted-foreground">会社名</span>
                        <span className="font-medium">{company.name}</span>
                      </div>
                      {(company.settings as Record<string, string>)?.phone && (
                        <div className="flex justify-between py-1.5 border-b border-border/50">
                          <span className="text-muted-foreground">電話番号</span>
                          <span>{(company.settings as Record<string, string>).phone}</span>
                        </div>
                      )}
                      {(company.settings as Record<string, string>)?.address && (
                        <div className="flex justify-between py-1.5">
                          <span className="text-muted-foreground">住所</span>
                          <span>{(company.settings as Record<string, string>).address}</span>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        会社情報の編集は owner / hq_admin 権限が必要です。
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── セキュリティ（パスワード変更） ─── */}
        <TabsContent value="security" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                パスワード変更
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Google ログインを使用している場合、パスワード変更は不要です。
              </p>
              <div className="space-y-4 max-w-sm">
                <div className="space-y-2">
                  <Label>新しいパスワード</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="6文字以上"
                  />
                </div>
                <div className="space-y-2">
                  <Label>新しいパスワード（確認）</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="もう一度入力"
                  />
                </div>
                {newPassword && confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-destructive">パスワードが一致しません</p>
                )}
              </div>
              <div className="flex justify-end max-w-sm">
                <Button
                  onClick={handleChangePassword}
                  disabled={savingPassword || !newPassword || newPassword !== confirmPassword}
                >
                  <Lock className="size-4 mr-1" />
                  {savingPassword ? "変更中..." : "パスワードを変更"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 通知 ─── */}
        <TabsContent value="notifications" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">通知設定</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {notifKeys.map((key, i) => (
                <div key={key} className="flex items-center justify-between">
                  <Label>{notifLabels[i]}</Label>
                  <Switch
                    checked={notifSettings[key] ?? true}
                    disabled={notifLoading}
                    onCheckedChange={async (checked) => {
                      const next = { ...notifSettings, [key]: checked };
                      setNotifSettings(next);
                      setNotifLoading(true);
                      try {
                        const supabase = createClient();
                        await supabase.auth.updateUser({ data: { notif_settings: next } });
                        toast.success(`${notifLabels[i]}を${checked ? "有効" : "無効"}にしました`);
                      } catch {
                        toast.error("保存に失敗しました");
                        setNotifSettings(notifSettings);
                      } finally {
                        setNotifLoading(false);
                      }
                    }}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
