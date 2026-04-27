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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Building2,
  Users,
  HardHat,
  FileText,
  ShieldCheck,
  TrendingUp,
  Activity,
  Wallet,
  Percent,
  BarChart3,
  Plus,
  Trash2,
  Loader2,
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

const STATUS_COLOR: Record<string, string> = {
  preparing: "#94a3b8",
  in_progress: "#3b82f6",
  completed: "#10b981",
  suspended: "#6b7280",
  delayed: "#f43f5e",
};

type BiOverview = Awaited<ReturnType<typeof getAdminBiOverview>>;
type BiRanking = Awaited<ReturnType<typeof getAdminBiCompanyRanking>>;
type BiTrend = Awaited<ReturnType<typeof getAdminBiMonthlyTrend>>;
type BiStatus = Awaited<ReturnType<typeof getAdminBiStatusBreakdown>>;
type BiDist = Awaited<ReturnType<typeof getAdminBiGrossRateDistribution>>;

/** Supabase の PostgrestError を含むあらゆる error 値から表示用文字列を作る */
function extractErrorMessage(e: unknown): string {
  if (typeof e === "string") return e;
  if (e instanceof Error) {
    // PostgrestError は Error を継承しているので message を持つ
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
    try {
      return JSON.stringify(o, null, 2);
    } catch {
      /* ignore */
    }
  }
  return "管理データの取得に失敗しました";
}

