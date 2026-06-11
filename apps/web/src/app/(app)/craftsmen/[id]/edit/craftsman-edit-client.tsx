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
import { getCraftsman, updateCraftsman } from "@/lib/actions/craftsmen";

type Craftsman = Awaited<ReturnType<typeof getCraftsman>>;

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
  const [specialty, setSpecialty] = useState(initialCraftsman.specialty ?? "");
  const [rank, setRank] = useState(initialCraftsman.rank ?? "");
  const [notes, setNotes] = useState(initialCraftsman.notes ?? "");
  const [skills, setSkills] = useState<string[]>(initialCraftsman.skills ?? []);
  const [serviceAreas, setServiceAreas] = useState<string[]>(initialCraftsman.service_areas ?? []);
  const [contractRate, setContractRate] = useState(initialCraftsman.contract_rate != null ? String(initialCraftsman.contract_rate) : "");
  const [paymentNotes, setPaymentNotes] = useState(initialCraftsman.payment_notes ?? "");

  const handleSave = async () => {
    if (!name.trim()) { toast.error("名前を入力してください"); return; }
    setSaving(true);
    try {
      await updateCraftsman(id, {
        name: name.trim(),
        company_name: companyName || null,
        phone: phone || null,
        email: email || null,
        specialty: (specialty || null) as "carpenter" | "electrical" | "interior" | "plumbing" | "general" | null,
        rank: (rank || null) as "A" | "B" | "C" | null,
        notes: notes || null,
        skills,
        service_areas: serviceAreas,
        contract_rate: contractRate !== "" ? Number(contractRate) : null,
        payment_notes: paymentNotes || null,
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
            <div className="space-y-2">
              <Label>専門</Label>
              <Select value={specialty} onValueChange={setSpecialty}>
                <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="carpenter">大工</SelectItem>
                  <SelectItem value="electrical">電気</SelectItem>
                  <SelectItem value="interior">内装</SelectItem>
                  <SelectItem value="plumbing">配管</SelectItem>
                  <SelectItem value="general">総合</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
