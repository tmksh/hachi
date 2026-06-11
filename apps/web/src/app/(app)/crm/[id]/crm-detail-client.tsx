"use client";

import { useState, useEffect, Suspense, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { CustomerAvatar } from "@/components/shared/customer-avatar";
import { KpiRow } from "@/components/shared/kpi-row";
import { CustomerEntryForm } from "@/components/crm/customer-entry-form";
import { DealsTimelineTab } from "@/components/crm/deals-timeline-tab";
import { RecordingSummaryTab } from "@/components/crm/recording-summary-tab";
import { StageProposalBanner } from "@/components/crm/stage-proposal-banner";
import { CustomerTodoTab } from "@/components/crm/customer-todo-tab";
import { SchedulingTab } from "@/components/crm/scheduling-tab";
import { CustomerFilesTab } from "@/components/crm/customer-files-tab";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Trash2, Phone, Mail, MapPin,
  Building2, Plus, FileText, Briefcase, HardHat, ClipboardList, ClipboardPen,
  ChevronRight, Inbox, Mic, ListTodo, Upload, Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { getCustomer, deleteCustomer, getCustomerRelated } from "@/lib/actions/customers";
import type { Customer } from "@/lib/database.types";

type CustomerDetail = Customer & { assigned_to_profile: { id: string; display_name: string } | null };
type Related = Awaited<ReturnType<typeof getCustomerRelated>>;

const STAGE_LABELS: Record<string, string> = {
  lead: "リード", negotiation: "商談中", proposal: "提案中",
  inquiry: "問い合わせ", first_meeting: "初回面談", materials_sent: "資料送付",
  quote_submitted: "見積提出", closing: "クロージング",
  won: "受注", lost: "失注",
};
const STATUS_LABELS_CON: Record<string, string> = {
  draft: "下書き", active: "有効", completed: "完了", cancelled: "解除",
};
const STATUS_LABELS_CONS: Record<string, string> = {
  preparing: "準備中", in_progress: "施工中", completed: "完了", suspended: "停止", delayed: "遅延",
};
const CUSTOMER_STATUS: Record<string, string> = {
  active: "アクティブ", inactive: "非アクティブ", pending: "保留",
};

function EmptyRelated({ message, action }: { message: string; action: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
      <div className="size-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
        <Inbox className="size-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground mb-4">{message}</p>
      {action}
    </div>
  );
}

function RelatedRow({ onClick, children }: { onClick?: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/45 dark:hover:bg-white/5 transition-colors border-b border-border/40 last:border-0 group"
    >
      <div className="flex-1 min-w-0">{children}</div>
      <ChevronRight className="size-4 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 transition-colors" />
    </button>
  );
}

type CrmDetailClientProps = {
  initialData: CustomerDetail | null;
  initialRelated: Related | null;
};

const ALLOWED_TABS = ["overview", "entry", "deals", "recording", "todo", "scheduling", "files"];

function CrmDetailPageContent({ initialData, initialRelated }: CrmDetailClientProps) {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mainTab, setMainTab] = useState(() => {
    const tab = searchParams.get("tab");
    return tab && ALLOWED_TABS.includes(tab) ? tab : "overview";
  });
  const [data, setData] = useState<CustomerDetail | null>(initialData);
  const [related] = useState<Related | null>(initialRelated);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ALLOWED_TABS.includes(tab)) {
      setMainTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const reloadCustomer = () => {
    if (!id) return;
    getCustomer(id as string).then(c => setData(c as CustomerDetail)).catch(() => {});
  };

  const handleDelete = async () => {
    if (!confirm("この顧客を削除しますか？")) return;
    try { await deleteCustomer(id as string); toast.success("削除しました"); router.push("/crm"); }
    catch { toast.error("削除に失敗しました"); }
  };

  if (!data) return (
    <div className="p-4 md:p-6 space-y-4">
      <Link href="/crm" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" />顧客一覧
      </Link>
      <p>顧客が見つかりません</p>
    </div>
  );

  const isCorp = data.customer_type === "corporation" || !!data.company_name;
  const totalDeal = related?.deals.reduce((s, d) => s + (d.value ?? 0), 0) ?? 0;
  const totalEst = related?.estimates.reduce((s, e) => s + (e.total ?? 0), 0) ?? 0;
  const totalCon = related?.contracts.reduce((s, c) => s + (c.amount ?? 0), 0) ?? 0;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <Link href="/crm" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />顧客一覧
      </Link>

      {/* プロフィールヘッダー */}
      <Card className="overflow-hidden py-0">
        <CardContent className="p-0">
          <div className="flex items-start gap-2 p-5 min-w-0">
            <div className="flex-1 min-w-0">
              <div className="w-full min-w-0 max-w-full overflow-hidden rounded-lg p-2">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4 min-w-0">
                  <CustomerAvatar seed={data.id} name={data.name} size="lg" />
                  <div className="flex-1 min-w-0 space-y-3 overflow-hidden">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <h1 className="text-2xl font-semibold tracking-tight truncate max-w-full text-foreground">{data.name}</h1>
                      <Badge variant="outline" className="text-xs shrink-0">{isCorp ? "法人" : "個人"}</Badge>
                      <Badge className={cn(
                        "text-xs shrink-0",
                        data.status === "active" && "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
                        data.status === "inactive" && "bg-gray-100 text-gray-500 hover:bg-gray-100",
                        data.status === "pending" && "bg-amber-100 text-amber-700 hover:bg-amber-100",
                      )}>
                        {CUSTOMER_STATUS[data.status] ?? data.status}
                      </Badge>
                    </div>
                    {data.company_name && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5 min-w-0">
                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{data.company_name}</span>
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 min-w-0 max-w-full">
                      {data.phone && (
                        <a
                          href={`tel:${data.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-muted/60 hover:bg-muted transition-colors max-w-full min-w-0"
                        >
                          <Phone className="h-3 w-3 shrink-0" />
                          <span className="truncate">{data.phone}</span>
                        </a>
                      )}
                      {data.email && (
                        <a
                          href={`mailto:${data.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-muted/60 hover:bg-muted transition-colors max-w-full min-w-0"
                        >
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate">{data.email}</span>
                        </a>
                      )}
                      {data.address && (
                        <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-muted/60 text-muted-foreground max-w-full min-w-0">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{data.address}</span>
                        </span>
                      )}
                    </div>
                    {data.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {data.tags.map(t => (
                          <Badge key={t} variant="secondary" className="text-[10px] h-5 px-2 font-normal">{t}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive shrink-0 mt-1">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <StageProposalBanner customerId={id as string} />

      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList className="h-auto flex flex-wrap gap-1 w-full justify-start">
          <TabsTrigger value="overview" className="text-xs px-3">概要</TabsTrigger>
          <TabsTrigger value="entry" className="text-xs px-3 gap-1"><ClipboardPen className="h-3 w-3" />記入画面</TabsTrigger>
          <TabsTrigger value="deals" className="text-xs px-3 gap-1"><Briefcase className="h-3 w-3" />商談</TabsTrigger>
          <TabsTrigger value="recording" className="text-xs px-3 gap-1"><Mic className="h-3 w-3" />録音・要約</TabsTrigger>
          <TabsTrigger value="todo" className="text-xs px-3 gap-1"><ListTodo className="h-3 w-3" />ToDo</TabsTrigger>
          <TabsTrigger value="scheduling" className="text-xs px-3 gap-1"><Calendar className="h-3 w-3" />スケジューリング</TabsTrigger>
          <TabsTrigger value="files" className="text-xs px-3 gap-1"><Upload className="h-3 w-3" />ファイル</TabsTrigger>
        </TabsList>

        <TabsContent value="entry" className="mt-4">
          <CustomerEntryForm
            mode="edit"
            customerId={id as string}
            initialCustomer={data}
            onSaved={() => reloadCustomer()}
          />
        </TabsContent>

        <TabsContent value="deals" className="mt-4">
          <DealsTimelineTab customerId={id as string} />
        </TabsContent>

        <TabsContent value="recording" className="mt-4">
          <RecordingSummaryTab
            customerId={id as string}
            dealId={related?.deals?.find((d) => d.stage !== "won" && d.stage !== "lost")?.id}
          />
        </TabsContent>

        <TabsContent value="todo" className="mt-4">
          <CustomerTodoTab customerId={id as string} />
        </TabsContent>

        <TabsContent value="scheduling" className="mt-4">
          <SchedulingTab customerId={id as string} />
        </TabsContent>

        <TabsContent value="files" className="mt-4">
          <CustomerFilesTab customerId={id as string} />
        </TabsContent>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <KpiRow
            items={[
              { label: "商談", value: related?.deals.length ?? 0, sub: `¥${(totalDeal / 10000).toFixed(0)}万`, icon: Briefcase },
              { label: "見積", value: related?.estimates.length ?? 0, sub: `¥${(totalEst / 10000).toFixed(0)}万`, icon: FileText },
              { label: "契約", value: related?.contracts.length ?? 0, sub: `¥${(totalCon / 10000).toFixed(0)}万`, icon: ClipboardList },
              {
                label: "工事",
                value: related?.constructions.length ?? 0,
                sub: `進行中 ${related?.constructions.filter((c) => c.status === "in_progress").length ?? 0}件`,
                icon: HardHat,
              },
            ]}
          />

          <Card variant="inset" className="py-0 overflow-hidden min-w-0">
            <CardHeader className="pb-2 pt-4 px-4 border-b border-border/40">
              <CardTitle className="text-sm font-semibold">取引・案件</CardTitle>
              <CardDescription className="text-xs">商談 → 見積 → 契約 → 工事の流れで紐づくデータ</CardDescription>
            </CardHeader>
            <Tabs defaultValue="deals">
                <div className="px-4 pt-3 pb-0 border-b border-border/40">
                  <TabsList className="h-auto flex flex-wrap gap-1 w-full justify-start bg-transparent p-0">
                    {([
                      { value: "deals", icon: Briefcase, label: "商談", count: related?.deals.length },
                      { value: "estimates", icon: FileText, label: "見積", count: related?.estimates.length },
                      { value: "contracts", icon: ClipboardList, label: "契約", count: related?.contracts.length },
                      { value: "constructions", icon: HardHat, label: "工事", count: related?.constructions.length },
                    ] as const).map(({ value, icon: Icon, label, count }) => (
                      <TabsTrigger
                        key={value}
                        value={value}
                        className="text-xs h-8 px-3 rounded-md gap-1.5 border-transparent data-[state=active]:ui-choice-active data-[state=active]:text-[#0F5132]"
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                        <span className="tabular-nums text-muted-foreground data-[state=active]:text-[#2A8055]">({count ?? 0})</span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                <TabsContent value="deals" className="mt-0">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30 bg-muted/10">
                    <p className="text-xs font-medium text-slate-600">商談一覧</p>
                    <Link href={`/crm?view=pipeline`}>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                        <Plus className="h-3 w-3" />追加
                      </Button>
                    </Link>
                  </div>
                  {related?.deals.length === 0 ? (
                    <EmptyRelated message="商談がまだありません" action={
                      <Link href="/crm?view=pipeline"><Button size="sm" variant="outline" className="gap-1"><Plus className="h-3.5 w-3.5" />商談を追加</Button></Link>
                    } />
                  ) : related?.deals.map(d => (
                    <RelatedRow key={d.id} onClick={() => router.push("/crm?view=pipeline")}>
                      <p className="font-medium text-sm truncate">{d.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px] h-5">{STAGE_LABELS[d.stage ?? ""] ?? d.stage}</Badge>
                        {d.value != null && <span className="text-xs font-semibold tabular-nums">¥{d.value.toLocaleString()}</span>}
                      </div>
                    </RelatedRow>
                  ))}
                </TabsContent>

                <TabsContent value="estimates" className="mt-0">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30 bg-muted/10">
                    <p className="text-xs font-medium text-slate-600">見積一覧</p>
                    <Link href={`/quotes/new?customer_id=${id}`}>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1"><Plus className="h-3 w-3" />作成</Button>
                    </Link>
                  </div>
                  {related?.estimates.length === 0 ? (
                    <EmptyRelated message="見積がまだありません" action={
                      <Link href={`/quotes/new?customer_id=${id}`}><Button size="sm" variant="outline" className="gap-1"><Plus className="h-3.5 w-3.5" />見積を作成</Button></Link>
                    } />
                  ) : related?.estimates.map(e => (
                    <RelatedRow key={e.id} onClick={() => router.push(`/quotes/${e.id}`)}>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{e.estimate_no}</span>
                        <p className="font-medium text-sm truncate">{e.title}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusBadge status={e.status ?? "draft"} />
                        {e.total != null && <span className="text-xs font-semibold tabular-nums">¥{e.total.toLocaleString()}</span>}
                      </div>
                    </RelatedRow>
                  ))}
                </TabsContent>

                <TabsContent value="contracts" className="mt-0">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30 bg-muted/10">
                    <p className="text-xs font-medium text-slate-600">契約一覧</p>
                    <Link href={`/contracts/new?customer_id=${id}`}>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1"><Plus className="h-3 w-3" />追加</Button>
                    </Link>
                  </div>
                  {related?.contracts.length === 0 ? (
                    <EmptyRelated message="契約がまだありません" action={
                      <Link href={`/contracts/new?customer_id=${id}`}><Button size="sm" variant="outline" className="gap-1"><Plus className="h-3.5 w-3.5" />契約を追加</Button></Link>
                    } />
                  ) : related?.contracts.map(c => (
                    <RelatedRow key={c.id} onClick={() => router.push(`/contracts/${c.id}`)}>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{c.contract_no}</span>
                        <p className="font-medium text-sm truncate">{c.title}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px] h-5">{STATUS_LABELS_CON[c.status ?? ""] ?? c.status}</Badge>
                        {c.amount != null && <span className="text-xs font-semibold tabular-nums">¥{c.amount.toLocaleString()}</span>}
                      </div>
                    </RelatedRow>
                  ))}
                </TabsContent>

                <TabsContent value="constructions" className="mt-0">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30 bg-muted/10">
                    <p className="text-xs font-medium text-slate-600">工事一覧</p>
                    <Link href={`/constructions/new?customer_id=${id}`}>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1"><Plus className="h-3 w-3" />追加</Button>
                    </Link>
                  </div>
                  {related?.constructions.length === 0 ? (
                    <EmptyRelated message="工事がまだありません" action={
                      <Link href={`/constructions/new?customer_id=${id}`}><Button size="sm" variant="outline" className="gap-1"><Plus className="h-3.5 w-3.5" />工事を追加</Button></Link>
                    } />
                  ) : related?.constructions.map(c => (
                    <RelatedRow key={c.id} onClick={() => router.push(`/constructions/${c.id}`)}>
                      <p className="font-medium text-sm truncate">{c.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px] h-5">{STATUS_LABELS_CONS[c.status ?? ""] ?? c.status}</Badge>
                        {c.start_date && <span className="text-[11px] text-muted-foreground">{c.start_date}</span>}
                        <span className="text-xs font-semibold tabular-nums ml-auto">{c.progress ?? 0}%</span>
                      </div>
                    </RelatedRow>
                  ))}
                </TabsContent>
              </Tabs>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function CrmDetailClient(props: CrmDetailClientProps) {
  return (
    <Suspense fallback={<div className="p-4 md:p-6 space-y-4"><Skeleton className="h-5 w-24" /><Skeleton className="h-32 w-full rounded-xl" /></div>}>
      <CrmDetailPageContent {...props} />
    </Suspense>
  );
}
