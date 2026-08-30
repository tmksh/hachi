"use client";

import Link from "next/link";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText, Calendar, CalendarRange, User, MapPin, Wallet,
  Percent, CreditCard, Shield, AlignLeft, Hash, ToggleLeft,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CONTRACT_TEMPLATES, type ContractTemplate, type TemplateField,
} from "@/lib/contract-templates";

export function getFieldIcon(fieldName: string, fieldType: string): LucideIcon {
  if (fieldType === "toggle") return ToggleLeft;
  if (fieldType === "textarea") return AlignLeft;
  if (fieldName.includes("date") || fieldName.includes("Date")) {
    return fieldName.includes("start") || fieldName.includes("end") ? CalendarRange : Calendar;
  }
  if (fieldName.includes("amount") || fieldName.includes("price")) return Wallet;
  if (fieldName.includes("tax")) return Percent;
  if (fieldName.includes("payment")) return CreditCard;
  if (fieldName.includes("warranty")) return Shield;
  if (fieldName.includes("kou_name") || fieldName.includes("otsu_name")) return User;
  if (fieldName.includes("address") || fieldName.includes("location")) return MapPin;
  if (fieldName.includes("days") || fieldName.includes("years")) return Hash;
  return FileText;
}

type FieldGroup = { title: string; description?: string; names: string[] };

const FIELD_GROUP_DEFS: FieldGroup[] = [
  { title: "契約基本", names: ["contract_date", "original_date"] },
  { title: "当事者", description: "甲（発注者）と乙（請負者）の情報", names: ["kou_name", "kou_address", "otsu_name", "otsu_address"] },
  { title: "工事・業務", names: ["work_name", "work_location", "original_work", "change_summary", "scope"] },
  { title: "金額・工期", description: "工期は工程表と連携されます", names: ["amount_excl_tax", "tax_rate", "start_date", "end_date"] },
  { title: "支払・条件", names: ["payment_terms", "warranty_years", "warranty_include"] },
  { title: "特記事項", names: ["special_notes_fixed", "special_notes"] },
  { title: "約款", description: "ひな形に含めるか、テキストエリアに貼るかを選べます", names: ["terms_mode", "terms_text"] },
  { title: "締結方法", names: ["esign_only"] },
];

export function groupFields(fields: TemplateField[]): { group: FieldGroup; fields: TemplateField[] }[] {
  const used = new Set<string>();
  const result: { group: FieldGroup; fields: TemplateField[] }[] = [];

  for (const def of FIELD_GROUP_DEFS) {
    const matched = fields.filter(f => def.names.includes(f.name) && !used.has(f.name));
    if (matched.length === 0) continue;
    matched.forEach(f => used.add(f.name));
    result.push({ group: def, fields: matched });
  }

  const rest = fields.filter(f => !used.has(f.name));
  if (rest.length > 0) {
    result.push({ group: { title: "その他", names: [] }, fields: rest });
  }
  return result;
}

const INPUT_CLS =
  "w-full rounded-lg border border-border/80 bg-white px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/45 focus:border-primary/50 focus:ring-2 focus:ring-primary/10";

