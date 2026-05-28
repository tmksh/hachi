"use client";

import Link from "next/link";
import { CalendarRange, FileText, User2, Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export type ContractFormCustomer = { id: string; name: string };
export type ContractFormProfile = { id: string; display_name: string };
export type ContractFormEstimate = {
  id: string;
  estimate_no: string;
  title: string | null;
  customer_id: string | null;
  total?: number | null;
};

export const CONTRACT_STATUS_OPTIONS = [
  { value: "preparing", label: "準備中" },
  { value: "contracted", label: "契約済" },
  { value: "executing", label: "実行中" },
  { value: "completed", label: "完了" },
  { value: "cancelled", label: "キャンセル" },
] as const;

type ContractFormFieldsProps = {
  customers: ContractFormCustomer[];
  profiles: ContractFormProfile[];
  estimates: ContractFormEstimate[];
  customerId: string;
  onCustomerChange: (id: string) => void;
  title: string;
  onTitleChange: (value: string) => void;
  assignedTo: string;
  onAssignedToChange: (value: string) => void;
  amount: string;
  onAmountChange: (value: string) => void;
  contractDate: string;
  onContractDateChange: (value: string) => void;
  startDate: string;
  onStartDateChange: (value: string) => void;
  endDate: string;
  onEndDateChange: (value: string) => void;
  estimateId: string;
  onEstimateChange: (id: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  status?: string;
  onStatusChange?: (value: string) => void;
};

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {description && <p className="text-xs text-muted-foreground pl-6">{description}</p>}
    </div>
  );
}

function FieldHint({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-xs text-muted-foreground", className)}>{children}</p>;
}

export function ContractFormFields({
  customers,
  profiles,
  estimates,
  customerId,
  onCustomerChange,
  title,
  onTitleChange,
  assignedTo,
  onAssignedToChange,
  amount,
  onAmountChange,
  contractDate,
  onContractDateChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  estimateId,
  onEstimateChange,
  notes,
  onNotesChange,
  status,
  onStatusChange,
}: ContractFormFieldsProps) {
  const customerEstimates = estimates.filter(
    (e) => e.customer_id === customerId || (estimateId !== "" && e.id === estimateId),
  );
  const selectedEstimate = estimates.find((e) => e.id === estimateId);
  const selectedCustomer = customers.find((c) => c.id === customerId);

  const handleEstimateSelect = (id: string) => {
    onEstimateChange(id);
    const est = estimates.find((e) => e.id === id);
    if (est?.total != null && est.total > 0) {
      onAmountChange(String(est.total));
    }
  };

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <SectionHeader
          icon={User2}
          title="基本情報"
          description="契約の相手方と件名を入力します"
        />
        <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-end gap-4">
          <div className="space-y-2 w-full lg:w-auto lg:min-w-[180px] lg:flex-1">
            <Label>
              顧客 <span className="text-destructive">*</span>
            </Label>
            <Select value={customerId} onValueChange={onCustomerChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="顧客を選択" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 w-full lg:w-auto lg:min-w-[160px] lg:flex-1">
            <Label>担当者</Label>
            <Select value={assignedTo} onValueChange={onAssignedToChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="担当者を選択" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {status != null && onStatusChange && (
            <div className="space-y-2 w-full lg:w-auto lg:min-w-[140px]">
              <Label>ステータス</Label>
              <Select value={status} onValueChange={onStatusChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACT_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2 w-full lg:flex-[2] lg:min-w-[240px]">
            <Label>
              件名 <span className="text-destructive">*</span>
            </Label>
            <Input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="例: 佐藤様 二世帯住宅新築工事請負契約"
            />
          </div>
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <SectionHeader
          icon={Wallet}
          title="金額・日程"
          description="契約金額と契約日・工期を入力します"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2 lg:col-span-1">
            <Label>契約金額（円）</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              placeholder="0"
              className="tabular-nums"
            />
          </div>
          <div className="space-y-2 lg:col-span-1">
            <Label>契約日</Label>
            <Input
              type="date"
              value={contractDate}
              onChange={(e) => onContractDateChange(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2 lg:col-span-2">
            <Label className="flex items-center gap-1.5">
              <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
              工期
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 items-center max-w-xl lg:max-w-none">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                aria-label="工期開始日"
              />
              <span className="text-sm text-muted-foreground text-center hidden sm:block">〜</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
                aria-label="工期終了日"
              />
            </div>
            <FieldHint className="whitespace-nowrap">着工日〜竣工予定日</FieldHint>
          </div>
        </div>
        <FieldHint className="whitespace-nowrap">
          関連見積を選ぶと、見積金額を自動入力できます
        </FieldHint>
      </section>

      <Separator />

      <section className="space-y-4">
        <SectionHeader
          icon={FileText}
          title="関連見積"
          description="この契約の根拠となる見積書。契約詳細の「関連見積」に表示されます"
        />
        <div className="space-y-3">
          {!customerId ? (
            <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              先に<strong className="font-medium text-foreground">顧客</strong>
              を選択すると、その顧客の見積を選べます
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>見積書</Label>
                <Select value={estimateId} onValueChange={handleEstimateSelect}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="見積を選択（任意）" />
                  </SelectTrigger>
                  <SelectContent>
                    {customerEstimates.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.estimate_no} — {e.title ?? "無題"}
                        {e.total != null ? `（¥${e.total.toLocaleString()}）` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {customerEstimates.length === 0 && (
                  <FieldHint>
                    {selectedCustomer?.name ?? "この顧客"}の見積がありません。
                    <Link href="/quotes" className="text-primary hover:underline ml-1">
                      見積管理
                    </Link>
                    から作成できます
                  </FieldHint>
                )}
              </div>
              {selectedEstimate ? (
                <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm space-y-1 h-fit">
                  <p className="text-xs font-medium text-muted-foreground">選択中の見積</p>
                  <p className="font-medium text-foreground">
                    {selectedEstimate.estimate_no} — {selectedEstimate.title ?? "無題"}
                  </p>
                  {selectedEstimate.total != null && (
                    <p className="text-muted-foreground tabular-nums">
                      見積金額: ¥{selectedEstimate.total.toLocaleString()}
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed bg-muted/10 px-4 py-3 text-sm text-muted-foreground h-fit hidden lg:flex items-center">
                  見積を選択するとプレビューが表示されます
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <Separator />

      <section className="space-y-2">
        <Label>備考</Label>
        <Textarea
          rows={4}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="社内メモ・特記事項など"
        />
      </section>
    </div>
  );
}
