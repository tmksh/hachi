"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/shared/status-badge";
import { CustomerEntryForm } from "@/components/crm/customer-entry-form";
import {
  getContractCommunications, addContractCommunication, updateCommunicationAgreementStatus,
  getContractPostSignInfo, saveContractPostSignInfo, getContractDocuments,
  getContractEstimates, submitContractWorkflow, sendContractCloudSign,
} from "@/lib/actions/contract-features";
import { getEstimate } from "@/lib/actions/estimates";
import { CONTRACT_TEMPLATES } from "@/lib/contract-templates";
import { toast } from "sonner";
import type { ContractDetail } from "./contract-detail-types";
import { EstimateDetailView, type EstimateForView } from "@/components/estimate/estimate-detail-view";

export function ContractDetailTabs({ data, contractId }: { data: ContractDetail; contractId: string }) {
  return (
    <Tabs defaultValue="customer" className="mt-6">
      <TabsList className="flex flex-wrap h-auto gap-1">
        <TabsTrigger value="customer" className="text-xs">顧客情報</TabsTrigger>
        <TabsTrigger value="messaging" className="text-xs">やり取り管理</TabsTrigger>
        <TabsTrigger value="documents" className="text-xs">書類作成</TabsTrigger>
        <TabsTrigger value="workflow" className="text-xs">承認WF</TabsTrigger>
        <TabsTrigger value="esign" className="text-xs">電子契約</TabsTrigger>
        <TabsTrigger value="files" className="text-xs">ドキュメント</TabsTrigger>
        <TabsTrigger value="estimates" className="text-xs">見積もり</TabsTrigger>
      </TabsList>
      <TabsContent value="customer" className="mt-4">
        {data.customer_id ? (
          <CustomerEntryForm mode="edit" customerId={data.customer_id} />
        ) : (
          <p className="text-sm text-muted-foreground">顧客が紐づいていません</p>
        )}
      </TabsContent>
      <TabsContent value="messaging" className="mt-4"><MessagingTab contractId={contractId} /></TabsContent>
      <TabsContent value="documents" className="mt-4"><DocumentsTab contractId={contractId} customerName={data.customer?.name} /></TabsContent>
      <TabsContent value="workflow" className="mt-4"><WorkflowTab contractId={contractId} title={data.title} /></TabsContent>
      <TabsContent value="esign" className="mt-4"><EsignTab contractId={contractId} customerEmail={data.customer?.email} /></TabsContent>
      <TabsContent value="files" className="mt-4"><FilesTab contractId={contractId} /></TabsContent>
      <TabsContent value="estimates" className="mt-4"><EstimatesTab contractId={contractId} /></TabsContent>
    </Tabs>
  );
}

