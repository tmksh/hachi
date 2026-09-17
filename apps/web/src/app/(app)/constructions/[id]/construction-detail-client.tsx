"use client";

import { useQuerySeedAt } from "@/hooks/use-query-seed-at";
import React, { useState, useEffect, useRef, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  ArrowLeft, MapPin, CalendarRange,
  Wallet, User2, FileText, Users,
  PackageCheck, CheckCircle2,
  Loader2, Wand2,
  CalendarDays, ScrollText, PencilLine, BookOpen, FolderOpen,
} from "lucide-react";
import dynamic from "next/dynamic";
import { fetchConstruction, fetchChangeOrders, fetchInvoicesForConstruction, fetchConstructionContractDocs, fetchEstimate } from "@/lib/queries/details";
import { computeScheduleProgress } from "@/lib/construction/schedule-progress";
import { CompletionDialog } from "@/components/constructions/completion-dialog";
import { CustomerInfoPanel } from "@/components/crm/customer-info-panel";
import { useSeedCustomerEntryMasters } from "@/hooks/use-customer-entry-masters";
import type { Customer } from "@/lib/database.types";
import type { CustomerEntryMasters } from "@/lib/actions/customers";
import { CustomerAvatar } from "@/components/shared/customer-avatar";
import { PageLoadingFallback } from "@/components/shared/page-loading-fallback";
import { fetchCompany } from "@/lib/queries/portal";
import { CreateEstimateDialog } from "@/components/estimate/create-estimate-dialog";
import { useAuth } from "@/hooks/use-auth";
import type { EstimateCategory, EstimateItem } from "@/lib/database.types";
import {
  seedConstructionEstimates,
  createEmptyEstimateForConstruction,
  copyEstimateForConstruction,
} from "@/lib/actions/constructions";
import type { OrderRow } from "@/components/constructions/invoices-tab";
import type { EstimateForView } from "@/components/estimate/estimate-detail-view";
import type { EstimateListItem } from "@/components/estimate/estimate-list-view";

const tabFallback = <Skeleton className="h-64 w-full rounded-xl" />;

const CostBudgetTab = dynamic(
  () => import("@/components/constructions/cost-budget-tab").then((m) => m.CostBudgetTab),
  { loading: () => tabFallback },
);
const GanttTab = dynamic(
  () => import("@/components/constructions/gantt-tab").then((m) => m.GanttTab),
  { loading: () => tabFallback },
);
const ContractTab = dynamic(
  () => import("@/components/constructions/contract-tab").then((m) => m.ContractTab),
  { loading: () => tabFallback },
);
const ChangeOrderTab = dynamic(
  () => import("@/components/constructions/change-order-tab").then((m) => m.ChangeOrderTab),
  { loading: () => tabFallback },
);
const InvoicesTab = dynamic(
  () => import("@/components/constructions/invoices-tab").then((m) => m.InvoicesTab),
  { loading: () => tabFallback },
);
const OrdersTab = dynamic(
  () => import("@/components/constructions/invoices-tab").then((m) => m.OrdersTab),
  { loading: () => tabFallback },
);
const CustomerFilesTab = dynamic(
  () => import("@/components/crm/customer-files-tab").then((m) => m.CustomerFilesTab),
  { loading: () => tabFallback },
);
const CUSTOMER_DOCUMENTS_DESCRIPTION =
  "CRM・契約・工事からアップロードされた顧客関連ドキュメントを横断表示します。";
const EstimateDetailView = dynamic(
  () => import("@/components/estimate/estimate-detail-view").then((m) => m.EstimateDetailView),
  { loading: () => tabFallback },
);
const EstimateListView = dynamic(
  () => import("@/components/estimate/estimate-list-view").then((m) => m.EstimateListView),
  { loading: () => tabFallback },
);

type Detail = Awaited<ReturnType<typeof fetchConstruction>>;
type Order = Detail["orders"][number] & { craftsman?: { id: string; name: string } | null };

/* ──────────────────────────────────────────────────
   ヘッダー情報カード
────────────────────────────────────────────────── */
function InfoCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <div className="mt-0.5 text-muted-foreground flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value ?? "—"}</p>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────
   見積もりタブ - 空状態モック（プロトタイプ表示）
