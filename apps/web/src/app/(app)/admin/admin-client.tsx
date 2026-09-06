"use client";

import { useState, useEffect, useCallback, type ComponentType, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  updateAdminCompany,
  getAdminLinqAiSettings,
  updateAdminLinqAiSettings,
  testAdminLinqAiConnection,
} from "@/lib/actions/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import { KpiRow } from "@/components/shared/kpi-row";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
  TrendingUp,
  Activity,
  Wallet,
  Percent,
  Plus,
  Trash2,
  Loader2,
  Download,
  BarChart3,
  Sparkles,
  Globe,
  Copy,
  Check,
} from "lucide-react";
import { DonutChart } from "@/components/charts/donut-chart";
import { GroupedBarChart } from "@/components/charts/grouped-bar-chart";
import { TEAL_CARD_SM, TEAL_KPI_ICON } from "@/lib/teal-theme";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { downloadAdminBiPdf } from "@/lib/admin-bi-pdf";
import { toast } from "sonner";

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
  preparing: "var(--brand-mid)",
  in_progress: "var(--brand-light)",
  completed: "var(--brand-dark)",
  suspended: "color-mix(in srgb, var(--brand-mid) 45%, #94a3b8)",
  delayed: "color-mix(in srgb, var(--brand-dark) 42%, #64748b)",
};

const DIST_COLORS = [
  "var(--brand-mid)",
  "var(--brand-light)",
  "color-mix(in srgb, var(--brand-light) 45%, var(--brand-dark))",
  "var(--brand-dark)",
];

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
const compactYen = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 100_000_000) return `¥${(n / 100_000_000).toFixed(1)}億`;
  if (abs >= 10_000) return `¥${Math.round(n / 10_000).toLocaleString()}万`;
  return yen(n);
};
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export type AdminInitialData = {
  stats: { companyCount: number; userCount: number; constructionCount: number; contractCount: number };
  companies: Array<{ id: string; name: string; slug: string | null; plan: string | null; created_at: string }>;
  users: Array<{ id: string; display_name: string; email: string; role: string; company_id: string; created_at: string; companies: { name: string } | null }>;
  bi: BiOverview;
  biRanking: BiRanking;
  biTrend: BiTrend;
  biStatus: BiStatus;
  biDist: BiDist;
  aiSettings: Awaited<ReturnType<typeof getAdminLinqAiSettings>>;
};