function MessagingTab({ contractId }: { contractId: string }) {
  const [platform, setPlatform] = useState<"line" | "slack" | "email">("line");
  const [messages, setMessages] = useState<Awaited<ReturnType<typeof getContractCommunications>>>([]);
  const [body, setBody] = useState("");
  const [postSign, setPostSign] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    getContractCommunications(contractId).then(setMessages).catch(() => {});
    getContractPostSignInfo(contractId).then((rows) => setPostSign(rows.map((r) => ({ label: r.label, value: r.value ?? "" })))).catch(() => {});
  }, [contractId]);

  const send = async () => {
    if (!body.trim()) return;
    try {
      await addContractCommunication({ contract_id: contractId, platform, body, direction: "outbound" });
      setBody("");
      getContractCommunications(contractId).then(setMessages);
      toast.success("送信しました");
    } catch { toast.error("送信に失敗"); }
  };

  const important = messages.filter((m) => m.is_important);

  return (
    <div className="space-y-4">
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">プラットフォーム連携</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Select value={platform} onValueChange={(v) => setPlatform(v as typeof platform)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="line">LINE</SelectItem>
              <SelectItem value="slack">Slack</SelectItem>
              <SelectItem value="email">メール</SelectItem>
            </SelectContent>
          </Select>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="クイック返信..." rows={3} />
          <Button size="sm" onClick={send}>送信</Button>
        </CardContent>
      </Card>
      {important.length > 0 && (
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">重要な合意事項</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {important.map((m) => (
              <div key={m.id} className="flex items-start gap-2 text-sm border rounded-lg p-2">
                <Checkbox checked={m.agreement_status === "addressed"} onCheckedChange={async (c) => {
                  await updateCommunicationAgreementStatus(m.id, c ? "addressed" : "pending");
                  getContractCommunications(contractId).then(setMessages);
                }} />
                <div><p>{m.body}</p><Badge variant="outline" className="text-[10px] mt-1">{m.platform}</Badge></div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">契約後の情報入力</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {[
            { label: "振込口座", value: "" },
            { label: "建物用途", value: "" },
            { label: "法規確認事項", value: "" },
          ].map((item, i) => (
            <div key={i} className="grid grid-cols-[120px_1fr] gap-2 items-center">
              <Input value={postSign[i]?.label ?? item.label} readOnly className="h-8 text-xs bg-muted/30" />
              <Input value={postSign[i]?.value ?? ""} onChange={(e) => {
                const next = [...postSign];
                next[i] = { label: item.label, value: e.target.value };
                setPostSign(next);
              }} className="h-8 text-sm" />
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={async () => {
            await saveContractPostSignInfo(contractId, postSign.length ? postSign : [{ label: "振込口座", value: "" }]);
            toast.success("保存しました");
          }}>保存</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function DocumentsTab({ contractId, customerName }: { contractId: string; customerName?: string }) {
  const [templateId, setTemplateId] = useState(CONTRACT_TEMPLATES[0]?.id ?? "");
  const tpl = CONTRACT_TEMPLATES.find((t) => t.id === templateId);

  return (
    <Card><CardContent className="p-4 space-y-4">
      <p className="text-sm text-muted-foreground">テンプレートを選択すると顧客情報が自動転記されます</p>
      <Select value={templateId} onValueChange={setTemplateId}>
        <SelectTrigger><SelectValue placeholder="テンプレート" /></SelectTrigger>
        <SelectContent>
          {CONTRACT_TEMPLATES.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
        </SelectContent>
      </Select>
      {tpl && (
        <div className="rounded-lg border p-4 bg-muted/20 text-sm space-y-2">
          <p className="font-semibold">{tpl.name}</p>
          <p>契約者: {customerName ?? "—"}</p>
          <p className="text-xs text-muted-foreground whitespace-pre-wrap">{tpl.description}</p>
        </div>
      )}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => toast.info("PDFプレビューを表示（印刷ダイアログ）")}>PDFプレビュー</Button>
        <Button size="sm" onClick={() => toast.success("PDFをダウンロードしました")}>ダウンロード</Button>
        <Button size="sm" variant="secondary" onClick={() => toast.success("送付処理を開始しました")}>送付</Button>
      </div>
    </CardContent></Card>
  );
}

function WorkflowTab({ contractId, title }: { contractId: string; title: string }) {
  return (
    <Card><CardContent className="p-4 space-y-3">
      <p className="text-sm">最新契約書の内容でワークフロー申請を行います</p>
      <Button size="sm" onClick={async () => {
        try {
          const req = await submitContractWorkflow(contractId, title);
          toast.success(`申請しました（${req.id.slice(0, 8)}…）`);
        } catch (e) { toast.error(e instanceof Error ? e.message : "申請に失敗"); }
      }}>承認ワークフローに申請</Button>
      <Link href="/workflow" className="text-xs text-primary hover:underline block">ワークフロー履歴を見る →</Link>
    </CardContent></Card>
  );
}

function EsignTab({ contractId, customerEmail }: { contractId: string; customerEmail?: string | null }) {
  const [email, setEmail] = useState(customerEmail ?? "");
  const [subject, setSubject] = useState("契約書のご確認");
  const [message, setMessage] = useState("お世話になっております。契約書を送付いたします。");

  return (
    <Card><CardContent className="p-4 space-y-3">
      <p className="text-sm text-muted-foreground">クラウドサイン連携（ワークフロー承認後に送信）</p>
      <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="メールアドレス" />
      <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="件名" />
      <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} />
      <Button size="sm" onClick={async () => {
        const res = await sendContractCloudSign(contractId, email, subject, message);
        toast.success(res.message);
      }}>クラウドサインで送信</Button>
    </CardContent></Card>
  );
}

function FilesTab({ contractId }: { contractId: string }) {
  const [docs, setDocs] = useState<Awaited<ReturnType<typeof getContractDocuments>>>([]);
  useEffect(() => { getContractDocuments(contractId).then(setDocs).catch(() => {}); }, [contractId]);
  return (
    <div className="space-y-2">
      {docs.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">ドキュメントなし</p> : docs.map((d) => (
        <div key={d.id} className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm">
          <span>{d.name}</span>
          <span className="text-xs text-muted-foreground">{format(new Date(d.created_at), "yyyy/MM/dd", { locale: ja })}</span>
        </div>
      ))}
    </div>
  );
}

function EstimatesTab({ contractId }: { contractId: string }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getContractEstimates>>>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEstimate, setSelectedEstimate] = useState<EstimateForView | null>(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);

  useEffect(() => {
    getContractEstimates(contractId).then(setRows).catch(() => {});
  }, [contractId]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedEstimate(null);
      return;
    }
    setLoadingEstimate(true);
    getEstimate(selectedId)
      .then((est) => setSelectedEstimate(est as unknown as EstimateForView))
      .catch(() => toast.error("見積の読み込みに失敗"))
      .finally(() => setLoadingEstimate(false));
  }, [selectedId]);

  if (selectedId && selectedEstimate) {
    return (
      <EstimateDetailView
        estimate={selectedEstimate}
        loading={loadingEstimate}
        onBack={() => setSelectedId(null)}
        onEstimateChange={(est) => setSelectedEstimate(est)}
      />
    );
  }

  return (
    <div className="space-y-2">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">見積なし</p>
      ) : (
        rows.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => setSelectedId(e.id)}
            className="w-full flex items-center justify-between border rounded-lg px-3 py-2 hover:bg-muted/30 text-sm text-left"
          >
            <span>{e.estimate_no} — {e.title}</span>
            <StatusBadge status={e.status} />
          </button>
        ))
      )}
    </div>
  );
}
