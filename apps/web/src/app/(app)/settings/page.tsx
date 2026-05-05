"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Save,
  Building2,
  Lock,
  Users,
  UserPlus,
  RefreshCw,
  Trash2,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { updateProfile, getCompany, updateCompany } from "@/lib/actions/profiles";
import {
  listTeamMembers,
  inviteTeamMember,
  updateTeamMemberRole,
  removeTeamMember,
  resendTeamInvite,
  type TeamRole,
} from "@/lib/actions/team";
import { createClient } from "@/lib/supabase/client";
import type { Company, Profile } from "@/lib/database.types";

const ROLE_LABEL: Record<TeamRole, string> = {
  owner: "オーナー",
  hq_admin: "本部管理者",
  contractor_admin: "施工店管理者",
  employee: "社員",
};

const ROLE_COLOR: Record<TeamRole, string> = {
  owner: "bg-amber-100 text-amber-800 border-amber-200",
  hq_admin: "bg-blue-100 text-blue-800 border-blue-200",
  contractor_admin: "bg-emerald-100 text-emerald-800 border-emerald-200",
  employee: "bg-slate-100 text-slate-800 border-slate-200",
};

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
  const [companyRepresentative, setCompanyRepresentative] = useState("");
  const [companyInvoiceNumber, setCompanyInvoiceNumber] = useState("");
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
  const canManageMembers = profile?.role === "owner" || profile?.role === "hq_admin";

  // メンバー管理
  const [members, setMembers] = useState<Profile[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<TeamRole>("employee");
  const [inviteSent, setInviteSent] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [resendTarget, setResendTarget] = useState<Profile | null>(null);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

  const reloadMembers = useCallback(async () => {
    if (!canManageMembers) return;
    setMembersLoading(true);
    try {
      const data = await listTeamMembers();
      setMembers(data);
    } catch (e) {
      toast.error("メンバー一覧の取得に失敗しました", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setMembersLoading(false);
    }
  }, [canManageMembers]);

  useEffect(() => {
    void reloadMembers();
  }, [reloadMembers]);

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
      setCompanyRepresentative(s?.representative ?? "");
      setCompanyInvoiceNumber(s?.invoice_number ?? "");
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
      const updated =       await updateCompany({
        name: companyName.trim() || undefined,
        phone: companyPhone,
        address: companyAddress,
        postal_code: companyPostal,
        representative: companyRepresentative,
        invoice_number: companyInvoiceNumber,
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

  const openAddDialog = () => {
    setNewName("");
    setNewEmail("");
    setNewRole("employee");
    setInviteSent(false);
    setAddOpen(true);
  };

  const handleInviteMember = async () => {
    if (!newName.trim() || !newEmail.trim()) {
      toast.error("表示名とメールアドレスは必須です");
      return;
    }
    setAddSaving(true);
    try {
      await inviteTeamMember({
        email: newEmail.trim(),
        displayName: newName.trim(),
        role: newRole,
      });
      setInviteSent(true);
      toast.success("招待メールを送信しました");
      await reloadMembers();
    } catch (e) {
      toast.error("招待メールの送信に失敗しました", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setAddSaving(false);
    }
  };

  const handleChangeRole = async (member: Profile, role: TeamRole) => {
    if (member.role === role) return;
    setUpdatingRoleId(member.id);
    const prev = [...members];
    setMembers((m) => m.map((x) => (x.id === member.id ? { ...x, role } : x)));
    try {
      await updateTeamMemberRole(member.id, role);
      toast.success("ロールを変更しました");
    } catch (e) {
      setMembers(prev);
      toast.error("ロール変更に失敗しました", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const handleRemoveMember = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      await removeTeamMember(target.id);
      toast.success(`${target.display_name} を削除しました`);
      await reloadMembers();
    } catch (e) {
      toast.error("削除に失敗しました", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  const handleResendInvite = async () => {
    if (!resendTarget) return;
    const target = resendTarget;
    setResendTarget(null);
    try {
      await resendTeamInvite(target.id);
      toast.success(`${target.display_name} に招待メールを再送信しました`);
    } catch (e) {
      toast.error("再送信に失敗しました", {
        description: e instanceof Error ? e.message : undefined,
      });
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
          {canManageMembers && (
            <TabsTrigger value="members">メンバー管理</TabsTrigger>
          )}
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
                        <div className="space-y-2">
                          <Label>代表者名</Label>
                          <Input value={companyRepresentative} onChange={(e) => setCompanyRepresentative(e.target.value)} placeholder="山田 太郎" />
                        </div>
                        <div className="space-y-2">
                          <Label>インボイス登録番号</Label>
                          <Input value={companyInvoiceNumber} onChange={(e) => setCompanyInvoiceNumber(e.target.value)} placeholder="T-XXXXXXXXXXXXXXX" />
                        </div>                      </div>
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

        {/* ── メンバー管理 ─── */}
        {canManageMembers && (
          <TabsContent value="members" className="mt-4">
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  メンバー管理
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {members.length}名
                  </Badge>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => void reloadMembers()} disabled={membersLoading}>
                    <RefreshCw className={`h-4 w-4 ${membersLoading ? "animate-spin" : ""}`} />
                  </Button>
                  <Button size="sm" onClick={openAddDialog}>
                    <UserPlus className="size-4 mr-1" />
                    メンバー追加
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  メンバーは自社のテナント内にのみ追加されます。
                  {profile?.role === "owner"
                    ? "オーナーは新規作成できません（1社1オーナー）。"
                    : "本部管理者は同等以上のロール（オーナー / 本部管理者）を作成できません。"}
                </p>

                {membersLoading && members.length === 0 ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : members.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-lg">
                    メンバーがまだいません
                  </div>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-xs text-muted-foreground">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">表示名</th>
                          <th className="text-left px-3 py-2 font-medium">メール</th>
                          <th className="text-left px-3 py-2 font-medium">ロール</th>
                          <th className="text-right px-3 py-2 font-medium">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((m) => {
                          const isSelf = m.id === profile?.id;
                          const isOwner = m.role === "owner";
                          const canEditThis =
                            !isSelf &&
                            !isOwner &&
                            !(profile?.role === "hq_admin" && m.role === "hq_admin");

                          return (
                            <tr key={m.id} className="border-t hover:bg-muted/30">
                              <td className="px-3 py-2.5">
                                <div className="font-medium">{m.display_name}</div>
                                {(m.department || m.position) && (
                                  <div className="text-xs text-muted-foreground">
                                    {[m.department, m.position].filter(Boolean).join(" / ")}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-muted-foreground">{m.email}</td>
                              <td className="px-3 py-2.5">
                                {canEditThis ? (
                                  <Select
                                    value={m.role}
                                    onValueChange={(v) => void handleChangeRole(m, v as TeamRole)}
                                    disabled={updatingRoleId === m.id}
                                  >
                                    <SelectTrigger className={`h-7 text-xs px-2 border ${ROLE_COLOR[m.role]}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {profile?.role === "owner" && (
                                        <SelectItem value="hq_admin">本部管理者</SelectItem>
                                      )}
                                      <SelectItem value="contractor_admin">施工店管理者</SelectItem>
                                      <SelectItem value="employee">社員</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Badge variant="outline" className={`text-xs ${ROLE_COLOR[m.role]}`}>
                                    {ROLE_LABEL[m.role]}
                                    {isSelf && <span className="ml-1">（自分）</span>}
                                  </Badge>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                {canEditThis ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-xs"
                                      onClick={() => setResendTarget(m)}
                                      title="招待メール再送信"
                                    >
                                      <Send className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                                      onClick={() => setDeleteTarget(m)}
                                      title="削除"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

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

        {/* ── メンバー招待ダイアログ ─── */}
        <Dialog
          open={addOpen}
          onOpenChange={(open) => {
            if (!open) {
              setAddOpen(false);
              setInviteSent(false);
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>メンバーを招待</DialogTitle>
              <DialogDescription>
                招待メールを送信します。受け取ったメンバーはGoogleアカウントでログインし、カレンダー連携まで一度に完了できます。
              </DialogDescription>
            </DialogHeader>

            {inviteSent ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 space-y-1">
                  <div className="flex items-center gap-2 font-semibold">
                    <Send className="h-4 w-4" />
                    招待メールを送信しました
                  </div>
                  <p className="text-xs">
                    <span className="font-medium">{newEmail}</span> に招待リンクを送信しました。
                    受け取ったメンバーがリンクをクリックしてGoogleログインすると自動的に登録されます。
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={openAddDialog}>
                    続けて招待する
                  </Button>
                  <Button onClick={() => setAddOpen(false)}>
                    閉じる
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-3 py-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">表示名 *</Label>
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="山田 太郎"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">メールアドレス *</Label>
                    <Input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="taro@example.com"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      このメールアドレス宛に招待リンクを送信します。Googleアカウントと同じメアドを推奨します。
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">ロール *</Label>
                    <Select value={newRole} onValueChange={(v) => setNewRole(v as TeamRole)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {profile?.role === "owner" && (
                          <SelectItem value="hq_admin">本部管理者</SelectItem>
                        )}
                        <SelectItem value="contractor_admin">施工店管理者</SelectItem>
                        <SelectItem value="employee">社員</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddOpen(false)} disabled={addSaving}>
                    キャンセル
                  </Button>
                  <Button onClick={handleInviteMember} disabled={addSaving}>
                    <Send className="size-4 mr-1" />
                    {addSaving ? "送信中..." : "招待メールを送信"}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* ── 削除確認 ─── */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>メンバーを削除しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget && (
                  <>
                    <span className="font-medium">{deleteTarget.display_name}</span>（{deleteTarget.email}）を削除します。
                    この操作は取り消せません。本人のログインは即座に無効化されます。
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRemoveMember}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                削除する
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── 招待メール再送信 確認 ─── */}
        <AlertDialog open={!!resendTarget} onOpenChange={(open) => !open && setResendTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>招待メールを再送信しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                {resendTarget && (
                  <>
                    <span className="font-medium">{resendTarget.display_name}</span>（{resendTarget.email}）に招待メールを再送信します。
                    以前のリンクは無効化されます。
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction onClick={handleResendInvite}>再送信する</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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