const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

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

  // 企業追加ダイアログ
  const [addDialog, setAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({ companyName: "", plan: "", slug: "", ownerName: "", ownerEmail: "", ownerPassword: "" });
  const [addSaving, setAddSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    const s = await getAdminStats();
    setStats(s);
    const c = await getAdminCompanies();
    setCompanies(c ?? []);
    const u = await getAdminUsers();
    setUsers(u ?? []);
    const ov = await getAdminBiOverview();
    setBi(ov);
    const rank = await getAdminBiCompanyRanking();
    setBiRanking(rank);
    const trend = await getAdminBiMonthlyTrend();
    setBiTrend(trend);
    const status = await getAdminBiStatusBreakdown();
    setBiStatus(status);
    const dist = await getAdminBiGrossRateDistribution();
    setBiDist(dist);
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || user.email !== "admin@example.com") {
        router.replace("/dashboard");
        return;
      }
      loadData().catch((e) => {
        console.error("[admin] failed to load:", e);
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
        companyName: addForm.companyName.trim(),
        plan: addForm.plan || null,
        slug: addForm.slug.trim() || null,
        ownerName: addForm.ownerName.trim(),
        ownerEmail: addForm.ownerEmail.trim(),
        ownerPassword: addForm.ownerPassword,
      });
      setAddDialog(false);
      setAddForm({ companyName: "", plan: "", slug: "", ownerName: "", ownerEmail: "", ownerPassword: "" });
      await loadData();
    } catch (e) {
      console.error("[admin] createCompany error:", e);
      setErrorMsg(extractErrorMessage(e));
    } finally {
      setAddSaving(false);
    }
  };

  const handleDeleteCompany = async (companyId: string, companyName: string) => {
    if (!confirm(`「${companyName}」を削除しますか？\n\n⚠️ この企業に紐づくすべてのユーザー・データが削除されます。`)) return;
    setDeletingId(companyId);
    try {
      await deleteAdminCompany(companyId);
      await loadData();
    } catch (e) {
      console.error("[admin] deleteCompany error:", e);
      setErrorMsg(extractErrorMessage(e));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-amber-100 flex items-center justify-center">
          <ShieldCheck className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">管理コンソール</h1>
          <p className="text-xs text-muted-foreground mt-0.5">プラットフォーム全体の管理 / 全国加盟店BI</p>
        </div>
        <Badge className="ml-2 bg-amber-100 text-amber-700 border-amber-200 text-xs">
          BRIDGE 運営
        </Badge>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 space-y-1">
          <p className="font-semibold">管理データの取得でエラーが発生しました</p>
          <p className="text-xs break-all">{errorMsg}</p>
          {errorMsg.includes("SUPABASE_SERVICE_ROLE_KEY") && (
            <p className="text-[11px] text-rose-600/80">
              .env.local に <code className="px-1 py-0.5 bg-rose-100 rounded">SUPABASE_SERVICE_ROLE_KEY=...</code> を追加して開発サーバを再起動してください。
            </p>
          )}
        </div>
      )}

      {/* Top KPI Stats (基本) */}
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
      <Tabs defaultValue="bi">
        <TabsList>
          <TabsTrigger value="bi" className="text-xs">
            <BarChart3 className="h-3.5 w-3.5 mr-1" />
            全国加盟店BI
          </TabsTrigger>
          <TabsTrigger value="companies" className="text-xs">企業一覧</TabsTrigger>
          <TabsTrigger value="users" className="text-xs">ユーザー一覧</TabsTrigger>
        </TabsList>

        {/* ─────────── BI ─────────── */}
        <TabsContent value="bi" className="mt-4 space-y-6">
          {/* Headline KPIs */}
          {loading || !bi ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <BiKpi
                label="総受注金額"
                value={yen(bi.totalRevenue)}
                sub={`${bi.constructionCount}件の合計`}
                icon={Wallet}
                color="text-blue-600 bg-blue-50"
              />
              <BiKpi
                label="総粗利"
                value={yen(bi.totalGross)}
                sub={`加重粗利率 ${pct(bi.grossRateWeighted)}`}
                icon={TrendingUp}
                color="text-emerald-600 bg-emerald-50"
              />
              <BiKpi
                label="平均工事単価"
                value={yen(bi.avgUnitPrice)}
                sub={`全国 ${bi.companyCount}社`}
                icon={HardHat}
                color="text-amber-600 bg-amber-50"
              />
              <BiKpi
                label="加盟店平均粗利率"
                value={pct(bi.grossRateAvg)}
                sub={`(各社単純平均)`}
                icon={Percent}
                color="text-violet-600 bg-violet-50"
              />
            </div>
          )}

          {/* Secondary KPIs */}
          {!loading && bi && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <BiKpi
                label="アクティブ社数"
                value={`${bi.activeCompanyCount} / ${bi.companyCount}`}
                sub="直近30日に工事登録のある社"
                icon={Activity}
                color="text-cyan-600 bg-cyan-50"
              />
              <BiKpi
                label="進行中工事"
                value={`${bi.inProgressCount}`}
                sub={`完了: ${bi.completedCount} / 遅延: ${bi.delayedCount}`}
                icon={HardHat}
                color="text-blue-600 bg-blue-50"
              />
              <BiKpi
                label="登録顧客数"
                value={`${bi.customerCount.toLocaleString()}`}
                sub="全社合計"
                icon={Users}
                color="text-violet-600 bg-violet-50"
              />
              <BiKpi
                label="総原価"
                value={yen(bi.totalCost)}
                sub={`粗利 ${yen(bi.totalGross)}`}
                icon={Wallet}
                color="text-rose-600 bg-rose-50"
              />
            </div>
          )}

          {/* Trend chart + Status pie */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">月次トレンド (直近12ヶ月)</h3>
                  <span className="text-[11px] text-muted-foreground">受注 / 粗利 / 件数</span>
                </div>
                {loading ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={biTrend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="label" fontSize={11} />
                      <YAxis
                        yAxisId="left"
                        fontSize={11}
                        tickFormatter={(v: number) =>
                          v >= 1_000_000 ? `${Math.round(v / 1_000_000)}M` : v >= 1000 ? `${Math.round(v / 1000)}K` : `${v}`
                        }
                      />
                      <YAxis yAxisId="right" orientation="right" fontSize={11} />
                      <RTooltip
                        formatter={(value, name) => {
                          const v = typeof value === "number" ? value : 0;
                          return name === "件数" ? `${v}件` : yen(v);
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line yAxisId="left" type="monotone" dataKey="revenue" name="受注額" stroke="#3b82f6" strokeWidth={2} dot={false} />
                      <Line yAxisId="left" type="monotone" dataKey="gross" name="粗利" stroke="#10b981" strokeWidth={2} dot={false} />
                      <Line yAxisId="right" type="monotone" dataKey="count" name="件数" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3">工事ステータス分布</h3>
                {loading || !biStatus ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={Object.entries(biStatus).map(([k, v]) => ({
                          name: STATUS_LABEL[k] ?? k,
                          value: v,
                          key: k,
                        }))}
                        dataKey="value"
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={88}
                        paddingAngle={1}
                      >
                        {Object.keys(biStatus).map((k) => (
                          <Cell key={k} fill={STATUS_COLOR[k] ?? "#94a3b8"} />
                        ))}
                      </Pie>
                      <RTooltip formatter={(v) => `${typeof v === "number" ? v : 0}件`} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Gross rate distribution + Ranking */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3">加盟店粗利率分布</h3>
                {loading ? (
                  <Skeleton className="h-56 w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={biDist} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="label" fontSize={10} />
                      <YAxis fontSize={11} allowDecimals={false} />
                      <RTooltip formatter={(v) => `${typeof v === "number" ? v : 0}社`} />
                      <Bar dataKey="count" name="社数" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardContent className="p-0">
                <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">加盟店ランキング (受注額順)</h3>
                  <span className="text-[11px] text-muted-foreground">{biRanking.length}社</span>
                </div>
                {loading ? (
                  <div className="p-4 space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/30 text-[11px] text-muted-foreground uppercase tracking-wider">
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
                          <tr>
                            <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                              データがありません
                            </td>
                          </tr>
                        ) : (
                          biRanking.slice(0, 20).map((r, i) => (
                            <tr key={r.companyId} className="border-b border-white/20 hover:bg-white/30 transition-colors">
                              <td className="px-4 py-2.5 text-xs text-muted-foreground tabular-nums">{i + 1}</td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                    <Building2 className="h-3 w-3 text-primary" />
                                  </div>
                                  <span className="text-xs font-medium truncate">{r.companyName}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-right text-xs tabular-nums">
                                {r.constructionCount}
                                <span className="text-muted-foreground"> ({r.completedCount})</span>
                              </td>
                              <td className="px-4 py-2.5 text-right text-xs tabular-nums font-medium">{yen(r.revenue)}</td>
                              <td className={cn("px-4 py-2.5 text-right text-xs tabular-nums", r.gross < 0 && "text-rose-600")}>
                                {yen(r.gross)}
                              </td>
                              <td className={cn(
                                "px-4 py-2.5 text-right text-xs tabular-nums",
                                r.grossRate < 0 ? "text-rose-600" : r.grossRate >= 0.2 ? "text-emerald-600" : "",
                              )}>
                                {r.revenue > 0 ? pct(r.grossRate) : "—"}
                              </td>
                              <td className="px-4 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                                {r.constructionCount > 0 ? yen(r.avgUnitPrice) : "—"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─────────── 企業一覧 ─────────── */}
        <TabsContent value="companies" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button size="sm" className="gap-1.5 text-xs" onClick={() => setAddDialog(true)}>
              <Plus className="h-3.5 w-3.5" />企業を追加
            </Button>
          </div>
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
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {companies.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                            企業がありません
                          </td>
                        </tr>
                      ) : companies.map((c) => {
                        const memberCount = users.filter((u) => u.company_id === c.id).length;
                        return (
                          <tr key={c.id} className="border-b border-white/20 hover:bg-white/30 transition-colors group">
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
                            <td className="pr-2 py-3">
                              <button
                                onClick={() => handleDeleteCompany(c.id, c.name)}
                                disabled={deletingId === c.id}
                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-rose-100 text-slate-400 hover:text-rose-500 transition-all"
                              >
                                {deletingId === c.id
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <Trash2 className="h-3.5 w-3.5" />}
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

        {/* ─────────── ユーザー一覧 ─────────── */}
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

      {/* ─── 企業追加ダイアログ ─── */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>企業を追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">企業情報</Label>
              <Input
                placeholder="企業名 *"
                value={addForm.companyName}
                onChange={(e) => setAddForm((f) => ({ ...f, companyName: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">プラン</Label>
              <Select
                value={addForm.plan || "_none"}
                onValueChange={(v) => setAddForm((f) => ({ ...f, plan: v === "_none" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="プランを選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Free</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                サブドメイン slug
                <span className="ml-1.5 text-muted-foreground font-normal">（任意・英小文字・数字・ハイフン）</span>
              </Label>
              <div className="flex items-center gap-1.5">
                <Input
                  placeholder="acme-construction"
                  value={addForm.slug}
                  onChange={(e) =>
                    setAddForm((f) => ({
                      ...f,
                      slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                    }))
                  }
                />
              </div>
              {process.env.NEXT_PUBLIC_APP_DOMAIN ? (
                addForm.slug ? (
                  <p className="text-[11px] text-emerald-600">
                    → {addForm.slug}.{process.env.NEXT_PUBLIC_APP_DOMAIN}
                  </p>
                ) : null
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  ドメイン取得後 <code className="px-1 bg-muted rounded">NEXT_PUBLIC_APP_DOMAIN</code> を設定するとサブドメインが有効になります
                </p>
              )}
            </div>

            <div className="border-t pt-4 space-y-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">オーナーアカウント</Label>
              <Input
                placeholder="担当者名 *"
                value={addForm.ownerName}
                onChange={(e) => setAddForm((f) => ({ ...f, ownerName: e.target.value }))}
              />
              <Input
                type="email"
                placeholder="メールアドレス *"
                value={addForm.ownerEmail}
                onChange={(e) => setAddForm((f) => ({ ...f, ownerEmail: e.target.value }))}
              />
              <Input
                type="password"
                placeholder="初期パスワード（6文字以上）*"
                value={addForm.ownerPassword}
                onChange={(e) => setAddForm((f) => ({ ...f, ownerPassword: e.target.value }))}
              />
              <p className="text-[11px] text-muted-foreground">
                ※ このアカウントが企業の「オーナー」権限で作成されます。初回ログイン後にパスワード変更を推奨します。
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialog(false)} disabled={addSaving}>
              キャンセル
            </Button>
            <Button
              onClick={handleAddCompany}
              disabled={addSaving || !addForm.companyName.trim() || !addForm.ownerName.trim() || !addForm.ownerEmail.trim() || addForm.ownerPassword.length < 6}
            >
              {addSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              作成する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─────────────────────── サブコンポーネント ─────────────────────── */

function BiKpi({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="py-4 px-5 flex items-start gap-3">
        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", color)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">{label}</p>
          <p className="text-xl font-bold tabular-nums truncate">{value}</p>
          {sub && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
