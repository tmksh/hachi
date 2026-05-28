"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Save, Users } from "lucide-react";
import { createAnnouncement } from "@/lib/actions/announcements";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/constants";
import { cn } from "@/lib/utils";

type TargetType = "all" | "roles";

const ROLE_ORDER: Role[] = [
  ROLES.HQ_ADMIN,
  ROLES.CONTRACTOR_ADMIN,
  ROLES.EMPLOYEE,
];

const ROLE_DESCRIPTIONS: Partial<Record<Role, string>> = {
  hq_admin: "本社スタッフ（本部管理者）",
  contractor_admin: "施工店責任者",
  employee: "一般スタッフ",
  admin: "システム全体の管理者",
  executive: "経営層・役員",
  sales: "営業担当",
  field_manager: "現場責任者",
  designer: "設計士",
  administration: "総務",
  external_partner: "外部協力業者",
};

export default function CirculationNewPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);
  const [targetType, setTargetType] = useState<TargetType>("all");
  const [targetRoles, setTargetRoles] = useState<Set<Role>>(new Set());
  const [dueDate, setDueDate] = useState("");

  const toggleRole = (role: Role) => {
    setTargetRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  };

  const selectAllRoles = () => setTargetRoles(new Set(ROLE_ORDER));
  const clearRoles = () => setTargetRoles(new Set());

  const handleSave = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("タイトルと本文を入力してください");
      return;
    }
    if (targetType === "roles" && targetRoles.size === 0) {
      toast.error("通知対象のロールを1つ以上選択してください");
      return;
    }
    setSaving(true);
    try {
      await createAnnouncement({
        title: title.trim(),
        body: body.trim(),
        pinned,
        is_urgent: isUrgent,
        target_type: targetType,
        target_roles: targetType === "roles" ? Array.from(targetRoles) : [],
        due_date: dueDate || undefined,
      });
      toast.success(
        targetType === "all"
          ? "全員に投稿しました"
          : `${targetRoles.size}ロールに通知を送信しました`
      );
      router.push("/circulation");
    } catch {
      toast.error("投稿に失敗");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/circulation">
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">新規お知らせ</h1>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">内容</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>タイトル *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>本文 *</Label>
            <Textarea
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            通知対象
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTargetType("all")}
              className={cn(
                "flex-1 rounded-lg border p-3 text-left transition-colors",
                targetType === "all"
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "hover:bg-muted/40"
              )}
            >
              <div className="text-sm font-semibold">全員に通知</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                会社全ユーザーに表示・通知されます
              </div>
            </button>
            <button
              type="button"
              onClick={() => setTargetType("roles")}
              className={cn(
                "flex-1 rounded-lg border p-3 text-left transition-colors",
                targetType === "roles"
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "hover:bg-muted/40"
              )}
            >
              <div className="text-sm font-semibold">権限（ロール）で絞る</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                選択したロールのユーザーのみに通知されます
              </div>
            </button>
          </div>

          {targetType === "roles" && (
            <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  対象ロールを選択 ({targetRoles.size}/{ROLE_ORDER.length})
                </span>
                <div className="flex gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={selectAllRoles}
                    className="text-primary hover:underline"
                  >
                    全て選択
                  </button>
                  <button
                    type="button"
                    onClick={clearRoles}
                    className="text-muted-foreground hover:underline"
                  >
                    クリア
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ROLE_ORDER.map((role) => {
                  const active = targetRoles.has(role);
                  return (
                    <label
                      key={role}
                      className={cn(
                        "flex items-start gap-2 rounded-md border bg-background p-2.5 cursor-pointer transition-colors",
                        active
                          ? "border-primary/50 ring-1 ring-primary/20"
                          : "hover:bg-muted/40"
                      )}
                    >
                      <Checkbox
                        checked={active}
                        onCheckedChange={() => toggleRole(role)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">
                            {ROLE_LABELS[role]}
                          </span>
                          <code className="text-[10px] text-muted-foreground font-mono">
                            {role}
                          </code>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                          {ROLE_DESCRIPTIONS[role]}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">オプション</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>期限</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={pinned} onCheckedChange={setPinned} />
              <Label>ピン留め</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isUrgent} onCheckedChange={setIsUrgent} />
              <Label>緊急</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Link href="/circulation">
          <Button variant="outline">キャンセル</Button>
        </Link>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="size-4 mr-1" />
          {saving ? "投稿中..." : "投稿"}
        </Button>
      </div>
    </div>
  );
}