export function ContractFormField({
  field,
  value,
  onChange,
}: {
  field: TemplateField;
  value: string | number | undefined;
  onChange: (v: string | number) => void;
}) {
  const Icon = getFieldIcon(field.name, field.type);
  const isToggle = field.type === "toggle";
  const isChecked = isToggle ? (Number(value) !== 0) : false;
  const isDate = field.type === "date";

  if (isToggle) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-white px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm font-medium text-foreground">
            {field.label}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={cn("text-xs font-medium", isChecked ? "text-green-600" : "text-muted-foreground")}>
            {field.name === "esign_only"
              ? (isChecked ? "電子文書" : "書面（2通）")
              : field.name === "terms_mode"
                ? (isChecked ? "テキスト" : "ひな形")
              : (isChecked ? "有効" : "無効")}
          </span>
          <Switch checked={isChecked} onCheckedChange={v => onChange(v ? 1 : 0)} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <label className="text-xs font-semibold text-slate-600">
          {field.label}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {field.readonly && (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200">
            テンプレート固定
          </span>
        )}
        {field.synced && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600 border border-blue-100">
            <CalendarRange className="h-3 w-3" />
            工程表連携
          </span>
        )}
      </div>
      {field.type === "textarea" ? (
        <textarea
          value={String(value ?? "")}
          onChange={e => { if (!field.readonly) onChange(e.target.value); }}
          readOnly={field.readonly}
          placeholder={field.placeholder ?? "入力してください"}
          rows={field.name === "terms_text" ? 8 : 3}
          className={cn(
            INPUT_CLS,
            "resize-y leading-relaxed",
            field.name === "terms_text" ? "min-h-[160px]" : "min-h-[72px]",
            field.readonly && "bg-slate-50 text-slate-600 cursor-default",
          )}
        />
      ) : (
        <div className="relative">
          {isDate && (
            <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
          )}
          <input
            type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
            value={String(value ?? "")}
            onChange={e => onChange(field.type === "number" ? Number(e.target.value) : e.target.value)}
            placeholder={field.placeholder ?? "入力してください"}
            className={cn(INPUT_CLS, isDate && "pl-9", field.type === "number" && "tabular-nums")}
          />
        </div>
      )}
    </div>
  );
}

