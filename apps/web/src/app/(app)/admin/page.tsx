"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getAdminStats, getAdminCompanies, getAdminUsers } from "@/lib/actions/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Users, HardHat, FileText, ShieldCheck, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<string, string> = {
  owner: "オーナー",
  hq_admin: "本部管理者",
  contractor_admin: "施工店管理者",
  employee: "一般社員",
};

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-violet-100 text-violet-700 border-violet-200",
  hq_admin: "bg-blue-100 text-blue-700 border-blue-200",
  contractor_admin: "bg-emerald-100 text-emerald-700 border-emerald-200",
  employee: "bg-gray-100 text-gray-600 border-gray-200",
};

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ companyCount: number; userCount: number; constructionCount: number; contractCount: number } | null>(null);
  const [companies, setCompanies] = useState<Array<{ id: string; name: string; plan: string | null; created_at: string }>>([]);
  const [users, setUsers] = useState<Array<{ id: string; display_name: string; email: string; role: string; company_id: string; created_at: string; companies: { name: string } | null }>>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || user.email !== "admin@example.com") {
        router.replace("/dashboard");
        return;
      }
      Promise.all([getAdminStats(), getAdminCompanies(), getAdminUsers()])
        .then(([s, c, u]) => {
          setStats(s);
          setCompanies(c ?? []);
          setUsers(u ?? []);
        })
        .catch(() => router.replace("/dashboard"))
        .finally(() => setLoading(false));
    });
  }, [router]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-amber-100 flex items-center justify-center">
          <ShieldCheck className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">管理コンソール</h1>
          <p className="text-xs text-muted-foreground mt-0.5">プラットフォーム全体の管理</p>
        </div>
        <Badge className="ml-2 bg-amber-100 text-amber-700 border-amber-200 text-xs">
          Super Admin
        </Badge>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "登録企業数", value: stats.companyCount, icon: Building2, color: "text-blue-600 bg-blue-50" },
            { label: "総ユーザー数", value: stats.userCount, icon: Users, color: "text-violet-600 bg-violet-50" },
            { label: "工事案件数", value: stats.constructionCount, icon: HardHat, color: "text-emerald-600 bg-emerald-50" },
            { label: "契約書数", value: stats.contractCount, icon: FileText, color: "text-amber-600 bg-amber-50" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="py-4 px-5 flex items-center gap-4">
                <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-2xl font-bold tabular-nums">{value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="companies">
        <TabsList>
          <TabsTrigger value="companies" className="text-xs">
            企業一覧
          </TabsTrigger>
          <TabsTrigger value="users" className="text-xs">
            ユーザー一覧
          </TabsTrigger>
        </TabsList>

        {/* 企業一覧 */}
        <TabsContent value="companies" className="mt-4">
          <Card variant="inset">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-3">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
                </div>
              ) : (
                <div className="relative w-full overflow-x-auto">
                  <table className="w-full caption-bottom text-sm">
                    <thead>
                      <tr className="border-b border-white/30">
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">企業名</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">プラン</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">ユーザー数</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">登録日</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companies.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-12 text-center text-sm text-muted-foreground">
                            企業がありません
                          </td>
                        </tr>
                      ) : companies.map((c) => {
                        const memberCount = users.filter((u) => u.company_id === c.id).length;
                        return (
                          <tr key={c.id} className="border-b border-white/20 hover:bg-white/30 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                  <Building2 className="h-3.5 w-3.5 text-primary" />
                                </div>
                                <span className="text-sm font-medium">{c.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className="text-xs">
                                {c.plan ?? "Free"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-sm tabular-nums">
                              {memberCount}名
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                              {format(new Date(c.created_at), "yyyy/MM/dd", { locale: ja })}
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

        {/* ユーザー一覧 */}
        <TabsContent value="users" className="mt-4">
          <Card variant="inset">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-3">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
                </div>
              ) : (
                <div className="relative w-full overflow-x-auto">
                  <table className="w-full caption-bottom text-sm">
                    <thead>
                      <tr className="border-b border-white/30">
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">名前</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">メール</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">ロール</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">企業</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">登録日</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                            ユーザーがありません
                          </td>
                        </tr>
                      ) : users.map((u) => (
                        <tr key={u.id} className="border-b border-white/20 hover:bg-white/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-semibold text-primary">
                                {u.display_name.charAt(0)}
                              </div>
                              <span className="text-sm font-medium">{u.display_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{u.email}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={cn("text-[10px]", ROLE_COLORS[u.role] ?? "bg-gray-100 text-gray-600")}>
                              {ROLE_LABELS[u.role] ?? u.role}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {u.companies?.name ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                            {format(new Date(u.created_at), "yyyy/MM/dd", { locale: ja })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