export function AdminClient({ initialData }: { initialData: AdminInitialData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") ?? "bi";
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [stats, setStats] = useState(initialData.stats);
  const [companies, setCompanies] = useState(initialData.companies);
  const [users, setUsers] = useState(initialData.users);
  const [bi, setBi] = useState<BiOverview | null>(initialData.bi);
  const [biRanking, setBiRanking] = useState<BiRanking>(initialData.biRanking);
  const [biTrend, setBiTrend] = useState<BiTrend>(initialData.biTrend);
  const [biStatus, setBiStatus] = useState<BiStatus | null>(initialData.biStatus);
  const [biDist, setBiDist] = useState<BiDist>(initialData.biDist);
  const [addDialog, setAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({ companyName: "", plan: "", slug: "", ownerName: "", ownerEmail: "", ownerPassword: "" });
  const [addSaving, setAddSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editDialog, setEditDialog] = useState<{ id: string; name: string; slug: string; plan: string } | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(initialData.aiSettings.enabled);
  const [aiProvider, setAiProvider] = useState<"openai" | "google" | "anthropic" | "azure">(
    (initialData.aiSettings.provider as "openai" | "google" | "anthropic" | "azure") ?? "openai",
  );
  const [aiModel, setAiModel] = useState(initialData.aiSettings.model);
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiKeyConfigured, setAiKeyConfigured] = useState(initialData.aiSettings.apiKeyConfigured);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const loadAiSettings = useCallback(async () => {
    const s = await getAdminLinqAiSettings();
    setAiEnabled(s.enabled);
    setAiProvider((s.provider as "openai" | "google" | "anthropic" | "azure") ?? "openai");
    setAiModel(s.model);
    setAiKeyConfigured(s.apiKeyConfigured);
  }, []);

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
    await loadAiSettings().catch(() => {});
    setLoading(false);
  }, [loadAiSettings]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/admin/login"); return; }
      if (user.email !== "super-admin@example.com") { router.replace("/unauthorized"); return; }
    });
  }, [router]);

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
    try {
      await deleteAdminCompany(id);
      setCompanies((prev) => prev.filter((c) => c.id !== id));
    }
    catch (e) { setErrorMsg(extractErrorMessage(e)); }
    finally { setDeletingId(null); }
  };

  const handleOpenEditDialog = (c: { id: string; name: string; slug: string | null; plan: string | null }) => {
    setEditDialog({ id: c.id, name: c.name, slug: c.slug ?? "", plan: c.plan ?? "" });
  };

  const handleSaveEdit = async () => {
    if (!editDialog) return;
    setEditSaving(true);
    try {
      const res = await updateAdminCompany({
        id: editDialog.id,
        name: editDialog.name.trim(),
        slug: editDialog.slug.trim() || null,
        plan: editDialog.plan.trim() || null,
      });
      setCompanies((prev) =>
        prev.map((c) =>
          c.id === editDialog.id
            ? { ...c, name: editDialog.name.trim(), slug: res.slug, plan: editDialog.plan.trim() || null }
            : c,
        ),
      );
      if (res.netlifyError) {
        alert(`保存しましたが Netlify への反映に失敗しました:\n${res.netlifyError}`);
      }
      setEditDialog(null);
    } catch (e) {
      setErrorMsg(extractErrorMessage(e));
    } finally {
      setEditSaving(false);
    }
  };

  const handleSaveAiSettings = async () => {
    setAiSaving(true);
    setAiTestResult(null);
    try {
      await updateAdminLinqAiSettings({
        enabled: aiEnabled,
        provider: aiProvider,
        model: aiModel,
        apiKey: aiApiKey || undefined,
      });
      setAiApiKey("");
      await loadAiSettings();
      setAiTestResult({ ok: true, message: "AI 設定を保存しました。全テナントで利用可能です。" });
    } catch (e) {
      setAiTestResult({ ok: false, message: extractErrorMessage(e) });
    } finally {
      setAiSaving(false);
    }
  };

  const handleTestAiConnection = async () => {
    setAiTesting(true);
    setAiTestResult(null);
    try {
      if (aiApiKey.trim()) {
        await updateAdminLinqAiSettings({
          enabled: true,
          provider: aiProvider,
          model: aiModel,
          apiKey: aiApiKey.trim(),
        });
        setAiApiKey("");
        await loadAiSettings();
      }
      const result = await testAdminLinqAiConnection();
      setAiTestResult(result);
    } catch (e) {
      setAiTestResult({ ok: false, message: extractErrorMessage(e) });
    } finally {
      setAiTesting(false);
    }
  };

  const exportBiPdf = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      await downloadAdminBiPdf({
        stats,
        bi,
        status: biStatus,
        dist: biDist,
        trend: biTrend,
        ranking: biRanking,
      });
    } catch (e) {
      toast.error(extractErrorMessage(e) || "PDFの出力に失敗しました");
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <PageHeader
        title={currentTab === "companies" ? "企業一覧" : currentTab === "ai" ? "AI設定" : "全国加盟店BI"}
        description={
          currentTab === "companies" ? "加盟店の追加・編集"
            : currentTab === "ai" ? "全テナント共通の Linq AI 設定"
              : "プラットフォーム全体の実績"
        }
      >
        {currentTab === "bi" && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={exportingPdf || loading}
            onClick={exportBiPdf}
          >
            {exportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            レポート出力
          </Button>
        )}
      </PageHeader>

      {/* Error */}
      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 space-y-1">
          <p className="font-semibold">管理データの取得でエラーが発生しました</p>
          <p className="text-xs break-all">{errorMsg}</p>
        </div>
      )}

      {/* コンテンツ（サイドバーのtabパラメータで切り替え） */}
      <div>

        {/* BI */}
        {currentTab === "bi" && <div className="space-y-3">
          <KpiRow
            loading={loading}
            columns={4}
            items={[
              { label: "登録企業数", value: stats?.companyCount ?? 0, icon: Building2 },
              { label: "総ユーザー数", value: stats?.userCount ?? 0, icon: Users },
              { label: "工事案件数", value: stats?.constructionCount ?? 0, icon: HardHat },
              { label: "契約書数", value: stats?.contractCount ?? 0, icon: FileText },
            ]}
          />
          <CompactKpiGrid
            loading={loading || !bi}
            items={[
              { label: "総受注金額", value: bi ? compactYen(bi.totalRevenue) : "—", sub: bi ? `${bi.constructionCount}件` : undefined, icon: Wallet },
              { label: "総粗利", value: bi ? compactYen(bi.totalGross) : "—", sub: bi ? pct(bi.grossRateWeighted) : undefined, icon: TrendingUp },
              { label: "平均単価", value: bi ? compactYen(bi.avgUnitPrice) : "—", sub: bi ? `${bi.companyCount}社` : undefined, icon: HardHat },
              { label: "平均粗利率", value: bi ? pct(bi.grossRateAvg) : "—", icon: Percent },
              { label: "アクティブ", value: bi ? `${bi.activeCompanyCount}/${bi.companyCount}` : "—", sub: "直近30日", icon: Activity },
              { label: "進行中", value: bi ? `${bi.inProgressCount}` : "—", sub: bi ? `完了 ${bi.completedCount}` : undefined, icon: HardHat },
              { label: "顧客数", value: bi ? bi.customerCount.toLocaleString() : "—", icon: Users },
              { label: "総原価", value: bi ? compactYen(bi.totalCost) : "—", icon: Wallet },
            ]}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <ChartPanel
              title="月次トレンド（直近12ヶ月）"
              icon={BarChart3}
              right={<span className="text-[11px] text-muted-foreground">単位：万円</span>}
            >
              {loading ? <Skeleton className="h-[200px] w-full" /> : (
                <div className="space-y-2">
                  <div className="h-[200px]">
                    <GroupedBarChart
                      data={biTrend.map((row) => ({
                        month: row.label,
                        受注額: Math.round(row.revenue / 10_000),
                        粗利: Math.round(row.gross / 10_000),
                      }))}
                      labelKey="month"
                      idPrefix="admin-trend"
                      series={[
                        { key: "受注額", label: "受注額", gradient: ["var(--brand-light)", "var(--brand-dark)"] },
                        { key: "粗利", label: "粗利", gradient: ["var(--brand-accent)", "var(--brand-mid)"] },
                      ]}
                      formatValue={(v) => `¥${v.toLocaleString()}万`}
                      gridColor="rgba(var(--brand-accent-rgb),0.55)"
                      labelColor="#64748b"
                      tickColor="#94a3b8"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm" style={{ background: "var(--brand-dark)" }} />受注額
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm" style={{ background: "var(--brand-mid)" }} />粗利
                    </span>
                  </div>
                </div>
              )}
            </ChartPanel>
            <ChartPanel title="工事ステータス分布" icon={HardHat}>
              {loading || !biStatus ? <Skeleton className="h-[200px] w-full" /> : (
                <StatusBreakdown status={biStatus} />
              )}
            </ChartPanel>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <ChartPanel title="加盟店粗利率分布" icon={Percent}>
              {loading ? <Skeleton className="h-[180px] w-full" /> : (
                <DistBreakdown rows={biDist} />
              )}
            </ChartPanel>
            <ChartPanel
              title="加盟店ランキング"
              icon={Building2}
              className="lg:col-span-2"
              flush
              right={<span className="text-[11px] text-muted-foreground">{biRanking.length}社</span>}
            >
              {loading ? (
                <div className="px-4 pb-4 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 rounded-lg" />)}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50/80 text-[11px] text-muted-foreground">
                        <th className="px-3 py-1.5 text-left w-8 font-medium">#</th>
                        <th className="px-3 py-1.5 text-left font-medium">加盟店</th>
                        <th className="px-3 py-1.5 text-right font-medium">工事</th>
                        <th className="px-3 py-1.5 text-right font-medium">受注額</th>
                        <th className="px-3 py-1.5 text-right font-medium">粗利</th>
                        <th className="px-3 py-1.5 text-right font-medium">粗利率</th>
                        <th className="px-3 py-1.5 text-right font-medium">平均単価</th>
                      </tr>
                    </thead>
                    <tbody>
                      {biRanking.length === 0 ? (
                        <tr><td colSpan={7} className="px-3 py-10 text-center text-sm text-muted-foreground">データがありません</td></tr>
                      ) : biRanking.slice(0, 20).map((r, i) => (
                        <tr key={r.companyId} className="border-b last:border-0 hover:bg-slate-50/80 transition-colors">
                          <td className="px-3 py-2 text-xs tabular-nums text-muted-foreground">{i + 1}</td>
                          <td className="px-3 py-2">
                            <span className="text-xs font-medium truncate block max-w-[180px]">{r.companyName}</span>
                          </td>
                          <td className="px-3 py-2 text-right text-xs tabular-nums">{r.constructionCount}<span className="text-muted-foreground">/{r.completedCount}</span></td>
                          <td className="px-3 py-2 text-right text-xs tabular-nums font-medium">{compactYen(r.revenue)}</td>
                          <td className={cn("px-3 py-2 text-right text-xs tabular-nums", r.gross < 0 && "text-rose-600")}>{compactYen(r.gross)}</td>
                          <td className={cn("px-3 py-2 text-right text-xs tabular-nums", r.grossRate < 0 ? "text-rose-600" : r.grossRate >= 0.2 ? "text-emerald-700" : "")}>{r.revenue > 0 ? pct(r.grossRate) : "—"}</td>
                          <td className="px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">{r.constructionCount > 0 ? compactYen(r.avgUnitPrice) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ChartPanel>
          </div>
        </div>}

        {/* 企業一覧 */}
        {currentTab === "companies" && <div className="mt-4">
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
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">サブドメイン</th>
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
                          <tr
                            key={c.id}
                            onClick={() => handleOpenEditDialog(c)}
                            className="border-b hover:bg-muted/30 transition-colors group cursor-pointer"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                  <Building2 className="h-3.5 w-3.5 text-primary" />
                                </div>
                                <span className="text-sm font-medium">{c.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {c.slug ? (
                                <span className="flex items-center gap-1 text-xs font-mono text-primary">
                                  <Globe className="h-3 w-3 shrink-0" />
                                  {c.slug}
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Globe className="h-3 w-3 shrink-0" />
                                  未設定
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{c.plan ?? "Free"}</Badge></td>
                            <td className="px-4 py-3 text-sm tabular-nums">{memberCount}名</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">{format(new Date(c.created_at), "yyyy/MM/dd", { locale: ja })}</td>
                            <td className="pr-2 py-3" onClick={(e) => e.stopPropagation()}>
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
        </div>}

        {/* AI設定 */}
        {currentTab === "ai" && <div className="mt-4">
          <div className="space-y-4">
            {/* ヘッダーカード */}
            <Card>
              <CardContent className="flex items-start gap-4 py-4">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Linq AI — プラットフォーム共通設定</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    ここで設定した API キーは全テナント（全加盟店）の営業フロー AI 機能で共通利用されます。<br />
                    各社の管理画面からは変更できません。
                  </p>
                </div>
                <div className="ml-auto shrink-0">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      aiEnabled && aiKeyConfigured
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-700 border-amber-200",
                    )}
                  >
                    {aiEnabled && aiKeyConfigured ? "稼働中" : "未設定"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* 設定フォームカード */}
            <Card variant="inset">
              <CardContent className="py-5 space-y-5">
                {/* ON/OFF */}
                <div className="flex items-center justify-between rounded-xl border bg-background/60 px-4 py-3.5">
                  <div>
                    <p className="font-medium text-sm">AI 機能を有効化</p>
                    <p className="text-xs text-muted-foreground mt-0.5">録音要約・ステージ提案・メール生成など</p>
                  </div>
                  <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
                </div>

                {/* プロバイダー */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">プロバイダー</Label>
                    <Select
                      value={aiProvider}
                      onValueChange={(v) => {
                        const p = v as typeof aiProvider;
                        setAiProvider(p);
                        const defaults: Record<typeof aiProvider, string> = {
                          openai: "gpt-4o-mini",
                          google: "gemini-2.0-flash",
                          anthropic: "claude-3-5-haiku-20241022",
                          azure: "gpt-4o",
                        };
                        setAiModel(defaults[p]);
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="google">Google Gemini</SelectItem>
                        <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                        <SelectItem value="azure">Azure OpenAI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">モデル</Label>
                    <Select value={aiModel} onValueChange={setAiModel}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {aiProvider === "openai" && (
                          <>
                            <SelectItem value="gpt-4o-mini">gpt-4o-mini（推奨・低コスト）</SelectItem>
                            <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                            <SelectItem value="gpt-4.1-mini">gpt-4.1-mini</SelectItem>
                            <SelectItem value="gpt-4.1">gpt-4.1</SelectItem>
                          </>
                        )}
                        {aiProvider === "google" && (
                          <>
                            <SelectItem value="gemini-2.0-flash">gemini-2.0-flash（推奨・無料枠あり）</SelectItem>
                            <SelectItem value="gemini-1.5-flash">gemini-1.5-flash</SelectItem>
                            <SelectItem value="gemini-1.5-pro">gemini-1.5-pro</SelectItem>
                          </>
                        )}
                        {aiProvider === "anthropic" && (
                          <>
                            <SelectItem value="claude-3-5-haiku-20241022">claude-3-5-haiku（推奨・低コスト）</SelectItem>
                            <SelectItem value="claude-3-5-sonnet-20241022">claude-3-5-sonnet</SelectItem>
                            <SelectItem value="claude-opus-4-5">claude-opus-4</SelectItem>
                          </>
                        )}
                        {aiProvider === "azure" && (
                          <>
                            <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                            <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* API キー */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {aiProvider === "openai" && "OpenAI API キー"}
                    {aiProvider === "google" && "Gemini API キー"}
                    {aiProvider === "anthropic" && "Anthropic API キー"}
                    {aiProvider === "azure" && "Azure OpenAI API キー"}
                  </Label>
                  <Input
                    type="password"
                    value={aiApiKey}
                    onChange={(e) => setAiApiKey(e.target.value)}
                    placeholder={
                      aiKeyConfigured
                        ? "●●●●●●●●（設定済み — 変更する場合のみ入力）"
                        : aiProvider === "openai" ? "sk-..."
                        : aiProvider === "google" ? "AIza..."
                        : aiProvider === "anthropic" ? "sk-ant-..."
                        : "your-azure-api-key"
                    }
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    {aiProvider === "openai" && (
                      <><a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">OpenAI Platform</a> で取得できます</>
                    )}
                    {aiProvider === "google" && (
                      <><a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google AI Studio</a> で無料取得できます</>
                    )}
                    {aiProvider === "anthropic" && (
                      <><a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Anthropic Console</a> で取得できます</>
                    )}
                    {aiProvider === "azure" && "Azure Portal の Azure OpenAI リソースから取得してください"}
                  </p>
                </div>

                {/* テスト結果 */}
                {aiTestResult && (
                  <div className={cn(
                    "flex items-start gap-2 rounded-xl px-4 py-3 text-sm border",
                    aiTestResult.ok
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-rose-50 text-rose-800 border-rose-200",
                  )}>
                    <span className="mt-0.5 text-base leading-none">{aiTestResult.ok ? "✓" : "✕"}</span>
                    <span>{aiTestResult.message}</span>
                  </div>
                )}

                {/* ボタン */}
                <div className="flex items-center gap-2 pt-1">
                  <Button onClick={handleSaveAiSettings} disabled={aiSaving} className="gap-1.5">
                    {aiSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    保存する
                  </Button>
                  <Button variant="outline" onClick={handleTestAiConnection} disabled={aiTesting} className="gap-1.5">
                    {aiTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    接続テスト
                  </Button>
                  {aiKeyConfigured && !aiTesting && !aiSaving && (
                    <span className="text-xs text-muted-foreground ml-1">API キー設定済み</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>}

        {/* ユーザー一覧（サイドバーに項目がないため非表示化しているが残す） */}
        {currentTab === "users" && <div className="mt-4">
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
        </div>}
      </div>

      {/* 企業情報編集ダイアログ */}
      <Dialog open={!!editDialog} onOpenChange={(open) => { if (!open) setEditDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              企業情報を編集
            </DialogTitle>
          </DialogHeader>
          {editDialog && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">企業名</Label>
                <Input
                  placeholder="企業名"
                  value={editDialog.name}
                  onChange={(e) => setEditDialog((d) => d ? { ...d, name: e.target.value } : d)}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">プラン</Label>
                <Select
                  value={editDialog.plan || "_none"}
                  onValueChange={(v) => setEditDialog((d) => d ? { ...d, plan: v === "_none" ? "" : v } : d)}
                >
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
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  サブドメイン slug
                  <span className="ml-1 font-normal normal-case text-muted-foreground">（半角英数字・ハイフンのみ）</span>
                </Label>
                <Input
                  placeholder="acme-construction"
                  value={editDialog.slug}
                  onChange={(e) =>
                    setEditDialog((d) =>
                      d ? { ...d, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") } : d
                    )
                  }
                />
                {editDialog.slug && (
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-muted-foreground font-mono flex-1">
                      https://{editDialog.slug}.bridge-linq.com
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`https://${editDialog.slug}.bridge-linq.com`);
                        setCopiedUrl(true);
                        setTimeout(() => setCopiedUrl(false), 2000);
                      }}
                      className="shrink-0 p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      title="URLをコピー"
                    >
                      {copiedUrl ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)} disabled={editSaving}>キャンセル</Button>
            <Button
              onClick={handleSaveEdit}
              disabled={editSaving || !editDialog?.name.trim()}
              className="gap-1.5"
            >
              {editSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              保存する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

function CompactKpiGrid({
  items,
  loading,
}: {
  items: { label: string; value: string; sub?: string; icon: ComponentType<{ className?: string }> }[];
  loading?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {(loading ? items.map((it) => ({ ...it, value: "" })) : items).map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className={cn(TEAL_CARD_SM, "px-3 py-2 flex items-center gap-2.5 min-w-0")}>
            <div className={TEAL_KPI_ICON} style={{ background: "var(--brand-gradient)" }}>
              <Icon className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              {loading ? (
                <Skeleton className="h-8 w-full" />
              ) : (
                <>
                  <p className="text-[11px] text-slate-500 leading-none truncate">{item.label}</p>
                  <p className="mt-1 text-sm font-bold tabular-nums tracking-tight text-slate-900 leading-none">
                    {item.value}
                    {item.sub ? (
                      <span className="ml-1.5 text-[11px] font-medium text-slate-400">{item.sub}</span>
                    ) : null}
                  </p>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusBreakdown({ status }: { status: Record<string, number> }) {
  const rows = (Object.keys(STATUS_LABEL) as Array<keyof typeof STATUS_LABEL>).map((key) => ({
    key,
    label: STATUS_LABEL[key],
    value: status[key] ?? 0,
    color: STATUS_COLOR[key] ?? "var(--brand-dark)",
  }));
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  const donut = rows.filter((r) => r.value > 0);

  return (
    <div className="flex items-stretch gap-4 min-h-[180px]">
      <div className="w-[140px] shrink-0 self-center aspect-square">
        <DonutChart
          data={donut}
          height={140}
          innerRadius={40}
          outerRadius={62}
          showLabels={false}
          showLegend={false}
          formatValue={(v) => `${v}件`}
          centerLabel={
            <>
              <p className="text-[10px] font-semibold text-slate-400 leading-none">工事</p>
              <p className="text-lg font-bold tabular-nums mt-1 leading-none text-slate-900">
                {rows.reduce((s, r) => s + r.value, 0)}件
              </p>
            </>
          }
        />
      </div>
      <div className="min-w-0 flex-1 flex flex-col justify-center gap-2 py-1">
        {rows.map((row) => {
          const share = Math.round((row.value / total) * 100);
          return (
            <div key={row.key}>
              <div className="flex items-center justify-between gap-2 text-xs mb-1">
                <span className="flex items-center gap-1.5 min-w-0 font-medium text-slate-700">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: row.color }} />
                  <span className="truncate">{row.label}</span>
                </span>
                <span className="tabular-nums text-slate-900 shrink-0">
                  {row.value}件
                  <span className="text-slate-400 ml-1.5">{share}%</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(var(--brand-accent-rgb),0.4)" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, share)}%`, background: row.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DistBreakdown({ rows }: { rows: BiDist }) {
  const total = rows.reduce((s, r) => s + r.count, 0) || 1;
  return (
    <div className="flex flex-col justify-center gap-2.5 min-h-[180px] py-1">
      {rows.map((row, i) => {
        const share = Math.round((row.count / total) * 100);
        const color = DIST_COLORS[i] ?? "var(--brand-dark)";
        const label = row.label.replace(/^粗利率\s*/, "");
        return (
          <div key={row.key}>
            <div className="flex items-center justify-between gap-2 text-xs mb-1">
              <span className="flex items-center gap-1.5 min-w-0 font-medium text-slate-700">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
                <span className="truncate">{label}</span>
              </span>
              <span className="tabular-nums text-slate-900 shrink-0">
                {row.count}社
                <span className="text-slate-400 ml-1.5">{share}%</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(var(--brand-accent-rgb),0.4)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, share)}%`, background: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ChartPanel({
  title,
  icon: Icon,
  right,
  children,
  className,
  flush,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <div className={cn("frost-card rounded-xl flex flex-col min-h-0", flush ? "overflow-hidden" : "p-4 gap-3", className)}>
      <div className={cn("flex items-center justify-between gap-2 shrink-0", flush && "px-4 pt-3.5 pb-2")}>
        <p className="flex items-center gap-2 text-xs font-bold text-foreground">
          <Icon className="h-3.5 w-3.5 text-[var(--brand-dark)]" />
          {title}
        </p>
        {right}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}


