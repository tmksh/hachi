"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  getAdminStats,
  getAdminCompanies,
  getAdminUsers,
  getAdminBiOverview,
  getAdminBiCompanyRanking,
  getAdminBiMonthlyTrend,
  getAdminBiStatusBreakdown,
  getAdminBiGrossRateDistribution,
  createAdminCompany,
  deleteAdminCompany,
} from "@/lib/actions/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Building2,
  Users,
  HardHat,
  FileText,
  ShieldCheck,
  TrendingUp,
  Activity,
  Wallet,
  Percent,
  Plus,
  Trash2,
  Loader2,
  Download,
  BarChart3,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
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

const STATUS_LABEL: Record<string, string> = {
  preparing: "準備中",
  in_progress: "進行中",
  completed: "完了",
  suspended: "中止",
  delayed: "遅延",
};

const PIE_COLORS = ["#0F5132", "#1A7A52", "#2D9E6B", "#4DB88A", "#7DCFAA", "#A8DFC5"];

type BiOverview = Awaited<ReturnType<typeof getAdminBiOverview>>;
type BiRanking = Awaited<ReturnType<typeof getAdminBiCompanyRanking>>;
type BiTrend = Awaited<ReturnType<typeof getAdminBiMonthlyTrend>>;
type BiStatus = Awaited<ReturnType<typeof getAdminBiStatusBreakdown>>;
type BiDist = Awaited<ReturnType<typeof getAdminBiGrossRateDistribution>>;

function extractErrorMessage(e: unknown): string {
  if (typeof e === "string") return e;
  if (e instanceof Error) {
    const ext = e as Error & { code?: string; details?: string; hint?: string };
    const parts: string[] = [];
    if (e.message) parts.push(e.message);
    if (ext.details && typeof ext.details === "string") parts.push(`詳細: ${ext.details}`);
    if (ext.hint && typeof ext.hint === "string") parts.push(`ヒント: ${ext.hint}`);
    if (ext.code && typeof ext.code === "string") parts.push(`コード: ${ext.code}`);
    return parts.length > 0 ? parts.join(" / ") : "不明なエラー";
  }
  if (typeof e === "object" && e !== null) {
    const o = e as Record<string, unknown>;
    const msg = typeof o.message === "string" && o.message ? o.message
      : typeof o.error_description === "string" && o.error_description ? o.error_description
      : null;
    if (msg) return msg;
    try { return JSON.stringify(o, null, 2); } catch { /* ignore */ }
  }
  return "管理データの取得に失敗しました";
}

