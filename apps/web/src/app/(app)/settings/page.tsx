"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CrmMasterTab } from "@/components/settings/crm-master-tab";
import { CraftsmenMasterTab } from "@/components/settings/craftsmen-master-tab";
import { IntegrationsTab } from "@/components/settings/integrations-tab";
import { AppIntegrationsTab } from "@/components/settings/app-integrations-tab";
import { WorkflowTypesTab } from "@/components/settings/workflow-types-tab";
import { PdfBuilderTab } from "@/components/settings/pdf-builder-tab";
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
  Eye,
  EyeOff,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { updateProfile, getCompany, updateCompany } from "@/lib/actions/profiles";
import { getMailSignature, saveMailSignature } from "@/lib/actions/mail";
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
import { NAV_GROUPS, NAV_ITEM_ROLES, ROLE_LABELS, ASSIGNABLE_TEAM_ROLES, SYSTEM_PERMISSION_ROLES, type Role } from "@/lib/constants";
import { useCompanyPermissions, type CustomRole, type RolePermissions, DEFAULT_PERMISSIONS } from "@/hooks/use-company-permissions";

const ROLE_COLOR: Record<Role, string> = {
  hq_admin: "bg-blue-100 text-blue-800 border-blue-200",
  contractor_admin: "bg-emerald-100 text-emerald-800 border-emerald-200",
  employee: "bg-slate-100 text-slate-800 border-slate-200",
  admin: "bg-violet-100 text-violet-800 border-violet-200",
  executive: "bg-amber-100 text-amber-800 border-amber-200",
  sales: "bg-sky-100 text-sky-800 border-sky-200",
  field_manager: "bg-orange-100 text-orange-800 border-orange-200",
  designer: "bg-pink-100 text-pink-800 border-pink-200",
  administration: "bg-teal-100 text-teal-800 border-teal-200",
  external_partner: "bg-gray-100 text-gray-800 border-gray-200",
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
  const [invoiceClosingDay, setInvoiceClosingDay] = useState<"20" | "end_of_month">("end_of_month");
  const [cloudsignEnabled, setCloudsignEnabled] = useState(false);
  const [cloudsignApiKey, setCloudsignApiKey] = useState("");
  const [savingCompany, setSavingCompany] = useState(false);

  // 署名
  const [signature, setSignature] = useState("");
  const [savingSignature, setSavingSignature] = useState(false);

  // 勤怠設定
  const [attStartTime, setAttStartTime] = useState("09:00");
  const [attEndTime, setAttEndTime] = useState("18:00");
  const [attBreakMinutes, setAttBreakMinutes] = useState("60");
  const [attLeaveTypes, setAttLeaveTypes] = useState<string[]>([
    "有給休暇", "夏季休暇", "慶弔休暇", "特別休暇",
    "産前産後休暇", "育児休暇", "介護休暇", "病気休暇",
    "代休", "振替休日", "半日休暇（午前）", "半日休暇（午後）",
  ]);
  const [attLeaveInput, setAttLeaveInput] = useState("");
  const [savingAttendance, setSavingAttendance] = useState(false);

  // 権限・ロール設定
  const { refresh: refreshPerms } = useCompanyPermissions();
  const [rolePerms, setRolePerms] = useState<RolePermissions>(DEFAULT_PERMISSIONS);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [savingRolePerms, setSavingRolePerms] = useState(false);
  const [addRoleOpen, setAddRoleOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleBase, setNewRoleBase] = useState<CustomRole["base_role"]>("employee");
  const [newRoleColor, setNewRoleColor] = useState("slate");

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

  const canEditCompany = profile?.role === "hq_admin";
  const canManageMembers = profile?.role === "hq_admin";

  // メンバー管理
  const [members, setMembers] = useState<Profile[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [showInvitePassword, setShowInvitePassword] = useState(false);
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
    getMailSignature().then((sig) => setSignature(sig)).catch(() => {});
  }, []);

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
      setInvoiceClosingDay(s?.invoice_closing_day === "20" ? "20" : "end_of_month");
      const cs = c.settings as Record<string, unknown>;
      const cloudsign = cs?.cloudsign as { enabled?: boolean; api_key?: string } | undefined;
      setCloudsignEnabled(Boolean(cloudsign?.enabled));
      setCloudsignApiKey(cloudsign?.api_key ?? "");
      const att = (c.settings as Record<string, Record<string, unknown>>)?.attendance_settings;
      if (att) {
        setAttStartTime((att.start_time as string) ?? "09:00");
        setAttEndTime((att.end_time as string) ?? "18:00");
        setAttBreakMinutes(String(att.break_minutes ?? "60"));
        if (Array.isArray(att.leave_types)) setAttLeaveTypes(att.leave_types as string[]);
      }
      if (cs?.role_permissions) {
        setRolePerms({ ...DEFAULT_PERMISSIONS, ...(cs.role_permissions as RolePermissions) });
      }
      if (Array.isArray(cs?.custom_roles)) {
        setCustomRoles(cs.custom_roles as CustomRole[]);
      }
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
        invoice_closing_day: invoiceClosingDay,
        cloudsign: {
          enabled: cloudsignEnabled,
          api_key: cloudsignApiKey || undefined,
        },
      });
      setCompany(updated);
      toast.success("会社情報を更新しました");
    } catch {
      toast.error("更新に失敗しました（本部管理者権限が必要です）");
    } finally {
      setSavingCompany(false);
    }
  };

  const handleSaveSignature = async () => {
    setSavingSignature(true);
    try {
      await saveMailSignature(signature);
      toast.success("署名を保存しました");
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setSavingSignature(false);
    }
  };

  const handleSaveRoleSettings = async () => {
    setSavingRolePerms(true);
    try {
      // owner 列は常に全許可のため保存しない（読み取り専用）
      const permsToSave: RolePermissions = {};
      Object.entries(rolePerms).forEach(([key, roles]) => {
        permsToSave[key] = [...roles];
      });
      await updateCompany({ role_permissions: permsToSave, custom_roles: customRoles });
      // localStorage も更新してサイドバーに即反映
      localStorage.setItem("bridge_role_permissions", JSON.stringify(permsToSave));
      localStorage.setItem("bridge_custom_roles", JSON.stringify(customRoles));
      await refreshPerms();
      toast.success("ロール・権限設定を保存しました");
    } catch (e) {
      toast.error("保存に失敗しました", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSavingRolePerms(false);
    }
  };

  const togglePerm = (featureKey: string, role: string) => {
    setRolePerms((prev) => {
      const current = prev[featureKey] ?? [];
      const next = current.includes(role)
        ? current.filter((r) => r !== role)
        : [...current, role];
      return { ...prev, [featureKey]: next };
    });
  };

  const handleAddOrUpdateCustomRole = () => {
    if (!newRoleName.trim()) return;
    if (editingRole) {
      setCustomRoles((prev) =>
        prev.map((r) => r.id === editingRole.id ? { ...r, name: newRoleName.trim(), base_role: newRoleBase, color: newRoleColor } : r)
      );
    } else {
      const id = `cr_${Date.now()}`;
      setCustomRoles((prev) => [...prev, { id, name: newRoleName.trim(), base_role: newRoleBase, color: newRoleColor }]);
      // 新しいカスタムロールに base_role と同じ権限を初期付与
      setRolePerms((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((key) => {
          if (next[key].includes(newRoleBase)) {
            next[key] = [...next[key], id];
          }
        });
        return next;
      });
    }
    setAddRoleOpen(false);
    setEditingRole(null);
    setNewRoleName("");
    setNewRoleBase("employee");
    setNewRoleColor("slate");
  };

  const handleDeleteCustomRole = (id: string) => {
    setCustomRoles((prev) => prev.filter((r) => r.id !== id));
    setRolePerms((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        next[key] = next[key].filter((r) => r !== id);
      });
      return next;
    });
  };

  const handleSaveAttendance = async () => {
    try {
      await updateCompany({
        attendance_settings: {
          start_time: attStartTime,
          end_time: attEndTime,
          break_minutes: Number(attBreakMinutes),
          leave_types: attLeaveTypes,
        } as Record<string, unknown>,
      });
      toast.success("勤怠設定を保存しました");
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setSavingAttendance(false);
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
    setInvitePassword("");
    setShowInvitePassword(false);
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
        password: invitePassword.trim() || undefined,
      });
      setInviteSent(true);
      toast.success(
        invitePassword.trim()
          ? "アカウントを作成しました"
          : "招待メールを送信しました",
      );
      await reloadMembers();
    } catch (e) {
      toast.error("メンバー追加に失敗しました", {
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
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">設定</h1>
        <p className="text-sm text-muted-foreground mt-1">アカウント・組織・各機能の設定</p>
      </div>

      {/* ── 大項目タブ（上部ナビ） ─── */}
      <Tabs defaultValue="personal" className="w-full">
        <TabsList className="w-full justify-start gap-0 border-b rounded-none bg-transparent h-auto pb-0 border-border/60">
          <TabsTrigger value="personal" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-5 pb-2.5 pt-1.5 text-sm font-medium text-muted-foreground data-[state=active]:text-[#0F5132]">概要</TabsTrigger>
          {canManageMembers && (
            <>
              <TabsTrigger value="organization" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-5 pb-2.5 pt-1.5 text-sm font-medium text-muted-foreground data-[state=active]:text-[#0F5132]">組織</TabsTrigger>
              <TabsTrigger value="master" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-5 pb-2.5 pt-1.5 text-sm font-medium text-muted-foreground data-[state=active]:text-[#0F5132]">マスタ</TabsTrigger>
              <TabsTrigger value="integrations_group" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-5 pb-2.5 pt-1.5 text-sm font-medium text-muted-foreground data-[state=active]:text-[#0F5132]">連携</TabsTrigger>
            </>
          )}
        </TabsList>

        {/* ── 個人グループ ─── */}
        <TabsContent value="personal" className="mt-4">
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="profile">アカウント</TabsTrigger>
              <TabsTrigger value="security">セキュリティ</TabsTrigger>
              <TabsTrigger value="notifications">通知</TabsTrigger>
              <TabsTrigger value="mail_signature">メール署名</TabsTrigger>
              {canManageMembers && <TabsTrigger value="pdf_builder">PDF編集</TabsTrigger>}
            </TabsList>

        {/* ── アカウント（プロフィール + 会社情報） ─── */}
        <TabsContent value="profile" className="mt-3 space-y-4">
          {/* 個人プロフィール */}
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

          {/* 会社情報 */}
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
                        </div>
                        <div className="space-y-2">
                          <Label>請求締日</Label>
                          <Select value={invoiceClosingDay} onValueChange={(v) => setInvoiceClosingDay(v as "20" | "end_of_month")}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="end_of_month">月末締め</SelectItem>
                              <SelectItem value="20">20日締め</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">工事管理の月次請求自動生成に使用します</p>
                        </div>
                        <div className="space-y-2 sm:col-span-2 pt-2 border-t border-border">
                          <Label>クラウドサイン連携（B案: 顧客別契約）</Label>
                          <div className="flex items-center gap-3">
                            <Switch checked={cloudsignEnabled} onCheckedChange={setCloudsignEnabled} />
                            <span className="text-sm text-muted-foreground">電子契約連携を有効化</span>
                          </div>
                          {cloudsignEnabled && (
                            <Input
                              type="password"
                              value={cloudsignApiKey}
                              onChange={(e) => setCloudsignApiKey(e.target.value)}
                              placeholder="クラウドサイン APIキー"
                            />
                          )}
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
                        会社情報の編集は本部管理者権限が必要です。
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
        <TabsContent value="security" className="mt-3">
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
        <TabsContent value="notifications" className="mt-3">
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

        {/* ── メール署名 ─── */}
        <TabsContent value="mail_signature" className="mt-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                メール署名
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                メール作成時に本文末尾へ自動で挿入される署名テンプレートです。
              </p>
              <div className="space-y-2">
                <Label>署名</Label>
                <Textarea
                  rows={6}
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder={`────────────────────\n株式会社〇〇\n営業部　山田 太郎\nTel: 03-XXXX-XXXX\nMail: yamada@example.com\n────────────────────`}
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveSignature} disabled={savingSignature}>
                  <Save className="size-4 mr-1" />
                  {savingSignature ? "保存中..." : "署名を保存"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── PDF編集 ─── */}
        {canManageMembers && (
          <TabsContent value="pdf_builder" className="mt-3">
            <PdfBuilderTab />
          </TabsContent>
        )}

      </Tabs> {/* ── 個人 inner Tabs ── */}
    </TabsContent> {/* ── personal outer group ── */}

    {/* ── 組織グループ ─── */}
    {canManageMembers && (
      <TabsContent value="organization" className="mt-4">
        <Tabs defaultValue="members">
          <TabsList className="mb-4">
            <TabsTrigger value="members">メンバー管理</TabsTrigger>
            <TabsTrigger value="attendance_settings">勤怠設定</TabsTrigger>
            <TabsTrigger value="workflow_types">ワークフロー</TabsTrigger>
          </TabsList>

          {/* メンバー管理 */}
          <TabsContent value="members" className="space-y-4">
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
                  メンバーは自社のテナント内にのみ追加されます。本部管理者がロールを割り当てます。
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
                          const canEditThis = !isSelf;
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
                                    <SelectTrigger className={`h-7 data-[size=default]:h-7 py-0 text-xs px-2 border gap-1 [&>svg:last-child]:hidden ${ROLE_COLOR[m.role]}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {ASSIGNABLE_TEAM_ROLES.map((role) => (
                                        <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Badge variant="outline" className={`h-7 px-2 text-xs rounded-md ${ROLE_COLOR[m.role]}`}>
                                    {ROLE_LABELS[m.role]}
                                    {isSelf && <span className="ml-1">（自分）</span>}
                                  </Badge>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                {canEditThis ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setResendTarget(m)} title="招待メール再送信">
                                      <Send className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={() => setDeleteTarget(m)} title="削除">
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

            {/* ロール・権限設定 */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-row items-start justify-between gap-4 w-full">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Lock className="h-4 w-4 text-primary" />
                      ロール・権限設定
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">クリックで各ロールの機能アクセスを切り替えられます。</p>
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => { setEditingRole(null); setNewRoleName(""); setNewRoleBase("employee"); setNewRoleColor("slate"); setAddRoleOpen(true); }}>
                      <UserPlus className="size-4 mr-1" />ロールを追加
                    </Button>
                    <Button size="sm" onClick={handleSaveRoleSettings} disabled={savingRolePerms}>
                      <Save className="size-4 mr-1" />
                      {savingRolePerms ? "保存中..." : "権限を保存"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">ロール一覧</p>
                  <div className="flex flex-wrap gap-2">
                    {SYSTEM_PERMISSION_ROLES.map((role) => (
                      <div key={role} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${ROLE_COLOR[role]}`}>
                        {ROLE_LABELS[role]}<span className="text-[10px] opacity-60">（システム）</span>
                      </div>
                    ))}
                    {customRoles.map((cr) => {
                      const colorMap: Record<string, string> = { slate: "border-slate-200 bg-slate-50 text-slate-700", blue: "border-blue-200 bg-blue-50 text-blue-700", emerald: "border-emerald-200 bg-emerald-50 text-emerald-700", amber: "border-amber-200 bg-amber-50 text-amber-700", rose: "border-rose-200 bg-rose-50 text-rose-700", violet: "border-violet-200 bg-violet-50 text-violet-700" };
                      return (
                        <div key={cr.id} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${colorMap[cr.color] ?? colorMap.slate}`}>
                          {cr.name}<span className="text-[10px] opacity-60">({ROLE_LABELS[cr.base_role as Role]})</span>
                          <button className="ml-0.5 hover:text-foreground opacity-60 hover:opacity-100" onClick={() => { setEditingRole(cr); setNewRoleName(cr.name); setNewRoleBase(cr.base_role); setNewRoleColor(cr.color); setAddRoleOpen(true); }}>✎</button>
                          <button className="hover:text-destructive opacity-60 hover:opacity-100" onClick={() => handleDeleteCustomRole(cr.id)}>×</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {(() => {
                  const allCols: Array<{ key: string; label: string; color: string }> = [
                    ...SYSTEM_PERMISSION_ROLES.map((role) => ({ key: role, label: ROLE_LABELS[role], color: ROLE_COLOR[role] })),
                    ...customRoles.map((cr) => {
                      const colorMap: Record<string, string> = { slate: "bg-slate-100 text-slate-700", blue: "bg-blue-100 text-blue-700", emerald: "bg-emerald-100 text-emerald-700", amber: "bg-amber-100 text-amber-700", rose: "bg-rose-100 text-rose-700", violet: "bg-violet-100 text-violet-700" };
                      return { key: cr.id, label: cr.name, color: colorMap[cr.color] ?? colorMap.slate };
                    }),
                  ];
                  const featureRows = [
                    ...NAV_GROUPS.flatMap((g, gi) => g.items.map((item, idx) => ({ key: item.key, label: item.label, group: idx === 0 ? g.label : null, groupStart: idx === 0, gi }))),
                    { key: "settings_member", label: "メンバー管理", group: "設定・管理", groupStart: true, gi: 99 },
                    { key: "settings_company", label: "会社情報編集", group: null, groupStart: false, gi: 99 },
                    { key: "settings_attendance", label: "勤怠設定", group: null, groupStart: false, gi: 99 },
                    { key: "settings_workflow", label: "ワークフロー設定", group: null, groupStart: false, gi: 99 },
                    { key: "settings_crm", label: "CRM/職人マスタ", group: null, groupStart: false, gi: 99 },
                  ];
                  return (
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-xs text-muted-foreground">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium sticky left-0 bg-muted/40 z-10">機能</th>
                            {allCols.map((col) => (
                              <th key={col.key} className="text-center px-1.5 py-2 font-medium min-w-[80px]">
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] ${col.color}`}>{col.label}</span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {featureRows.map((row) => (
                            <tr key={row.key} className={`border-t ${row.groupStart ? "border-t-2 border-border" : ""} hover:bg-muted/20`}>
                              <td className="px-3 py-1.5 sticky left-0 bg-background z-10 min-w-[160px]">
                                {row.group && <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-0.5">{row.group}</span>}
                                <span className="text-sm">{row.label}</span>
                              </td>
                              {allCols.map((col) => {
                                const has = (rolePerms[row.key] ?? []).includes(col.key);
                                const editable = canManageMembers;
                                return (
                                  <td key={col.key} className="text-center px-1.5 py-1.5">
                                    <button type="button" onClick={() => editable && togglePerm(row.key, col.key)} disabled={!editable}
                                      title={editable ? (has ? "クリックして無効化" : "クリックして有効化") : "変更不可"}
                                      className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all duration-150 ${has ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-muted text-muted-foreground hover:bg-muted/80"} ${!editable ? "cursor-default" : "cursor-pointer"}`}>
                                      {has ? "✓" : "—"}
                                    </button>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
                <p className="text-xs text-muted-foreground mt-2">✓ = アクセス可能（クリックで切替）　— = アクセス不可</p>
              </CardContent>
            </Card>

            {/* カスタムロール追加/編集ダイアログ */}
            <Dialog open={addRoleOpen} onOpenChange={(o) => { if (!o) { setAddRoleOpen(false); setEditingRole(null); } }}>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>{editingRole ? "ロールを編集" : "カスタムロールを追加"}</DialogTitle>
                  <DialogDescription>カスタムロールはシステムロールをベースに作られます。</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">ロール名 *</Label>
                    <Input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="例：現場監督" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">ベースロール（権限の基準）</Label>
                    <Select value={newRoleBase} onValueChange={(v) => setNewRoleBase(v as CustomRole["base_role"])}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ASSIGNABLE_TEAM_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">初期権限をベースロールからコピーします。</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">カラー</Label>
                    <div className="flex gap-1.5">
                      {(["slate", "blue", "emerald", "amber", "rose", "violet"] as const).map((c) => {
                        const bg: Record<string, string> = { slate: "bg-slate-400", blue: "bg-blue-500", emerald: "bg-emerald-500", amber: "bg-amber-500", rose: "bg-rose-500", violet: "bg-violet-500" };
                        return <button key={c} type="button" onClick={() => setNewRoleColor(c)} className={`w-6 h-6 rounded-full ${bg[c]} ${newRoleColor === c ? "ring-2 ring-offset-1 ring-foreground" : ""}`} />;
                      })}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setAddRoleOpen(false); setEditingRole(null); }}>キャンセル</Button>
                  <Button onClick={handleAddOrUpdateCustomRole} disabled={!newRoleName.trim()}>{editingRole ? "更新" : "追加"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* 勤怠設定 */}
          <TabsContent value="attendance_settings" className="mt-3 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">就業時間</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>始業時刻</Label>
                    <Input type="time" value={attStartTime} onChange={(e) => setAttStartTime(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>終業時刻</Label>
                    <Input type="time" value={attEndTime} onChange={(e) => setAttEndTime(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>休憩時間（分）</Label>
                    <Input type="number" min={0} max={480} step={15} value={attBreakMinutes} onChange={(e) => setAttBreakMinutes(e.target.value)} placeholder="60" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  所定労働時間：{(() => {
                    const start = attStartTime.split(":").map(Number);
                    const end = attEndTime.split(":").map(Number);
                    const total = (end[0] * 60 + end[1]) - (start[0] * 60 + start[1]) - Number(attBreakMinutes || 0);
                    return total > 0 ? `${Math.floor(total / 60)}時間${total % 60 > 0 ? `${total % 60}分` : ""}` : "-";
                  })()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">休暇区分</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {attLeaveTypes.map((lt) => (
                    <span key={lt} className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 text-sm">
                      {lt}
                      <button type="button" onClick={() => setAttLeaveTypes((prev) => prev.filter((x) => x !== lt))} className="text-muted-foreground hover:text-destructive transition-colors">×</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={attLeaveInput} onChange={(e) => setAttLeaveInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && attLeaveInput.trim()) { e.preventDefault(); if (!attLeaveTypes.includes(attLeaveInput.trim())) { setAttLeaveTypes((prev) => [...prev, attLeaveInput.trim()]); } setAttLeaveInput(""); } }}
                    placeholder="例：慶弔休暇" />
                  <Button type="button" variant="outline" size="sm" onClick={() => { if (attLeaveInput.trim() && !attLeaveTypes.includes(attLeaveInput.trim())) { setAttLeaveTypes((prev) => [...prev, attLeaveInput.trim()]); setAttLeaveInput(""); } }}>追加</Button>
                </div>
                <p className="text-xs text-muted-foreground">勤怠入力時の区分選択肢として表示されます</p>
              </CardContent>
            </Card>
            <div className="flex justify-start">
              <Button onClick={handleSaveAttendance} disabled={savingAttendance}>
                <Save className="size-4 mr-1" />
                {savingAttendance ? "保存中..." : "保存"}
              </Button>
            </div>
          </TabsContent>

          {/* ワークフロー */}
          <TabsContent value="workflow_types" className="mt-3">
            <WorkflowTypesTab />
          </TabsContent>
        </Tabs>

        {/* メンバー招待ダイアログ */}
        <Dialog open={addOpen} onOpenChange={(open) => { if (!open) { setAddOpen(false); setInviteSent(false); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>メンバーを招待</DialogTitle>
              <DialogDescription>
                {invitePassword.trim() ? "仮パスワードを設定するとメールなしで即時アカウント作成します。" : "招待メールを送信します。"}
              </DialogDescription>
            </DialogHeader>
            {inviteSent ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 space-y-1">
                  <div className="flex items-center gap-2 font-semibold"><Send className="h-4 w-4" />招待メールを送信しました</div>
                  <p className="text-xs">{invitePassword ? <>アカウントを作成しました。メールアドレス（<span className="font-medium">{newEmail}</span>）と設定したパスワードをメンバーに共有してください。</> : <><span className="font-medium">{newEmail}</span> に招待リンクを送信しました。</>}</p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={openAddDialog}>続けて招待する</Button>
                  <Button onClick={() => setAddOpen(false)}>閉じる</Button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-3 py-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs">表示名 *</Label>
                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="山田 太郎" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">メールアドレス *</Label>
                    <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="taro@example.com" />
                    <p className="text-[11px] text-muted-foreground">このアドレス宛に招待リンクを送信します。</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">仮パスワード<span className="ml-1.5 text-muted-foreground font-normal">（任意）</span></Label>
                    <div className="relative">
                      <Input type={showInvitePassword ? "text" : "password"} value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} placeholder="設定する場合は6文字以上" className="pr-10" />
                      <button type="button" onClick={() => setShowInvitePassword(!showInvitePassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showInvitePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {invitePassword.trim() ? <p className="text-[11px] text-amber-600 font-medium">⚠ 招待メールは送信されません。パスワードを本人に直接お伝えください。</p> : <p className="text-[11px] text-muted-foreground">空欄のままにすると招待リンクをメール送信します。</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">ロール *</Label>
                    <Select value={newRole} onValueChange={(v) => setNewRole(v as TeamRole)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ASSIGNABLE_TEAM_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddOpen(false)} disabled={addSaving}>キャンセル</Button>
                  <Button onClick={handleInviteMember} disabled={addSaving}>
                    <Send className="size-4 mr-1" />
                    {addSaving ? "送信中..." : "招待メールを送信"}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>メンバーを削除しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget && <><span className="font-medium">{deleteTarget.display_name}</span>（{deleteTarget.email}）を削除します。この操作は取り消せません。</>}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction onClick={handleRemoveMember} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">削除する</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={!!resendTarget} onOpenChange={(open) => !open && setResendTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>招待メールを再送信しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                {resendTarget && <><span className="font-medium">{resendTarget.display_name}</span>（{resendTarget.email}）に招待メールを再送信します。以前のリンクは無効化されます。</>}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction onClick={handleResendInvite}>再送信する</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TabsContent>
    )}

    {/* ── マスタグループ ─── */}
    {canManageMembers && (
      <TabsContent value="master" className="mt-4">
        <Tabs defaultValue="crm_master">
          <TabsList className="mb-4">
            <TabsTrigger value="crm_master">CRMマスタ</TabsTrigger>
            <TabsTrigger value="craftsmen_master">職人マスタ</TabsTrigger>
          </TabsList>
          <TabsContent value="crm_master" className="mt-3"><CrmMasterTab /></TabsContent>
          <TabsContent value="craftsmen_master" className="mt-3"><CraftsmenMasterTab /></TabsContent>
        </Tabs>
      </TabsContent>
    )}

    {/* ── 連携グループ ─── */}
    {canManageMembers && (
      <TabsContent value="integrations_group" className="mt-4">
        <Tabs defaultValue="app_integrations">
          <TabsList className="mb-4">
            <TabsTrigger value="app_integrations">アプリ連携</TabsTrigger>
            <TabsTrigger value="integrations">API / Webhook</TabsTrigger>
          </TabsList>
          <TabsContent value="app_integrations" className="mt-3"><AppIntegrationsTab /></TabsContent>
          <TabsContent value="integrations" className="mt-3"><IntegrationsTab /></TabsContent>
        </Tabs>
      </TabsContent>
    )}

      </Tabs> {/* ── 外側 group Tabs ── */}
    </div>
  );
}