────────────────────────────────────────────────── */
function EstimateEmptyMock({ constructionId }: { constructionId: string }) {
  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const created = await seedConstructionEstimates(constructionId);
      toast.success(`サンプル見積 ${created.length} 件を作成しました`);
      window.location.reload();
    } catch (e) {
      toast.error(`サンプル作成に失敗: ${e instanceof Error ? e.message : "不明なエラー"}`);
      setSeeding(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4">
      <FileText className="h-12 w-12 text-muted-foreground/40" />
      <div>
        <p className="text-base font-semibold">見積もりデータがありません</p>
        <p className="text-sm text-muted-foreground mt-1">サンプルデータを投入して機能を確認できます</p>
      </div>
      <Button size="sm" className="gap-1.5" disabled={seeding} onClick={() => void handleSeed()}>
        {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
        {seeding ? "作成中..." : "サンプル見積を5件作成"}
      </Button>
      <p className="text-[11px] text-muted-foreground max-w-md">
        ※ 初回提案・変更見積・追加工事・最終提案・追加変更の5バージョンを、明細・カテゴリ込みで生成します。
      </p>
    </div>
  );
}

/* ──────────────────────────────────────────────────
   見積もりタブ
────────────────────────────────────────────────── */

function EstimateTab({ data, constructionId, onEstimateChange, onRefresh, initialSelectedId }: {
  data: Detail;
  constructionId: string;
  onEstimateChange: (est: Detail["estimate"]) => void;
  onRefresh?: () => void;
  initialSelectedId?: string | null;
}) {
  const contract = data.contract as (typeof data.contract & {
    amount?: number; contract_date?: string | null; notes?: string | null; estimate_id?: string | null;
  }) | null;
  const estimate = (data as Detail & { estimate?: (typeof data & {
    id?: string;
    estimate_no?: string; title?: string | null; subtotal?: number; tax?: number; total?: number;
    gross_profit?: number; gross_profit_rate?: number; notes?: string | null; status?: string;
    categories?: EstimateCategory[]; items?: EstimateItem[];
    reserve_fee_1_rate?: number; reserve_fee_2_rate?: number;
  }) | null }).estimate;

  const estimateList = ((data as Detail & { estimates?: EstimateListItem[] }).estimates ?? []) as EstimateListItem[];

  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const openedEstimateRef = useRef<string | null>(null);

  async function handleSelectEstimate(id: string) {
    setSelectedId(id);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "estimate");
      url.searchParams.set("estimateId", id);
      window.history.replaceState({}, "", url.toString());
    }
    setLoadingEstimate(true);
    try {
      const est = await fetchEstimate(id);
      onEstimateChange(est as Detail["estimate"]);
    } catch { toast.error("見積もりの読み込みに失敗しました"); }
    finally { setLoadingEstimate(false); }
  }

  useEffect(() => {
    if (!initialSelectedId || openedEstimateRef.current === initialSelectedId) return;
    openedEstimateRef.current = initialSelectedId;
    void handleSelectEstimate(initialSelectedId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSelectedId]);

  useEffect(() => {
    const onDraftApplied = (event: Event) => {
      const est = (event as CustomEvent<{ estimate?: { id?: string } }>).detail?.estimate;
      if (!est?.id || est.id !== selectedId) return;
      onEstimateChange(est as Detail["estimate"]);
      toast.success("Linq ドラフトを見積に反映しました");
    };
    window.addEventListener("bridge-estimate-draft-applied", onDraftApplied);
    return () => window.removeEventListener("bridge-estimate-draft-applied", onDraftApplied);
  }, [selectedId, onEstimateChange]);

  async function handleEstimateCreated(estimateId: string) {
    setCreateOpen(false);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "estimate");
      url.searchParams.set("estimateId", estimateId);
      window.history.replaceState({}, "", url.toString());
    }
    setLoadingEstimate(true);
    try {
      const est = await fetchEstimate(estimateId);
      onEstimateChange(est as Detail["estimate"]);
      setSelectedId(estimateId);
      onRefresh?.();
      toast.success("見積を作成しました");
    } catch {
      toast.error("見積の読み込みに失敗しました");
    } finally {
      setLoadingEstimate(false);
    }
  }

  // 詳細モード（作成直後もここへ遷移）
  if (selectedId && estimate?.id === selectedId) {
    return (
      <EstimateDetailView
        estimate={estimate as EstimateForView}
        onBack={() => { setSelectedId(null); }}
        loading={loadingEstimate}
        onEstimateChange={(est) => onEstimateChange(est as Detail["estimate"])}
        pdfCustomer={data.customer ? {
          name: data.customer.name,
          company_name: (data.customer as { company_name?: string | null }).company_name,
          customer_type: (data.customer as { customer_type?: string | null }).customer_type,
          notes: (data.customer as { notes?: string | null }).notes,
        } : null}
      />
    );
  }

  // データなし
  if (estimateList.length === 0 && !contract) {
    return (
      <>
        <EstimateEmptyMock constructionId={constructionId} />
        <CreateEstimateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          estimateList={estimateList}
          onCreate={async ({ title, author, sourceId }) => {
            if (sourceId) {
              return copyEstimateForConstruction(constructionId, sourceId, title, author);
            }
            return createEmptyEstimateForConstruction(constructionId, title, author);
          }}
          onCreated={(id) => void handleEstimateCreated(id)}
        />
      </>
    );
  }

  // 契約のみ
  if (estimateList.length === 0 && contract) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              契約情報（見積もり未連携）
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">契約番号</span><span className="font-mono">{contract.contract_no}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">契約金額</span><span className="font-semibold">¥{(contract.amount ?? 0).toLocaleString()}</span></div>
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground text-center">
          契約書に見積もりを紐付けると、明細金額が自動で表示されます
        </p>
      </div>
    );
  }

  // 一覧モード
  return (
    <>
      <EstimateListView
        estimateList={estimateList}
        loadingEstimate={loadingEstimate}
        loading={false}
        onSelectEstimate={handleSelectEstimate}
        onOpenCreate={() => setCreateOpen(true)}
        title="見積一覧"
        description="この工事に関連する見積を管理"
        showCustomer={false}
        showConstruction={false}
        hideCreate={false}
      />

      <CreateEstimateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        estimateList={estimateList}
        onCreate={async ({ title, author, sourceId }) => {
          if (sourceId) {
            return copyEstimateForConstruction(constructionId, sourceId, title, author);
          }
          return createEmptyEstimateForConstruction(constructionId, title, author);
        }}
        onCreated={(id) => void handleEstimateCreated(id)}
      />
    </>
  );
}

