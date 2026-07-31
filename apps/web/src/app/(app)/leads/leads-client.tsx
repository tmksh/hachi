"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Search, UserPlus, Ban, Phone, Mail, Inbox } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createInboundLead,
  convertInboundLeadToCustomer,
  discardInboundLead,
  updateInboundLeadStatus,
  enableInboundWebhook,
  rotateInboundWebhookSecret,
  disableInboundWebhook,
  type InboundWebhookPublicConfig,
} from "@/lib/actions/leads";
import type { InboundLead } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { Copy, Link2, RefreshCw } from "lucide-react";

const STATUS_LABELS: Record<InboundLead["status"], string> = {
  new: "未対応",
  in_progress: "対応中",
  converted: "顧客化済",
  discarded: "見送り",
};

const STATUS_CLASS: Record<InboundLead["status"], string> = {
  new: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  in_progress: "bg-sky-100 text-sky-800 hover:bg-sky-100",
  converted: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  discarded: "bg-slate-100 text-slate-600 hover:bg-slate-100",
};

const SOURCE_OPTIONS = [
  { value: "manual", label: "電話・手動" },
  { value: "web", label: "Web" },
  { value: "email", label: "メール" },
  { value: "instagram", label: "Instagram" },
  { value: "other", label: "その他" },
];

