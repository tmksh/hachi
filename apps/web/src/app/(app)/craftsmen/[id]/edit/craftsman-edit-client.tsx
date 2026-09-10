"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, X, Plus } from "lucide-react";
import { updateCraftsman } from "@/lib/actions/craftsmen";
import type { fetchCraftsman } from "@/lib/queries/portal";
import { splitLeadingCode } from "@/lib/procurement";
import { CraftsmanMasterFields } from "@/components/craftsmen/craftsman-master-fields";
import { specialtyLabel } from "@/lib/craftsmen-options";

type Craftsman = Awaited<ReturnType<typeof fetchCraftsman>>;

function TagInput({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const v = input.trim();
    if (!v) return;
    if (values.includes(v)) {
      setInput("");
      return;
    }
    onChange([...values, v]);
    setInput("");
  };

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              add();
            }
          }}
          className="flex-1"
        />
        <Button type="button" variant="outline" size="icon" onClick={add}><Plus className="size-4" /></Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {values.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1 pr-1">
              {v}
              <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="hover:text-destructive ml-0.5">
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

type CraftsmanEditClientProps = {
  id: string;
  initialCraftsman: Craftsman;
};

export function CraftsmanEditClient({ id, initialCraftsman }: CraftsmanEditClientProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(initialCraftsman.name);
  const [companyName, setCompanyName] = useState(initialCraftsman.company_name ?? "");
  const [phone, setPhone] = useState(initialCraftsman.phone ?? "");
  const [email, setEmail] = useState(initialCraftsman.email ?? "");
  const [invoiceChannel, setInvoiceChannel] = useState<"email" | "paper">(
    initialCraftsman.invoice_channel === "paper" ? "paper" : "email",
  );
  const [specialty, setSpecialty] = useState(specialtyLabel(initialCraftsman.specialty));
  const [qualifications, setQualifications] = useState<string[]>(initialCraftsman.qualifications ?? []);
  const [rank, setRank] = useState(initialCraftsman.rank ?? "");
  const [notes, setNotes] = useState(initialCraftsman.notes ?? "");
  const [skills, setSkills] = useState<string[]>(initialCraftsman.skills ?? []);
  const [serviceAreas, setServiceAreas] = useState<string[]>(initialCraftsman.service_areas ?? []);
  const [contractRate, setContractRate] = useState(initialCraftsman.contract_rate != null ? String(initialCraftsman.contract_rate) : "");
  const [paymentNotes, setPaymentNotes] = useState(initialCraftsman.payment_notes ?? "");
  const parsedBank = splitLeadingCode(initialCraftsman.bank_name, 4);
  const parsedBranch = splitLeadingCode(initialCraftsman.bank_branch, 3);
  const [bankName, setBankName] = useState(parsedBank.rest || initialCraftsman.bank_name || "");
  const [bankNameKana, setBankNameKana] = useState(initialCraftsman.bank_name_kana ?? "");
  const [bankCode, setBankCode] = useState(initialCraftsman.bank_code ?? parsedBank.code);
  const [bankBranch, setBankBranch] = useState(parsedBranch.rest || initialCraftsman.bank_branch || "");
  const [bankBranchKana, setBankBranchKana] = useState(initialCraftsman.bank_branch_kana ?? "");
  const [bankBranchCode, setBankBranchCode] = useState(initialCraftsman.bank_branch_code ?? parsedBranch.code);
  const [bankAccountType, setBankAccountType] = useState(initialCraftsman.bank_account_type ?? "普通");
  const [bankAccountNumber, setBankAccountNumber] = useState(initialCraftsman.bank_account_number ?? "");
  const [bankAccountKana, setBankAccountKana] = useState(initialCraftsman.bank_account_kana ?? "");

  const handleSave = async () => {
    if (!name.trim()) { toast.error("名前を入力してください"); return; }
    setSaving(true);
    try {
      await updateCraftsman(id, {
        name: name.trim(),
        company_name: companyName || null,
        phone: phone || null,
        email: email || null,
        invoice_channel: invoiceChannel,
        specialty: specialty || null,
        qualifications,
        rank: (rank || null) as "A" | "B" | "C" | null,
        notes: notes || null,
        skills,
        service_areas: serviceAreas,
        contract_rate: contractRate !== "" ? Number(contractRate) : null,
        payment_notes: paymentNotes || null,
        bank_name: bankName || null,
        bank_name_kana: bankNameKana || null,
        bank_code: bankCode || null,
        bank_branch: bankBranch || null,
        bank_branch_kana: bankBranchKana || null,
        bank_branch_code: bankBranchCode || null,
        bank_account_type: bankAccountType || null,
        bank_account_number: bankAccountNumber || null,
        bank_account_kana: bankAccountKana || null,
      });
      toast.success("更新しました");
      router.push(`/craftsmen/${id}`);
    } catch { toast.error("更新に失敗"); } finally { setSaving(false); }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Link href={`/craftsmen/${id}`}><Button variant="ghost" size="icon" className="size-8"><ArrowLeft className="size-4" /></Button></Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">職人編集</h1>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">基本情報</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>名前 *</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="space-y-2"><Label>会社名</Label><Input value={companyName} onChange={e => setCompanyName(e.target.value)} /></div>
            <div className="space-y-2"><Label>電話</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
            <div className="space-y-2"><Label>メール</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div className="space-y-2 sm:col-span-2">
              <Label>請求書の受領方法</Label>
              <Select value={invoiceChannel} onValueChange={(v) => setInvoiceChannel(v as "email" | "paper")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">メール認証（ログイン不要）</SelectItem>
                  <SelectItem value="paper">紙発注・自社書式（社内でPDF添付）</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                紙発注・自社書式の業者は、検収完了一覧から請求書PDFを添付すると「請求書受領」へ進みます。
              </p>
            </div>
            <CraftsmanMasterFields
              specialty={specialty}
              onSpecialtyChange={setSpecialty}
              qualifications={qualifications}
              onQualificationsChange={setQualifications}
            />
            <div className="space-y-2">
              <Label>ランク</Label>
              <Select value={rank} onValueChange={setRank}>
                <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A</SelectItem>
                  <SelectItem value="B">B</SelectItem>
                  <SelectItem value="C">C</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">スキル</CardTitle></CardHeader>
          <CardContent>
            <TagInput label="" values={skills} onChange={setSkills} placeholder="例: 木造軸組、RC造…（Enter で追加）" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">対応可能エリア</CardTitle></CardHeader>
          <CardContent>
            <TagInput label="" values={serviceAreas} onChange={setServiceAreas} placeholder="例: 東京都、埼玉県…（Enter で追加）" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">契約・支払い</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>契約単価（円/日）</Label>
              <Input
                type="number"
                min={0}
                value={contractRate}
                onChange={e => setContractRate(e.target.value)}
                placeholder="例: 30000"
              />
            </div>
            <div className="space-y-2">
              <Label>支払い予定</Label>
              <Input
                value={paymentNotes}
                onChange={e => setPaymentNotes(e.target.value)}
                placeholder="例: 翌月末払い、月末締め翌25日払い"
              />
            </div>
            <div className="space-y-2">
              <Label>銀行コード（4桁）</Label>
              <Input inputMode="numeric" maxLength={4} value={bankCode} onChange={e => setBankCode(e.target.value)} placeholder="0005" />
            </div>
            <div className="space-y-2">
              <Label>銀行名（半角カナ）</Label>
              <Input value={bankNameKana} onChange={e => setBankNameKana(e.target.value)} placeholder="ﾐﾂﾋﾞｼﾕｰｴﾌｼﾞｴｲ" />
            </div>
            <div className="space-y-2">
              <Label>支店コード（3桁）</Label>
              <Input inputMode="numeric" maxLength={3} value={bankBranchCode} onChange={e => setBankBranchCode(e.target.value)} placeholder="267" />
            </div>
            <div className="space-y-2">
              <Label>支店名（半角カナ）</Label>
              <Input value={bankBranchKana} onChange={e => setBankBranchKana(e.target.value)} placeholder="ﾂﾙﾏｲ" />
            </div>
            <div className="space-y-2">
              <Label>振込先銀行（表示用）</Label>
              <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="三菱UFJ銀行" />
            </div>
            <div className="space-y-2">
              <Label>支店（表示用）</Label>
              <Input value={bankBranch} onChange={e => setBankBranch(e.target.value)} placeholder="鶴舞支店" />
            </div>
            <div className="space-y-2">
              <Label>預金種目</Label>
              <Select value={bankAccountType === "当座" ? "当座" : "普通"} onValueChange={setBankAccountType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="普通">普通</SelectItem>
                  <SelectItem value="当座">当座</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>口座番号（7桁）</Label>
              <Input inputMode="numeric" maxLength={7} value={bankAccountNumber} onChange={e => setBankAccountNumber(e.target.value)} placeholder="0039867" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>受取人名（半角カナ）</Label>
              <Input value={bankAccountKana} onChange={e => setBankAccountKana(e.target.value)} placeholder="ﾀﾅｶｹﾝｾﾂ(ｶ" />
              <p className="text-[11px] text-muted-foreground">帳票データ（全銀）の振込先に使います。銀行コード・支店コード・口座が無いと出力できません。</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">備考</CardTitle></CardHeader>
        <CardContent>
          <Textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)} />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Link href={`/craftsmen/${id}`}><Button variant="outline">キャンセル</Button></Link>
        <Button onClick={handleSave} disabled={saving}><Save className="size-4 mr-1" />{saving ? "保存中..." : "保存"}</Button>
      </div>
    </div>
  );
}
