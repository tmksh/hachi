"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CrmMasterTab, type CrmMasterInitialData } from "@/components/settings/crm-master-tab";
import { CraftsmenMasterTab, type CraftsmenMasterInitialData } from "@/components/settings/craftsmen-master-tab";
import { IntegrationsTab } from "@/components/settings/integrations-tab";
import { AppIntegrationsTab, type AppIntegrationsInitialData } from "@/components/settings/app-integrations-tab";

const tabSkeleton = () => <Skeleton className="h-48 w-full rounded-xl" />;

// 使用頻度が低いタブだけ code-split（メイン4タブは静的 import で切替即時）
const WorkflowTypesTab = dynamic(
  () => import("@/components/settings/workflow-types-tab").then((m) => m.WorkflowTypesTab),
  { loading: tabSkeleton },
);
const PdfBuilderTab = dynamic(
  () => import("@/components/settings/pdf-builder-tab").then((m) => m.PdfBuilderTab),
  { loading: tabSkeleton },
);
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
  Mail,
  User,
  Bell,
  FileText,
  Link2,
  BookOpen,
  Wrench,
  Clock,
  GitBranch,
  Puzzle,
  Code2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { updateProfile, getCompany, updateCompany } from "@/lib/actions/profiles";
import { getBiCompanyConfig, saveBiCompanyConfig } from "@/lib/actions/bi";
import type { BiCompanyConfig } from "@/lib/bi-config";
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
import { useCompanyPermissions, type CustomRole, type RolePermissions } from "@/hooks/use-company-permissions";
import { mergeRolePermissions, withPermissionsSchema } from "@/lib/role-permissions";
import { FontSizeSelector } from "@/components/settings/font-size-selector";
import { getCustomerAvatarColor } from "@/lib/customer-avatar-color";
import { CustomerAvatar } from "@/components/shared/customer-avatar";

const SETTINGS_TAB_TRIGGER =
  "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-all shadow-none border-0";

const MAIN_DEFAULT_SUB: Record<string, string> = {
  personal: "profile",
  organization: "members",
  master: "crm_master",
  integrations_group: "app_integrations",
};