/* ──────────────────────────────────────────────────
   発注書・請書タブの実装は
   components/constructions/invoices-tab.tsx の OrdersTab へ移設
────────────────────────────────────────────────── */

/* ──────────────────────────────────────────────────
   メインページ
────────────────────────────────────────────────── */
type ContractDoc = Awaited<ReturnType<typeof fetchConstructionContractDocs>>[number];
type ChangeOrderRow = Awaited<ReturnType<typeof fetchChangeOrders>>[number];

type InvoiceRow = {
  id: string;
  invoice_no: string;
  invoice_date: string | null;
  due_date: string | null;
  total: number;
  status: string;
  created_at: string;
};

type ConstructionDetailClientProps = {
  initialData?: Detail | null;
  initialDocs?: ContractDoc[];
  initialChangeOrders?: ChangeOrderRow[];
  initialClosingDayLabel?: string;
  initialInvoices?: InvoiceRow[];
  initialMasters?: CustomerEntryMasters;
};

function ConstructionDetailPageContent({
  initialData,
  initialDocs,
  initialChangeOrders,
  initialClosingDayLabel,
  initialInvoices,
  initialMasters,
}: ConstructionDetailClientProps) {
  const querySeedAt = useQuerySeedAt();
  useSeedCustomerEntryMasters(initialMasters);
  const { id } = useParams();
  const constructionId = id as string;
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { data, isPending, isError } = useQuery({
    queryKey: ["construction", constructionId],
    queryFn: () => fetchConstruction(constructionId),
    staleTime: 60_000,
    refetchOnMount: "always",
    initialData: initialData ?? undefined,
    initialDataUpdatedAt: initialData ? querySeedAt : undefined,
    enabled: !!constructionId,
  });
  const { data: docs = [] } = useQuery({
    queryKey: ["construction-docs", constructionId],
    queryFn: () => fetchConstructionContractDocs(constructionId),
    staleTime: 60_000,
    initialData: initialDocs,
    initialDataUpdatedAt: initialDocs ? querySeedAt : undefined,
    enabled: !!constructionId,
  });
  const { data: changeOrders = [] } = useQuery({
    queryKey: ["construction-change-orders", constructionId],
    queryFn: () => fetchChangeOrders(constructionId),
    staleTime: 60_000,
    initialData: initialChangeOrders,
    initialDataUpdatedAt: initialChangeOrders ? querySeedAt : undefined,
    enabled: !!constructionId,
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ["construction-invoices", constructionId],
    queryFn: () => fetchInvoicesForConstruction(constructionId),
    staleTime: 60_000,
    initialData: initialInvoices,
    initialDataUpdatedAt: initialInvoices ? querySeedAt : undefined,
    enabled: !!constructionId,
  });
  const { data: closingDayLabel = initialClosingDayLabel ?? "月末締め" } = useQuery({
    queryKey: ["invoice-closing-day"],
    queryFn: async () => {
      const s = await fetchCompany();
      return s?.settings && (s.settings as Record<string, unknown>).invoice_closing_day === "20"
        ? "20日締め"
        : "月末締め";
    },
    staleTime: 5 * 60_000,
  });
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") ?? "schedule");
  const [completionOpen, setCompletionOpen] = useState(false);
  const [prefillOrder, setPrefillOrder] = useState<{ title?: string; amount?: string; workContent?: string; accountItem?: string } | null>(null);
  const initialEstimateId = searchParams.get("estimateId");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: ["construction", constructionId] });
    void queryClient.invalidateQueries({ queryKey: ["construction-docs", constructionId] });
    void queryClient.invalidateQueries({ queryKey: ["construction-change-orders", constructionId] });
    void queryClient.invalidateQueries({ queryKey: ["construction-invoices", constructionId] });
  };

  const setData = (updater: Detail | null | ((prev: Detail | null) => Detail | null)) => {
    queryClient.setQueryData<Detail | null>(["construction", constructionId], (prev: Detail | null | undefined) => {
      const current = prev ?? null;
      return typeof updater === "function" ? updater(current) : updater;
    });
  };

  if (isPending) return <PageLoadingFallback />;
  if (!data || isError) return (
    <div className="p-4 md:p-8">
      <Link href="/constructions" className="text-sm text-muted-foreground flex items-center gap-1"><ArrowLeft className="h-4 w-4" />戻る</Link>
      <p className="mt-4">見つかりません</p>
    </div>
  );

  const customer = data.customer as (typeof data.customer & {
    address?: string | null;
    company_name?: string | null;
    customer_type?: string | null;
    notes?: string | null;
  }) | null;
  const contract = data.contract as (typeof data.contract & {
    amount?: number; contract_date?: string | null; start_date?: string | null;
    end_date?: string | null; notes?: string | null; status?: string; estimate_id?: string | null;
  }) | null;
  const estimate = (data as Detail & { estimate?: { id?: string } | null }).estimate;
  const scheduleProgress = Array.isArray(data.tasks) && data.tasks.length > 0
    ? computeScheduleProgress(data.tasks as Array<{ progress?: number | null; status?: string | null }>)
    : Number(data.progress ?? 0);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <Link href="/constructions" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />工事一覧
      </Link>

      {/* ── ヘッダー ── */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{data.title}</h1>
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
              <span className="font-mono">{data.construction_no}</span>
              {customer && (
                <>
                  <span aria-hidden className="text-border/80">·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <CustomerAvatar seed={customer.id} name={customer.name} className="h-6 w-6 text-[10px]" />
                    <Link
                      href={`/crm/${customer.id}`}
                      className="hover:text-foreground hover:underline transition-colors"
                    >
                      {customer.name}
                    </Link>
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={data.status} className="mt-0.5" />
            {data.status !== "completed" && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1 border-green-500 text-green-700 hover:bg-green-50"
                onClick={() => setCompletionOpen(true)}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                完了にする
              </Button>
            )}
          </div>
        </div>
        {completionOpen && data && (
          <CompletionDialog
            open={completionOpen}
            onOpenChange={setCompletionOpen}
            construction={{
              id: data.id,
              title: data.title,
              order_amount: data.order_amount ?? null,
              actual_cost: data.actual_cost ?? null,
              customer: customer ?? null,
            }}
            onCompleted={reload}
          />
        )}

        {/* 4カラム情報 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 rounded-xl border border-border bg-card p-4">
          <InfoCell icon={<MapPin className="h-4 w-4" />} label="工事場所" value={customer?.address ?? "未設定"} />
          <InfoCell
            icon={<CalendarRange className="h-4 w-4" />}
            label="工期"
            value={data.start_date && data.end_date ? `${data.start_date} 〜 ${data.end_date}` : data.start_date ?? data.end_date ?? "未設定"}
          />
          <InfoCell
            icon={<Wallet className="h-4 w-4" />}
            label="予算 / 実績"
            value={<span>¥{(data.budget_cost ?? 0).toLocaleString()} <span className="text-muted-foreground text-xs">/ ¥{(data.actual_cost ?? 0).toLocaleString()}</span></span>}
          />
          <InfoCell icon={<User2 className="h-4 w-4" />} label="プロジェクト担当者" value={data.assignee?.display_name ?? "未設定"} />
        </div>

        {/* 進捗 */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">進捗</span>
          <div className="flex-1">
            <Progress value={scheduleProgress} className="h-2.5 rounded-full bg-slate-200/80" />
          </div>
          <span className={cn(
            "text-sm font-semibold tabular-nums w-10 text-right",
            scheduleProgress === 0 ? "text-muted-foreground/60" :
            scheduleProgress >= 100 ? "text-emerald-600" :
            scheduleProgress >= 50  ? "text-blue-600" :
            "text-amber-600"
          )}>
            {scheduleProgress}%
          </span>
        </div>
      </div>

      {/* ── タブ ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-8 w-full h-auto gap-0.5">
          <TabsTrigger value="customer"  className="text-xs gap-1 min-w-0"><Users       className="h-3.5 w-3.5 shrink-0" /><span className="truncate">顧客情報</span></TabsTrigger>
          <TabsTrigger value="schedule"  className="text-xs gap-1 min-w-0"><CalendarDays className="h-3.5 w-3.5 shrink-0" /><span className="truncate">工程表</span></TabsTrigger>
          <TabsTrigger value="estimate"  className="text-xs gap-1 min-w-0"><FileText     className="h-3.5 w-3.5 shrink-0" /><span className="truncate">見積もり</span></TabsTrigger>
          <TabsTrigger value="contract"  className="text-xs gap-1 min-w-0"><ScrollText   className="h-3.5 w-3.5 shrink-0" /><span className="truncate">契約書</span></TabsTrigger>
          <TabsTrigger value="change"    className="text-xs gap-1 min-w-0"><PencilLine   className="h-3.5 w-3.5 shrink-0" /><span className="truncate">追加変更</span></TabsTrigger>
          <TabsTrigger value="budget"    className="text-xs gap-1 min-w-0"><BookOpen     className="h-3.5 w-3.5 shrink-0" /><span className="truncate">工事台帳</span></TabsTrigger>
          <TabsTrigger value="orders"    className="text-xs gap-1 min-w-0"><PackageCheck className="h-3.5 w-3.5 shrink-0" /><span className="truncate">発注書・請書</span></TabsTrigger>
          <TabsTrigger value="documents" className="text-xs gap-1 min-w-0"><FolderOpen   className="h-3.5 w-3.5 shrink-0" /><span className="truncate">ドキュメント</span></TabsTrigger>
        </TabsList>

        <TabsContent value="customer" className="mt-4">
          {customer?.id ? (
            <CustomerInfoPanel
              customerId={customer.id}
              context="construction"
              initialCustomer={customer as Customer}
              onSaved={reload}
            />
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">顧客が紐づいていません</p>
          )}
        </TabsContent>

        <TabsContent value="schedule" className="mt-4">
          <GanttTab
            constructionId={id as string}
            initialTasks={(data.tasks ?? []) as { id: string; name: string; start_date: string | null; end_date: string | null; progress: number; status: string }[]}
            onScheduleChange={(tasks, progress) => {
              setData((prev: Detail | null) => prev ? { ...prev, tasks, progress } : prev);
              void queryClient.invalidateQueries({ queryKey: ["constructions"] });
            }}
          />
        </TabsContent>

        <TabsContent value="estimate" className="mt-4">
          <EstimateTab
            data={{ ...data, contract }}
            constructionId={id as string}
            onEstimateChange={(est) => setData((prev: Detail | null) => prev ? { ...prev, estimate: est } : prev)}
            onRefresh={reload}
            initialSelectedId={initialEstimateId}
          />
        </TabsContent>

        <TabsContent value="contract" className="mt-4">
          <ContractTab
            constructionId={id as string}
            customerId={customer?.id}
            constructionNo={data.construction_no}
            fillCustomer={customer as Customer | null}
            initialDocs={docs}
            ctx={{
              construction: {
                title: data.title,
                start_date: data.start_date,
                end_date: data.end_date,
                order_amount: data.order_amount ?? 0,
              },
              customer: customer ? {
                name: customer.name,
                address: customer.address ?? null,
                company_name: customer.company_name ?? null,
                customer_type: customer.customer_type ?? null,
                notes: customer.notes ?? null,
              } : null,
            }}
          />
        </TabsContent>

        <TabsContent value="change" className="mt-4">
          <ChangeOrderTab
            constructionId={id as string}
            initialOrders={changeOrders}
            baseAmount={contract?.amount ?? data.order_amount ?? 0}
            estimateList={((data as Detail & { estimates?: EstimateListItem[] }).estimates ?? []) as EstimateListItem[]}
            constructionInfo={{
              title: data.title,
              constructionNo: data.construction_no,
              customerName: customer?.name ?? null,
              location: customer?.address ?? null,
              assigneeName: (data.assignee as { display_name?: string } | null)?.display_name ?? null,
            }}
            onRefresh={reload}
            focusOrderId={searchParams.get("changeOrderId")}
          />
        </TabsContent>

        <TabsContent value="budget" className="mt-4">
          <CostBudgetTab
            constructionId={id as string}
            constructionNo={data.construction_no}
            constructionTitle={data.title}
            contractAmount={contract?.amount ?? data.order_amount ?? undefined}
            initialOrders={data.orders as Order[]}
            estimates={((data as Detail & { estimates?: Array<{ id: string; estimate_no: string; title: string | null; total: number }> }).estimates ?? []).map((e: { id: string; estimate_no: string; title: string | null; total: number }) => ({
              id: e.id,
              estimate_no: e.estimate_no,
              title: e.title,
              total: e.total ?? 0,
            }))}
            changeOrders={changeOrders.map((co) => ({
              id: co.id,
              title: co.title,
              diff_amount: (co as { diff_amount?: number | null }).diff_amount ?? 0,
            }))}
            periodStart={data.start_date}
            authorName={profile?.display_name ?? "ユーザー"}
            onNavigateToOrders={(row) => {
              setPrefillOrder(row ? {
                title: row.name || row.work_type,
                amount: row.budget ? String(row.budget) : "",
                workContent: row.work_type,
                accountItem: row.account_item,
              } : null);
              setActiveTab("orders");
            }}
            onOrdersCreated={reload}
          />
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <OrdersTab
            constructionId={id as string}
            initialOrders={data.orders as unknown as OrderRow[]}
            constructionStartDate={data.start_date}
            constructionEndDate={data.end_date}
            estimateId={estimate?.id ?? contract?.estimate_id ?? null}
            initialForm={prefillOrder}
          />
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <InvoicesTab
            constructionId={id as string}
            initialInvoices={invoices}
            hasSchedule={!!(data.start_date && data.end_date)}
            closingDayLabel={closingDayLabel}
            onRefresh={reload}
          />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          {customer?.id ? (
            <CustomerFilesTab
              customerId={customer.id}
              constructionId={id as string}
              description={CUSTOMER_DOCUMENTS_DESCRIPTION}
            />
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">顧客が紐づいていません</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function ConstructionDetailClient(props: ConstructionDetailClientProps) {
  return (
    <Suspense fallback={<div className="p-4 md:p-6 space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-96 w-full rounded-xl" /></div>}>
      <ConstructionDetailPageContent {...props} />
    </Suspense>
  );
}