export function ContractFormSection({
  title,
  description,
  fields,
  form,
  onChange,
}: {
  title: string;
  description?: string;
  fields: TemplateField[];
  form: Record<string, string | number | undefined>;
  onChange: (name: string, v: string | number) => void;
}) {
  const names = new Set(fields.map(f => f.name));
  const pairAmount = names.has("amount_excl_tax") && names.has("tax_rate");
  const pairDates = names.has("start_date") && names.has("end_date");
  const rendered = new Set<string>();

  const fieldEl = (field: TemplateField) => (
    <ContractFormField
      key={field.name}
      field={field}
      value={form[field.name]}
      onChange={v => onChange(field.name, v)}
    />
  );

  const amountField = fields.find(f => f.name === "amount_excl_tax");
  const taxField = fields.find(f => f.name === "tax_rate");
  const startField = fields.find(f => f.name === "start_date");
  const endField = fields.find(f => f.name === "end_date");
  const kouFields = fields.filter(f => f.name.startsWith("kou_"));
  const otsuFields = fields.filter(f => f.name.startsWith("otsu_"));
  const workName = fields.find(f => f.name === "work_name");
  const workLoc = fields.find(f => f.name === "work_location");
  const paymentField = fields.find(f => f.name === "payment_terms");
  const warrantyYears = fields.find(f => f.name === "warranty_years");
  const warrantyToggle = fields.find(f => f.name === "warranty_include");

  function renderDefaultFields() {
    return fields.map(field => {
      if (rendered.has(field.name)) return null;

      if (pairAmount && field.name === "amount_excl_tax" && amountField && taxField) {
        rendered.add("amount_excl_tax");
        rendered.add("tax_rate");
        return (
          <div key="amount-row" className="grid grid-cols-1 min-[400px]:grid-cols-[minmax(0,1fr)_minmax(120px,32%)] gap-3">
            {fieldEl(amountField)}
            {fieldEl(taxField)}
          </div>
        );
      }

      if (pairDates && field.name === "start_date" && startField && endField) {
        rendered.add("start_date");
        rendered.add("end_date");
        return (
          <div key="dates-row" className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
            {fieldEl(startField)}
            {fieldEl(endField)}
          </div>
        );
      }

      rendered.add(field.name);
      return fieldEl(field);
    });
  }

  function renderBody() {
    /* 当事者：甲・乙を左右2列 */
    if (title === "当事者" && kouFields.length > 0 && otsuFields.length > 0) {
      kouFields.forEach(f => rendered.add(f.name));
      otsuFields.forEach(f => rendered.add(f.name));
      return (
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-4">
          <div className="space-y-3 min-w-0">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">甲（発注者）</p>
            {kouFields.map(fieldEl)}
          </div>
          <div className="space-y-3 min-w-0">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">乙（請負者）</p>
            {otsuFields.map(fieldEl)}
          </div>
        </div>
      );
    }

    /* 工事・業務：名称と場所を横並び（あれば） */
    if (title === "工事・業務" && workName && workLoc) {
      const others = fields.filter(f => f.name !== "work_name" && f.name !== "work_location");
      rendered.add("work_name");
      rendered.add("work_location");
      return (
        <div className="space-y-3.5">
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
            {fieldEl(workName)}
            {fieldEl(workLoc)}
          </div>
          {others.map(f => {
            rendered.add(f.name);
            return fieldEl(f);
          })}
        </div>
      );
    }

    /* 支払・条件：支払条件は全幅、瑕疵は横並び */
    if (title === "支払・条件") {
      const rest = fields.filter(
        f => f.name !== "payment_terms" && f.name !== "warranty_years" && f.name !== "warranty_include",
      );
      return (
        <div className="space-y-3.5">
          {paymentField && fieldEl(paymentField)}
          {(warrantyYears || warrantyToggle) && (
            <div className="grid grid-cols-1 min-[420px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
              {warrantyYears && fieldEl(warrantyYears)}
              {warrantyToggle && fieldEl(warrantyToggle)}
            </div>
          )}
          {rest.map(f => {
            if (rendered.has(f.name)) return null;
            rendered.add(f.name);
            return fieldEl(f);
          })}
        </div>
      );
    }

    /* 約款：ひな形のときはテンプレート文面のみ。テキスト編集時だけテキストエリア */
    if (title === "約款") {
      const termsToggle = fields.find(f => f.name === "terms_mode");
      const termsText = fields.find(f => f.name === "terms_text");
      const editText = Number(form.terms_mode) !== 0;
      if (termsToggle) rendered.add("terms_mode");
      if (termsText) rendered.add("terms_text");
      return (
        <div className="space-y-3.5">
          {termsToggle && fieldEl(termsToggle)}
          {editText && termsText && fieldEl(termsText)}
          {!editText && (
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              ひな形の約款を契約書に含めます。種類ごとの標準約款です。直す場合は「約款をテキストで編集する」をオンにしてください。
            </p>
          )}
        </div>
      );
    }

    /* 契約基本：複数フィールドは横並び */
    if (title === "契約基本" && fields.length > 1) {
      return (
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
          {fields.map(f => {
            rendered.add(f.name);
            return fieldEl(f);
          })}
        </div>
      );
    }

    return <div className="space-y-3.5">{renderDefaultFields()}</div>;
  }

  return (
    <section className="rounded-xl border border-border/70 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden w-full">
      <div className="px-4 py-2.5 border-b border-border/60 bg-slate-50/80">
        <h4 className="text-xs font-bold text-slate-700 tracking-wide">{title}</h4>
        {description && (
          <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="px-4 py-3.5 w-full">{renderBody()}</div>
    </section>
  );
}

export function TemplatePicker({
  open, onOpenChange, onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (tpl: ContractTemplate) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>テンプレートを選択</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground pb-2">
          フォント・文字サイズは
          <Link href="/settings" className="text-primary underline underline-offset-2 mx-0.5">
            設定 → PDF編集 → 契約書
          </Link>
          と連携します。
        </p>
        <div className="space-y-2 py-1">
          {CONTRACT_TEMPLATES.map(tpl => (
            <button
              key={tpl.id}
              onClick={() => onSelect(tpl)}
              className="w-full flex items-start gap-3 rounded-xl border border-border bg-card p-3 hover:shadow-md hover:border-primary/40 transition-all text-left group"
            >
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{tpl.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{tpl.description}</p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