function SettingsSubSelect({
  value,
  onChange,
  items,
}: {
  value: string;
  onChange: (v: string) => void;
  items: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[160px] shrink-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

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

function companyFormState(c: Company | null) {
  const s = (c?.settings ?? {}) as Record<string, unknown>;
  const str = s as Record<string, string>;
  const cloudsign = s.cloudsign as { enabled?: boolean; api_key?: string } | undefined;
  const att = s.attendance_settings as Record<string, unknown> | undefined;
  return {
    companyName: c?.name ?? "",
    companyPhone: str.phone ?? "",
    companyAddress: str.address ?? "",
    companyPostal: str.postal_code ?? "",
    companyRepresentative: str.representative ?? "",
    companyInvoiceNumber: str.invoice_number ?? "",
    invoiceClosingDay: (str.invoice_closing_day === "20" ? "20" : "end_of_month") as "20" | "end_of_month",
    fiscalMonthStart: typeof s.fiscal_month_start === "number" && s.fiscal_month_start >= 1 && s.fiscal_month_start <= 12
      ? s.fiscal_month_start : 4,
    cloudsignEnabled: Boolean(cloudsign?.enabled),
    cloudsignApiKey: cloudsign?.api_key ?? "",
    attStartTime: (att?.start_time as string) ?? "09:00",
    attEndTime: (att?.end_time as string) ?? "18:00",
    attBreakMinutes: String(att?.break_minutes ?? "60"),
    attLeaveTypes: Array.isArray(att?.leave_types)
      ? (att.leave_types as string[])
      : ["有給休暇", "夏季休暇", "慶弔休暇", "特別休暇", "産前産後休暇", "育児休暇", "介護休暇", "病気休暇", "代休", "振替休日", "半日休暇（午前）", "半日休暇（午後）"],
    rolePerms: mergeRolePermissions(
      s.role_permissions ? (s.role_permissions as RolePermissions) : null,
    ),
    customRoles: Array.isArray(s.custom_roles) ? (s.custom_roles as CustomRole[]) : [],
  };
}

export function SettingsClient({
  initialCompany,
  initialSignature,
  initialMembers,
  initialCrmMaster,
  initialCraftsmenMaster,
  initialAppIntegrations,
}: {
  initialCompany: Company | null;
  initialSignature: string;
  initialMembers: Profile[];
  initialCrmMaster?: CrmMasterInitialData;
  initialCraftsmenMaster?: CraftsmenMasterInitialData;
  initialAppIntegrations?: AppIntegrationsInitialData;
}) {
  const { profile, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const initInnerTab = searchParams.get("tab") ?? "profile";
  const personalTabs = new Set(["profile", "security", "notifications", "mail_signature", "pdf_builder"]);
  const [mainTab, setMainTab] = useState("personal");
  const [subTab, setSubTab] = useState(personalTabs.has(initInnerTab) ? initInnerTab : "profile");
  /** 一度開いた大タブは unmount しない（再取得・再マウント待ちを防ぐ） */
  const [visitedMain, setVisitedMain] = useState<Set<string>>(() => new Set(["personal"]));
  /** 権限マトリクスは重いのでメンバー一覧の後に描画 */
  const [permsReady, setPermsReady] = useState(false);

  const handleMainTabChange = (next: string) => {
    setMainTab(next);
    setSubTab(MAIN_DEFAULT_SUB[next] ?? "profile");
    setVisitedMain((prev) => {
      if (prev.has(next)) return prev;
      const n = new Set(prev);
      n.add(next);
      return n;
    });
  };
  const formDefaults = companyFormState(initialCompany);
  const [saving, setSaving] = useState(false);
  const [company, setCompany] = useState<Company | null>(initialCompany);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [position, setPosition] = useState("");

  // 会社情報
  const [companyName, setCompanyName] = useState(formDefaults.companyName);
  const [companyPhone, setCompanyPhone] = useState(formDefaults.companyPhone);
  const [companyAddress, setCompanyAddress] = useState(formDefaults.companyAddress);
  const [companyPostal, setCompanyPostal] = useState(formDefaults.companyPostal);
  const [companyRepresentative, setCompanyRepresentative] = useState(formDefaults.companyRepresentative);
  const [companyInvoiceNumber, setCompanyInvoiceNumber] = useState(formDefaults.companyInvoiceNumber);
  const [invoiceClosingDay, setInvoiceClosingDay] = useState<"20" | "end_of_month">(formDefaults.invoiceClosingDay);
  const [fiscalMonthStart, setFiscalMonthStart] = useState<number>(formDefaults.fiscalMonthStart);
  const [cloudsignEnabled, setCloudsignEnabled] = useState(formDefaults.cloudsignEnabled);
  const [cloudsignApiKey, setCloudsignApiKey] = useState(formDefaults.cloudsignApiKey);
  const [savingCompany, setSavingCompany] = useState(false);

  // 見込度 A/B/C の確度%（bi_company_config に保存）
  const [biConfig, setBiConfig] = useState<BiCompanyConfig | null>(null);

  // 署名
  const [signature, setSignature] = useState(initialSignature);
  const [savingSignature, setSavingSignature] = useState(false);

  // 勤怠設定
  const [attStartTime, setAttStartTime] = useState(formDefaults.attStartTime);
  const [attEndTime, setAttEndTime] = useState(formDefaults.attEndTime);
  const [attBreakMinutes, setAttBreakMinutes] = useState(formDefaults.attBreakMinutes);
  const [attLeaveTypes, setAttLeaveTypes] = useState<string[]>(formDefaults.attLeaveTypes);
  const [attLeaveInput, setAttLeaveInput] = useState("");
  const [savingAttendance, setSavingAttendance] = useState(false);

  // 権限・ロール設定
  const { refresh: refreshPerms } = useCompanyPermissions();
  const [rolePerms, setRolePerms] = useState<RolePermissions>(formDefaults.rolePerms);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>(formDefaults.customRoles);
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
  const [members, setMembers] = useState<Profile[]>(initialMembers);
  const [membersLoading, setMembersLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<TeamRole>("employee");
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteLinkFallback, setInviteLinkFallback] = useState<string | null>(null);
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
    if (!canEditCompany) return;
    getBiCompanyConfig().then(setBiConfig).catch(() => {});
  }, [canEditCompany]);

  // 組織タブの権限表はメインスレッドを塞ぐため、表示後に遅延マウント
  useEffect(() => {
    if (mainTab !== "organization" || subTab !== "members") return;
    if (permsReady) return;
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const show = () => setPermsReady(true);
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(show, { timeout: 120 });
    } else {
      timeoutId = setTimeout(show, 0);
    }
    return () => {
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, [mainTab, subTab, permsReady]);

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
        fiscal_month_start: fiscalMonthStart,
        cloudsign: {
          enabled: cloudsignEnabled,
          api_key: cloudsignApiKey || undefined,
        },
      });
      if (biConfig) await saveBiCompanyConfig(biConfig);
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
      const permsToSave = withPermissionsSchema(rolePerms);
      await updateCompany({ role_permissions: permsToSave, custom_roles: customRoles });
      // localStorage も更新してサイドバーに即反映（マージ済みを書く）
      localStorage.setItem("bridge_role_permissions", JSON.stringify(permsToSave));
      localStorage.setItem("bridge_custom_roles", JSON.stringify(customRoles));
      await refreshPerms(true);
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
    setNewRole("employee");
    setInviteSent(false);
    setInviteLinkFallback(null);
    setAddOpen(true);
  };

  const handleInviteMember = async () => {
    if (!newName.trim() || !newEmail.trim()) {
      toast.error("表示名とメールアドレスは必須です");
      return;
    }
    setAddSaving(true);
    try {
      const result = await inviteTeamMember({
        email: newEmail.trim(),
        displayName: newName.trim(),
        role: newRole,
      });
      if (!result.ok) {
        toast.error("メンバー追加に失敗しました", { description: result.error });
        return;
      }
      setInviteSent(true);
      setInviteLinkFallback(result.inviteUrl && !result.emailSent ? result.inviteUrl : null);
      if (result.emailSent) {
        toast.success("招待メールを送信しました");
      } else {
        toast.warning("招待を作成しました（メール未送信）", { description: result.error });
      }
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

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">設定</h1>
        <p className="text-sm text-muted-foreground mt-1">アカウント・組織・各機能の設定</p>
      </div>
      {authLoading && !profile && (
        <Skeleton className="h-10 w-full max-w-md rounded-xl" />
      )}

      {/* ── 大項目タブ（上部ナビ） ─── */}
      <Tabs value={mainTab} onValueChange={handleMainTabChange} className="w-full">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <TabsList className="w-fit mb-0 gap-0.5 h-auto shrink-0">
            <TabsTrigger value="personal" className={SETTINGS_TAB_TRIGGER}>
              <User className="h-3.5 w-3.5" />概要
            </TabsTrigger>
            {canManageMembers && (
              <>
                <TabsTrigger value="organization" className={SETTINGS_TAB_TRIGGER}>
                  <Users className="h-3.5 w-3.5" />組織
                </TabsTrigger>
                <TabsTrigger value="master" className={SETTINGS_TAB_TRIGGER}>
                  <BookOpen className="h-3.5 w-3.5" />マスタ
                </TabsTrigger>
                <TabsTrigger value="integrations_group" className={SETTINGS_TAB_TRIGGER}>
                  <Link2 className="h-3.5 w-3.5" />連携
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {mainTab === "personal" && (
            <SettingsSubSelect
              value={subTab}
              onChange={setSubTab}
              items={[
                { value: "profile", label: "プロフィール" },
                { value: "security", label: "セキュリティ" },
                { value: "notifications", label: "通知設定" },
                { value: "mail_signature", label: "メール署名" },
                ...(canManageMembers ? [{ value: "pdf_builder", label: "PDF編集" }] : []),
              ]}
            />
          )}

          {mainTab === "organization" && canManageMembers && (
            <SettingsSubSelect
              value={subTab}
              onChange={setSubTab}
              items={[
                { value: "members", label: "メンバー管理" },
                { value: "attendance_settings", label: "勤怠設定" },
                { value: "workflow_types", label: "ワークフロー" },
              ]}
            />
          )}

          {mainTab === "master" && canManageMembers && (
            <SettingsSubSelect
              value={subTab}
              onChange={setSubTab}
              items={[
                { value: "crm_master", label: "CRMマスタ" },
                { value: "craftsmen_master", label: "職人マスタ" },
              ]}
            />
          )}

          {mainTab === "integrations_group" && canManageMembers && (
            <SettingsSubSelect
              value={subTab}
              onChange={setSubTab}
              items={[
                { value: "app_integrations", label: "アプリ連携" },
                { value: "integrations", label: "API / Webhook" },
              ]}
            />
          )}
        </div>

        {/* ── 個人グループ ─── */}
        <TabsContent value="personal" forceMount className="mt-0 data-[state=inactive]:hidden">
        {subTab === "profile" && (
        <div className="space-y-4">
          {/* 個人プロフィール */}
          <Card className="gap-2 py-3">
            <CardHeader className="min-h-8 border-b border-border/60 px-5 py-2">
              <CardTitle className="text-sm">プロフィール</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-5 pb-3 pt-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">表示名</Label>
                  <Input className="h-8" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">メール</Label>
                  <Input className="h-8" value={profile?.email ?? ""} disabled />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">電話</Label>
                  <Input className="h-8" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="090-0000-0000" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">部署</Label>
                  <Input className="h-8" value={department} onChange={(e) => setDepartment(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">役職</Label>
                  <Input className="h-8" value={position} onChange={(e) => setPosition(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">権限</Label>
                  <Input className="h-8" value={profile?.role ?? ""} disabled />
                </div>
              </div>
              <FontSizeSelector compact />
              <div className="flex justify-end pt-1">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  <Save className="size-3.5 mr-1" />
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
              {companyLoading ? (
                <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                  <Skeleton className="h-4 w-full" />
                </div>
              ) : company ? (
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
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>会社名</Label>
                          <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
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
                          <Label>電話番号</Label>
                          <Input value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} placeholder="03-0000-0000" />
                        </div>
                        <div className="space-y-2">
                          <Label>郵便番号</Label>
                          <Input value={companyPostal} onChange={(e) => setCompanyPostal(e.target.value)} placeholder="000-0000" />
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
                        <div className="space-y-2">
                          <Label>会計年度の始まり月</Label>
                          <Select value={String(fiscalMonthStart)} onValueChange={(v) => setFiscalMonthStart(Number(v))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                                <SelectItem key={m} value={String(m)}>{m}月始まり</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">BIダッシュボードの年度計算・月別グラフに反映されます</p>
                        </div>
                        <div className="space-y-2 sm:col-span-3">
                          <Label>住所</Label>
                          <Input value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} placeholder="東京都〇〇区〇〇 1-2-3" />
                        </div>
                        <div className="space-y-2 sm:col-span-3 pt-2 border-t border-border">
                          <Label>見込度（A/B/C）の確度%</Label>
                          <p className="text-xs text-muted-foreground">
                            顧客の見込度をBIダッシュボードの見込み売上に反映する際の掛け率です
                          </p>
                          {biConfig ? (
                            <div className="grid grid-cols-3 gap-4 max-w-md">
                              {(["A", "B", "C"] as const).map((grade) => (
                                <div key={grade} className="space-y-1">
                                  <span className="text-xs text-muted-foreground">見込 {grade}</span>
                                  <div className="flex items-center gap-1.5">
                                    <Input
                                      type="number"
                                      min={0}
                                      max={100}
                                      step={1}
                                      className="tabular-nums"
                                      value={biConfig.prospect_grade_rates[grade]}
                                      onChange={(e) =>
                                        setBiConfig((prev) => prev && ({
                                          ...prev,
                                          prospect_grade_rates: {
                                            ...prev.prospect_grade_rates,
                                            [grade]: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                                          },
                                        }))
                                      }
                                    />
                                    <span className="text-sm text-muted-foreground">%</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <Skeleton className="h-9 w-full max-w-md" />
                          )}
                        </div>
                        <div className="space-y-2 sm:col-span-3 pt-2 border-t border-border">
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
        </div>
        )}

        {/* ── セキュリティ（パスワード変更） ─── */}
        {subTab === "security" && (
          <Card className="gap-2 py-3">
            <CardHeader className="min-h-8 border-b border-border/60 px-5 py-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-primary" />
                パスワード変更
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-5 pb-3 pt-3">
              <p className="text-xs text-muted-foreground">
                Google ログインを使用している場合、パスワード変更は不要です。
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end max-w-3xl">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">新しいパスワード</Label>
                  <Input
                    className="h-8"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="6文字以上"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">新しいパスワード（確認）</Label>
                  <Input
                    className="h-8"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="もう一度入力"
                  />
                </div>
                <Button
                  size="sm"
                  className="h-8 shrink-0"
                  onClick={handleChangePassword}
                  disabled={savingPassword || !newPassword || newPassword !== confirmPassword}
                >
                  <Lock className="size-3.5 mr-1" />
                  {savingPassword ? "変更中..." : "パスワードを変更"}
                </Button>
              </div>
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">パスワードが一致しません</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── 通知 ─── */}
        {subTab === "notifications" && (
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
        )}

        {/* ── メール署名 ─── */}
        {subTab === "mail_signature" && (
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
        )}

        {/* ── PDF編集 ─── */}
        {canManageMembers && subTab === "pdf_builder" && (
            <PdfBuilderTab />
        )}

    </TabsContent> {/* ── personal outer group ── */}

    {/* ── 組織グループ ─── */}
    {canManageMembers && visitedMain.has("organization") && (
      <TabsContent value="organization" forceMount className="mt-0 data-[state=inactive]:hidden">
          {subTab === "members" && (
          <div className="space-y-4">
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
                          const avatarColor = getCustomerAvatarColor(m.role);
                          return (
                            <tr key={m.id} className="border-t hover:bg-muted/30">
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-2.5">
                                  <CustomerAvatar seed={m.role} name={m.display_name} size="sm" />
                                  <div>
                                    <div className="font-medium">{m.display_name}</div>
                                    {(m.department || m.position) && (
                                      <div className="text-xs text-muted-foreground">
                                        {[m.department, m.position].filter(Boolean).join(" / ")}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-muted-foreground">{m.email}</td>
                              <td className="px-3 py-2.5">
                                {canEditThis ? (
                                  <Select
                                    value={m.role}
                                    onValueChange={(v) => void handleChangeRole(m, v as TeamRole)}
                                    disabled={updatingRoleId === m.id}
                                  >
                                    <SelectTrigger
                                      className="h-7 data-[size=default]:h-7 py-0 text-xs px-2 border-0 gap-1 [&>svg:last-child]:hidden text-white"
                                      style={{ background: avatarColor.avatarGradient }}
                                    >
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {ASSIGNABLE_TEAM_ROLES.map((role) => (
                                        <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="h-7 px-2 text-xs rounded-md border-0 text-white"
                                    style={{ background: avatarColor.avatarGradient }}
                                  >
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

            {/* ロール・権限設定（重いのでメンバー一覧の後に描画） */}
            {!permsReady ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lock className="h-4 w-4 text-primary" />
                    ロール・権限設定
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-40 w-full" />
                </CardContent>
              </Card>
            ) : (
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
                    {SYSTEM_PERMISSION_ROLES.map((role) => {
                      const p = getCustomerAvatarColor(role);
                      return (
                        <div key={role} className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-white" style={{ background: p.avatarGradient }}>
                          {ROLE_LABELS[role]}
                        </div>
                      );
                    })}
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
                  const allCols: Array<{ key: string; label: string; palette: ReturnType<typeof getCustomerAvatarColor> }> = [
                    ...SYSTEM_PERMISSION_ROLES.map((role) => ({ key: role, label: ROLE_LABELS[role], palette: getCustomerAvatarColor(role) })),
                    ...customRoles.map((cr) => ({ key: cr.id, label: cr.name, palette: getCustomerAvatarColor(cr.id) })),
                  ];
                  const featureRows = [
                    ...NAV_GROUPS.flatMap((g, gi) => g.items.map((item, idx) => ({ key: item.key, label: item.label, group: idx === 0 ? g.label : null, groupStart: idx === 0, gi }))),
                    { key: "settings_member", label: "メンバー管理", group: "設定・管理", groupStart: true, gi: 99 },
                    { key: "settings_company", label: "会社情報編集", group: null, groupStart: false, gi: 99 },
                    { key: "settings_attendance", label: "勤怠設定", group: null, groupStart: false, gi: 99 },
                    { key: "settings_workflow", label: "ワークフロー設定", group: null, groupStart: false, gi: 99 },
                    { key: "settings_crm", label: "CRM/職人マスタ", group: null, groupStart: false, gi: 99 },
                    { key: "reserve_fee", label: "予備費設定", group: null, groupStart: false, gi: 99 },
                  ];
                  return (
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-xs text-muted-foreground">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium sticky left-0 bg-muted/40 z-10">機能</th>
                            {allCols.map((col) => (
                              <th key={col.key} className="text-center px-1.5 py-2 font-medium min-w-[80px]">
                                <span className="inline-block px-1.5 py-0.5 rounded text-[11px] text-white" style={{ background: col.palette.avatarGradient }}>{col.label}</span>
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
            )}

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
          </div>
          )}

          {/* 勤怠設定 */}
          {subTab === "attendance_settings" && (
          <div className="space-y-4">
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
          </div>
          )}

          {/* ワークフロー */}
          {subTab === "workflow_types" && (
            <WorkflowTypesTab />
          )}

        {/* メンバー招待ダイアログ */}
        <Dialog open={addOpen} onOpenChange={(open) => { if (!open) { setAddOpen(false); setInviteSent(false); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>メンバーを招待</DialogTitle>
              <DialogDescription>
                招待メールを送信します。受信者がリンクからパスワードを設定して参加します。
              </DialogDescription>
            </DialogHeader>
            {inviteSent ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 space-y-1">
                  <div className="flex items-center gap-2 font-semibold"><Send className="h-4 w-4" />{inviteLinkFallback ? "招待を作成しました" : "招待メールを送信しました"}</div>
                  <p className="text-xs">{inviteLinkFallback ? <>メールは送信されていません。下記の招待リンクを <span className="font-medium">{newEmail}</span> へ直接共有してください。</> : <><span className="font-medium">{newEmail}</span> に招待リンクを送信しました。受信者がリンクからパスワードを設定します。</>}</p>
                </div>
                {inviteLinkFallback && (
                  <div className="rounded-lg border bg-muted/30 px-3 py-2 space-y-1.5">
                    <p className="text-[11px] text-muted-foreground break-all">{inviteLinkFallback}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        void navigator.clipboard.writeText(inviteLinkFallback);
                        toast.success("招待リンクをコピーしました");
                      }}
                    >
                      招待リンクをコピー
                    </Button>
                  </div>
                )}
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
                    <p className="text-[11px] text-muted-foreground">このアドレス宛に招待リンクを送信します。受信者がパスワードを設定します。</p>
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
    {canManageMembers && visitedMain.has("master") && (
      <TabsContent value="master" forceMount className="mt-0 data-[state=inactive]:hidden">
          {subTab === "crm_master" && <CrmMasterTab initialData={initialCrmMaster} />}
          {subTab === "craftsmen_master" && <CraftsmenMasterTab initialData={initialCraftsmenMaster} />}
      </TabsContent>
    )}

    {/* ── 連携グループ ─── */}
    {canManageMembers && visitedMain.has("integrations_group") && (
      <TabsContent value="integrations_group" forceMount className="mt-0 data-[state=inactive]:hidden">
          {subTab === "app_integrations" && <AppIntegrationsTab initialData={initialAppIntegrations} />}
          {subTab === "integrations" && <IntegrationsTab />}
      </TabsContent>
    )}

      </Tabs> {/* ── 外側 group Tabs ── */}
    </div>
  );
}