const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function downloadCsv(filename: string, rows: string[][]) {
  const bom = "\uFEFF";
  const csv = bom + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [stats, setStats] = useState<{ companyCount: number; userCount: number; constructionCount: number; contractCount: number } | null>(null);
  const [companies, setCompanies] = useState<Array<{ id: string; name: string; plan: string | null; created_at: string }>>([]);
  const [users, setUsers] = useState<Array<{ id: string; display_name: string; email: string; role: string; company_id: string; created_at: string; companies: { name: string } | null }>>([]);
  const [bi, setBi] = useState<BiOverview | null>(null);
  const [biRanking, setBiRanking] = useState<BiRanking>([]);
  const [biTrend, setBiTrend] = useState<BiTrend>([]);
  const [biStatus, setBiStatus] = useState<BiStatus | null>(null);
  const [biDist, setBiDist] = useState<BiDist>([]);
  const [addDialog, setAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({ companyName: "", plan: "", slug: "", ownerName: "", ownerEmail: "", ownerPassword: "" });
  const [addSaving, setAddSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    const [s, c, u, ov, rank, trend, status, dist] = await Promise.all([
      getAdminStats(), getAdminCompanies(), getAdminUsers(),
      getAdminBiOverview(), getAdminBiCompanyRanking(),
      getAdminBiMonthlyTrend(), getAdminBiStatusBreakdown(),
      getAdminBiGrossRateDistribution(),
    ]);
    setStats(s); setCompanies(c ?? []); setUsers(u ?? []);
    setBi(ov); setBiRanking(rank); setBiTrend(trend); setBiStatus(status); setBiDist(dist);
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/admin/login"); return; }
      if (user.email !== "super-admin@example.com") { router.replace("/unauthorized"); return; }
      loadData().catch((e) => {
        setErrorMsg(extractErrorMessage(e));
        setLoading(false);
      });
    });
  }, [router, loadData]);

  const handleAddCompany = async () => {
    if (!addForm.companyName.trim() || !addForm.ownerName.trim() || !addForm.ownerEmail.trim() || !addForm.ownerPassword.trim()) return;
    setAddSaving(true);
    try {
      await createAdminCompany({
        companyName: addForm.companyName.trim(), plan: addForm.plan || null,
        slug: addForm.slug.trim() || null, ownerName: addForm.ownerName.trim(),
        ownerEmail: addForm.ownerEmail.trim(), ownerPassword: addForm.ownerPassword,
      });
      setAddDialog(false);
      setAddForm({ companyName: "", plan: "", slug: "", ownerName: "", ownerEmail: "", ownerPassword: "" });
      await loadData();
    } catch (e) { setErrorMsg(extractErrorMessage(e)); }
    finally { setAddSaving(false); }
  };

  const handleDeleteCompany = async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？\n\n⚠️ この企業に紐づくすべてのデータが削除されます。`)) return;
    setDeletingId(id);
    try { await deleteAdminCompany(id); await loadData(); }
    catch (e) { setErrorMsg(extractErrorMessage(e)); }
    finally { setDeletingId(null); }
  };

  const exportCompaniesCsv = () => {
    const headers = ["企業名", "プラン", "ユーザー数", "登録日"];
    const rows = companies.map((c) => [
      c.name,
      c.plan ?? "Free",
      String(users.filter((u) => u.company_id === c.id).length),
      format(new Date(c.created_at), "yyyy/MM/dd", { locale: ja }),
    ]);
    downloadCsv(`companies_${format(new Date(), "yyyyMMdd")}.csv`, [headers, ...rows]);
  };

  const exportUsersCsv = () => {
    const headers = ["名前", "メール", "ロール", "企業", "登録日"];
    const rows = users.map((u) => [
      u.display_name,
      u.email,
      ROLE_LABELS[u.role] ?? u.role,
      u.companies?.name ?? "",
      format(new Date(u.created_at), "yyyy/MM/dd", { locale: ja }),
    ]);
    downloadCsv(`users_${format(new Date(), "yyyyMMdd")}.csv`, [headers, ...rows]);
  };

  const exportBiCsv = () => {
    if (!biRanking.length) return;
    const headers = ["順位", "加盟店名", "工事件数", "完了件数", "受注額", "粗利", "粗利率", "平均単価"];
    const rows = biRanking.map((r, i) => [
      String(i + 1),
      r.companyName,
      String(r.constructionCount),
      String(r.completedCount),
      String(Math.round(r.revenue)),
      String(Math.round(r.gross)),
      r.revenue > 0 ? pct(r.grossRate) : "—",
      r.constructionCount > 0 ? String(Math.round(r.avgUnitPrice)) : "—",
    ]);
    downloadCsv(`bi_ranking_${format(new Date(), "yyyyMMdd")}.csv`, [headers, ...rows]);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <PageHeader title="管理コンソール" description="プラットフォーム全体の管理 / 全国加盟店BI">
        <Badge className="bg-amber-100 text-amber-700 border border-amber-200 text-xs">
          <ShieldCheck className="h-3 w-3 mr-1" />
          BRIDGE 運営
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-4 w-4" />
              レポート出力
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={exportBiCsv} disabled={!biRanking.length}>
              <FileText className="h-4 w-4 mr-2" />
              加盟店BI（CSV）
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportCompaniesCsv} disabled={!companies.length}>
              <Building2 className="h-4 w-4 mr-2" />
              企業一覧（CSV）
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportUsersCsv} disabled={!users.length}>
              <Users className="h-4 w-4 mr-2" />
              ユーザー一覧（CSV）
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </PageHeader>

      {/* Error */}
      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 space-y-1">
          <p className="font-semibold">管理データの取得でエラーが発生しました</p>
          <p className="text-xs break-all">{errorMsg}</p>
        </div>
      )}

      {/* Top KPIs */}
      <Card className="stat-card transition-[box-shadow,background-color] duration-200 py-0">
        <CardContent className="py-2">
          <div className="grid grid-cols-2 lg:grid-cols-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-4 first:pl-0 last:pr-0 space-y-1.5 py-3">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-6 w-24" />
                </div>
              ))
            ) : (
              [
                { label: "登録企業数", value: String(stats?.companyCount ?? 0), icon: Building2 },
                { label: "総ユーザー数", value: String(stats?.userCount ?? 0), icon: Users },
                { label: "工事案件数", value: String(stats?.constructionCount ?? 0), icon: HardHat },
                { label: "契約書数", value: String(stats?.contractCount ?? 0), icon: FileText },
              ].map((kpi, i) => (
                <div key={i} className="px-4 rounded-lg transition-all duration-300 cursor-default hover:-translate-y-0.5 hover:shadow-[0_0_12px_2px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_0_12px_2px_rgba(255,255,255,0.06)]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{kpi.label}</span>
                    <div className="neumorph-icon h-8 w-8">
                      <kpi.icon className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold tabular-nums tracking-tight">{kpi.value}</p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="bi">
        <TabsList>
          <TabsTrigger value="bi">全国 BI</TabsTrigger>
          <TabsTrigger value="companies">企業一覧</TabsTrigger>
        </TabsList>

        {/* BI タブ */}
        <TabsContent value="bi" className="space-y-6 mt-4">
          {loading || !bi ? (
            <>
              <Card className="stat-card transition-[box-shadow,background-color] duration-200 py-0">
                <CardContent className="py-2">
                  <div className="grid grid-cols-2 lg:grid-cols-4">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="px-4 space-y-1.5 py-3">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-6 w-28" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card className="stat-card transition-[box-shadow,background-color] duration-200 py-0">
                <CardContent className="py-2">
                  <div className="grid grid-cols-2 lg:grid-cols-4">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="px-4 space-y-1.5 py-3">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-6 w-28" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <Card className="stat-card transition-[box-shadow,background-color] duration-200 py-0">
                <CardContent className="py-2">
                  <div className="grid grid-cols-2 lg:grid-cols-4">
                    <BiKpi label="総受注金額" value={yen(bi.totalRevenue)} sub={`${bi.constructionCount}件の合計`} icon={Wallet} />
                    <BiKpi label="総粗利" value={yen(bi.totalGross)} sub={`加重粗利率 ${pct(bi.grossRateWeighted)}`} icon={TrendingUp} />
                    <BiKpi label="平均工事単価" value={yen(bi.avgUnitPrice)} sub={`全国 ${bi.companyCount}社`} icon={HardHat} />
                    <BiKpi label="加盟店平均粗利率" value={pct(bi.grossRateAvg)} sub="(各社単純平均)" icon={Percent} />
                  </div>
                </CardContent>
              </Card>
              <Card className="stat-card transition-[box-shadow,background-color] duration-200 py-0">
                <CardContent className="py-2">
                  <div className="grid grid-cols-2 lg:grid-cols-4">
                    <BiKpi label="アクティブ社数" value={`${bi.activeCompanyCount} / ${bi.companyCount}`} sub="直近30日に工事登録のある社" icon={Activity} />
                    <BiKpi label="進行中工事" value={`${bi.inProgressCount}`} sub={`完了: ${bi.completedCount} / 遅延: ${bi.delayedCount}`} icon={HardHat} />
                    <BiKpi label="登録顧客数" value={`${bi.customerCount.toLocaleString()}`} sub="全社合計" icon={Users} />
                    <BiKpi label="総原価" value={yen(bi.totalCost)} sub={`粗利 ${yen(bi.totalGross)}`} icon={Wallet} />
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* チャート Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />月次トレンド（直近12ヶ月）
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-[280px] w-full" /> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={biTrend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 12 }} tickFormatter={(v: number) => v >= 1_000_000 ? `${Math.round(v / 1_000_000)}M` : v >= 1000 ? `${Math.round(v / 1000)}K` : `${v}`} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                      <RTooltip formatter={(value, name) => { const v = typeof value === "number" ? value : 0; return name === "件数" ? `${v}件` : yen(v); }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line yAxisId="left" type="monotone" dataKey="revenue" name="受注額" stroke="#0F5132" strokeWidth={2} dot={{ r: 3, fill: "#0F5132" }} />
                      <Line yAxisId="left" type="monotone" dataKey="gross" name="粗利" stroke="#2D9E6B" strokeWidth={2} dot={{ r: 3, fill: "#2D9E6B" }} />
                      <Line yAxisId="right" type="monotone" dataKey="count" name="件数" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: "#f59e0b" }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <HardHat className="h-4 w-4 text-primary" />工事ステータス分布
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading || !biStatus ? <Skeleton className="h-[280px] w-full" /> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={Object.entries(biStatus).map(([k, v]) => ({ name: STATUS_LABEL[k] ?? k, value: v, key: k }))}
                        dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3}
                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {Object.keys(biStatus).map((k, i) => <Cell key={k} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <RTooltip formatter={(v) => `${typeof v === "number" ? v : 0}件`} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* チャート Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Percent className="h-4 w-4 text-primary" />加盟店粗利率分布
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-[220px] w-full" /> : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={biDist} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <RTooltip formatter={(v) => `${typeof v === "number" ? v : 0}社`} />
                      <Bar dataKey="count" name="社数" fill="#0F5132" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between w-full">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />加盟店ランキング（受注額順）
                  </CardTitle>
                  <span className="text-[11px] text-muted-foreground">{biRanking.length}社</span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-[11px] text-muted-foreground">
                          <th className="px-4 py-2 text-left w-10">#</th>
                          <th className="px-4 py-2 text-left">加盟店</th>
                          <th className="px-4 py-2 text-right">工事</th>
                          <th className="px-4 py-2 text-right">受注額</th>
                          <th className="px-4 py-2 text-right">粗利</th>
                          <th className="px-4 py-2 text-right">粗利率</th>
                          <th className="px-4 py-2 text-right">平均単価</th>
                        </tr>
                      </thead>
                      <tbody>
                        {biRanking.length === 0 ? (
                          <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">データがありません</td></tr>
                        ) : biRanking.slice(0, 20).map((r, i) => (
                          <tr key={r.companyId} className="border-b hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-2.5 text-xs text-muted-foreground tabular-nums">{i + 1}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                  <Building2 className="h-3 w-3 text-primary" />
                                </div>
                                <span className="text-xs font-medium truncate">{r.companyName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs tabular-nums">{r.constructionCount}<span className="text-muted-foreground"> ({r.completedCount})</span></td>
                            <td className="px-4 py-2.5 text-right text-xs tabular-nums font-medium">{yen(r.revenue)}</td>
                            <td className={cn("px-4 py-2.5 text-right text-xs tabular-nums", r.gross < 0 && "text-rose-600")}>{yen(r.gross)}</td>
                            <td className={cn("px-4 py-2.5 text-right text-xs tabular-nums", r.grossRate < 0 ? "text-rose-600" : r.grossRate >= 0.2 ? "text-emerald-600" : "")}>{r.revenue > 0 ? pct(r.grossRate) : "—"}</td>
                            <td className="px-4 py-2.5 text-right text-xs tabular-nums text-muted-foreground">{r.constructionCount > 0 ? yen(r.avgUnitPrice) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 企業一覧タブ */}
        <TabsContent value="companies" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button size="sm" className="gap-1.5" onClick={() => setAddDialog(true)}>
              <Plus className="h-4 w-4" />企業を追加
            </Button>
          </div>
          <Card variant="inset">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">企業名</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">プラン</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">ユーザー数</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">登録日</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {companies.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">企業がありません</td></tr>
                      ) : companies.map((c) => {
                        const memberCount = users.filter((u) => u.company_id === c.id).length;
                        return (
                          <tr key={c.id} className="border-b hover:bg-muted/30 transition-colors group">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                  <Building2 className="h-3.5 w-3.5 text-primary" />
                                </div>
                                <span className="text-sm font-medium">{c.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{c.plan ?? "Free"}</Badge></td>
                            <td className="px-4 py-3 text-sm tabular-nums">{memberCount}名</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">{format(new Date(c.created_at), "yyyy/MM/dd", { locale: ja })}</td>
                            <td className="pr-2 py-3">
                              <button onClick={() => handleDeleteCompany(c.id, c.name)} disabled={deletingId === c.id} className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-rose-100 text-slate-400 hover:text-rose-500 transition-all">
                                {deletingId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                              </button>
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

        {/* ユーザー一覧タブ */}
        <TabsContent value="users" className="mt-4">
          <Card variant="inset">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">名前</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">メール</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">ロール</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">企業</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">登録日</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">ユーザーがありません</td></tr>
                      ) : users.map((u) => (
                        <tr key={u.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-semibold text-primary">
                                {u.display_name.charAt(0)}
                              </div>
                              <span className="text-sm font-medium">{u.display_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{u.email}</td>
                          <td className="px-4 py-3"><Badge variant="outline" className={cn("text-[10px]", ROLE_COLORS[u.role] ?? "bg-gray-100 text-gray-600")}>{ROLE_LABELS[u.role] ?? u.role}</Badge></td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{u.companies?.name ?? "—"}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">{format(new Date(u.created_at), "yyyy/MM/dd", { locale: ja })}</td>
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

      {/* 企業追加ダイアログ */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>企業を追加</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">企業情報</Label>
              <Input placeholder="企業名 *" value={addForm.companyName} onChange={(e) => setAddForm((f) => ({ ...f, companyName: e.target.value }))} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">プラン</Label>
              <Select value={addForm.plan || "_none"} onValueChange={(v) => setAddForm((f) => ({ ...f, plan: v === "_none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="プランを選択" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Free</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">サブドメイン slug <span className="text-muted-foreground font-normal">（任意）</span></Label>
              <Input placeholder="acme-construction" value={addForm.slug} onChange={(e) => setAddForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))} />
            </div>
            <div className="border-t pt-4 space-y-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">オーナーアカウント</Label>
              <Input placeholder="担当者名 *" value={addForm.ownerName} onChange={(e) => setAddForm((f) => ({ ...f, ownerName: e.target.value }))} />
              <Input type="email" placeholder="メールアドレス *" value={addForm.ownerEmail} onChange={(e) => setAddForm((f) => ({ ...f, ownerEmail: e.target.value }))} />
              <Input type="password" placeholder="初期パスワード（6文字以上）*" value={addForm.ownerPassword} onChange={(e) => setAddForm((f) => ({ ...f, ownerPassword: e.target.value }))} />
              <p className="text-[11px] text-muted-foreground">※ このアカウントが「オーナー」権限で作成されます。</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialog(false)} disabled={addSaving}>キャンセル</Button>
            <Button onClick={handleAddCompany} disabled={addSaving || !addForm.companyName.trim() || !addForm.ownerName.trim() || !addForm.ownerEmail.trim() || addForm.ownerPassword.length < 6}>
              {addSaving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}作成する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BiKpi({ label, value, sub, icon: Icon }: { label: string; value: string; sub?: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="px-4 rounded-lg transition-all duration-300 cursor-default hover:-translate-y-0.5 hover:shadow-[0_0_12px_2px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_0_12px_2px_rgba(255,255,255,0.06)]">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
      <p className="text-xl font-bold tabular-nums tracking-tight">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
    </div>
  );
}