function sourceLabel(source: string | null) {
  return SOURCE_OPTIONS.find((s) => s.value === source)?.label ?? source ?? "—";
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

type Props = {
  initialLeads: InboundLead[];
  initialWebhook: InboundWebhookPublicConfig;
};

export function LeadsClient({ initialLeads, initialWebhook }: Props) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [webhook, setWebhook] = useState(initialWebhook);
  const [freshSecret, setFreshSecret] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    source: "manual",
    inquiry_category: "",
    inquiry_content: "",
  });

  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  useEffect(() => {
    setWebhook(initialWebhook);
  }, [initialWebhook]);

  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const webhookUrl = webhook.path ? `${origin}${webhook.path}` : null;

  function copyText(label: string, value: string) {
    void navigator.clipboard.writeText(value).then(
      () => toast.success(`${label}をコピーしました`),
      () => toast.error("コピーに失敗しました"),
    );
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((lead) => {
      if (statusFilter === "open") {
        if (lead.status !== "new" && lead.status !== "in_progress") return false;
      } else if (statusFilter !== "all" && lead.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        lead.name.toLowerCase().includes(q)
        || (lead.email ?? "").toLowerCase().includes(q)
        || (lead.phone ?? "").includes(q)
        || (lead.inquiry_content ?? "").toLowerCase().includes(q)
        || (lead.source ?? "").toLowerCase().includes(q)
      );
    });
  }, [leads, search, statusFilter]);

  function resetForm() {
    setForm({
      name: "",
      email: "",
      phone: "",
      source: "manual",
      inquiry_category: "",
      inquiry_content: "",
    });
  }

  function handleCreate() {
    if (!form.name.trim()) {
      toast.error("名前を入力してください");
      return;
    }
    startTransition(async () => {
      try {
        const created = await createInboundLead({
          name: form.name,
          email: form.email || null,
          phone: form.phone || null,
          source: form.source,
          inquiry_category: form.inquiry_category || null,
          inquiry_content: form.inquiry_content || null,
        });
        setLeads((prev) => [created, ...prev]);
        setOpen(false);
        resetForm();
        toast.success("問い合わせを登録しました");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "登録に失敗しました");
      }
    });
  }

  function handleConvert(lead: InboundLead) {
    startTransition(async () => {
      try {
        if (lead.status === "new") {
          await updateInboundLeadStatus(lead.id, "in_progress");
        }
        const result = await convertInboundLeadToCustomer(lead.id);
        toast.success("顧客へ変換しました");
        router.push(`/crm/${result.customerId}`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "顧客化に失敗しました");
      }
    });
  }

  function handleDiscard(lead: InboundLead) {
    startTransition(async () => {
      try {
        await discardInboundLead(lead.id);
        setLeads((prev) =>
          prev.map((row) => (row.id === lead.id ? { ...row, status: "discarded" } : row)),
        );
        toast.success("見送りにしました");
        router.refresh();
      } catch {
        toast.error("更新に失敗しました");
      }
    });
  }

  function handleEnableWebhook() {
    startTransition(async () => {
      try {
        const result = await enableInboundWebhook();
        setWebhook((prev) => ({
          ...prev,
          enabled: true,
          token: result.path.split("/").pop() ?? null,
          secret_prefix: result.secret_prefix,
          path: result.path,
        }));
        if (result.secret) {
          setFreshSecret(result.secret);
          toast.success("Webhookを有効化しました（シークレットを控えてください）");
        } else {
          setFreshSecret(null);
          toast.success("Webhookを有効化しました");
        }
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "有効化に失敗しました");
      }
    });
  }

  function handleRotateSecret() {
    startTransition(async () => {
      try {
        const result = await rotateInboundWebhookSecret();
        setWebhook((prev) => ({
          ...prev,
          enabled: true,
          secret_prefix: result.secret_prefix,
          path: result.path,
          token: result.path.split("/").pop() ?? null,
        }));
        setFreshSecret(result.secret);
        toast.success("シークレットを再発行しました");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "再発行に失敗しました");
      }
    });
  }

  function handleDisableWebhook() {
    startTransition(async () => {
      try {
        await disableInboundWebhook();
        setWebhook((prev) => ({ ...prev, enabled: false }));
        setFreshSecret(null);
        toast.success("Webhookを無効化しました");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "無効化に失敗しました");
      }
    });
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="問い合わせ管理"
        description="顧客化する前の問い合わせ（Web・メール・Instagram・電話など）を一覧管理します"
      >
        <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          手動登録
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-muted-foreground" />
                <p className="font-medium text-sm">自動取り込み Webhook</p>
                <Badge variant={webhook.enabled ? "default" : "secondary"} className="text-xs">
                  {webhook.enabled ? "有効" : "未設定"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Webフォームや Zapier / Make からこのURLへPOSTすると、問い合わせ一覧に自動登録されます。
                メール・Instagram連携も同じ受け口を使えます。
              </p>
            </div>
            {webhook.canManage && (
              <div className="flex items-center gap-2">
                {!webhook.enabled || !webhook.path ? (
                  <Button size="sm" disabled={pending} onClick={handleEnableWebhook}>
                    連携を有効化
                  </Button>
                ) : (
                  <>
                    <Button size="sm" variant="outline" disabled={pending} onClick={handleRotateSecret}>
                      <RefreshCw className="h-3.5 w-3.5 mr-1" />
                      シークレット再発行
                    </Button>
                    <Button size="sm" variant="ghost" disabled={pending} onClick={handleDisableWebhook}>
                      無効化
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          {webhook.path && (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Webhook URL</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all text-xs">{webhookUrl}</code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => webhookUrl && copyText("URL", webhookUrl)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">シークレット（ヘッダー X-Bridge-Secret）</Label>
                {freshSecret ? (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 break-all text-xs text-amber-800 bg-amber-50 px-2 py-1 rounded">
                      {freshSecret}
                    </code>
                    <Button size="sm" variant="outline" onClick={() => copyText("シークレット", freshSecret)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {webhook.secret_prefix
                      ? `${webhook.secret_prefix}…（再表示不可。必要な場合は再発行）`
                      : "未発行"}
                  </p>
                )}
              </div>
              <pre className="text-[11px] leading-relaxed overflow-x-auto rounded bg-background border p-2 text-muted-foreground">{`curl -X POST "${webhookUrl ?? ""}" \\
  -H "Content-Type: application/json" \\
  -H "X-Bridge-Secret: ${freshSecret ?? "<SECRET>"}" \\
  -d '{"name":"山田太郎","email":"a@example.com","phone":"09012345678","source":"web","inquiry_content":"キッチンリフォーム相談"}'`}</pre>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="名前・連絡先・内容で検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">未対応・対応中</SelectItem>
            <SelectItem value="all">すべて</SelectItem>
            <SelectItem value="new">未対応</SelectItem>
            <SelectItem value="in_progress">対応中</SelectItem>
            <SelectItem value="converted">顧客化済</SelectItem>
            <SelectItem value="discarded">見送り</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card variant="inset">
          <CardContent className="py-16 text-center text-muted-foreground space-y-2">
            <Inbox className="h-8 w-8 mx-auto opacity-50" />
            <p>問い合わせがありません</p>
            <p className="text-xs">手動登録、または今後の Web／メール／Instagram 自動取り込みでここに表示されます</p>
          </CardContent>
        </Card>
      ) : (
        <Card variant="inset">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">受付日時</TableHead>
                  <TableHead className="w-[160px]">名前</TableHead>
                  <TableHead className="w-[100px]">経路</TableHead>
                  <TableHead>問い合わせ内容</TableHead>
                  <TableHead className="w-[100px]">ステータス</TableHead>
                  <TableHead className="w-[180px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(lead.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{lead.name}</div>
                      <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                        {lead.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {lead.phone}
                          </div>
                        )}
                        {lead.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {lead.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {sourceLabel(lead.source)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm line-clamp-2">
                        {lead.inquiry_content || lead.inquiry_category || "—"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-xs", STATUS_CLASS[lead.status])}>
                        {STATUS_LABELS[lead.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {lead.status === "converted" && lead.customer_id ? (
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/crm/${lead.customer_id}`}>顧客を開く</Link>
                          </Button>
                        ) : lead.status !== "discarded" ? (
                          <>
                            <Button
                              size="sm"
                              className="gap-1"
                              disabled={pending}
                              onClick={() => handleConvert(lead)}
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                              顧客化
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={pending}
                              onClick={() => handleDiscard(lead)}
                              aria-label="見送り"
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>問い合わせを手動登録</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="lead-name">名前 *</Label>
              <Input
                id="lead-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="山田 太郎"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lead-phone">電話</Label>
                <Input
                  id="lead-phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-email">メール</Label>
                <Input
                  id="lead-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>経路</Label>
                <Select
                  value={form.source}
                  onValueChange={(v) => setForm((f) => ({ ...f, source: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-category">カテゴリ</Label>
                <Input
                  id="lead-category"
                  value={form.inquiry_category}
                  onChange={(e) => setForm((f) => ({ ...f, inquiry_category: e.target.value }))}
                  placeholder="リフォーム相談 など"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-content">問い合わせ内容</Label>
              <Textarea
                id="lead-content"
                rows={4}
                value={form.inquiry_content}
                onChange={(e) => setForm((f) => ({ ...f, inquiry_content: e.target.value }))}
                placeholder="問い合わせ内容を入力..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              キャンセル
            </Button>
            <Button onClick={handleCreate} disabled={pending}>
              {pending ? "登録中..." : "登録"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
