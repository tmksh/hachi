"use server";

import { createClient } from "@/lib/supabase/server";
import {
  findTemplate,
  mergeDefaults,
  resolveCompanyContext,
  type FormValues,
  type RenderContext,
} from "@/lib/contract-templates";
import { resolvePdfTemplates } from "@/lib/pdf-template";
import {
  buildContractArchiveHtml,
  contractArchiveDocumentName,
} from "@/lib/contract-document-archive";
import { archiveContractDocumentHtml } from "@/lib/actions/documents";
import { getCompany } from "@/lib/actions/profiles";

const DOC_PREFIX = "@@HACHI_DOC@@";

function parseContractDraft(notes: string | null | undefined): {
  template_id: string;
  form: FormValues;
  construction_id?: string;
} | null {
  if (!notes) return null;

  if (notes.startsWith(DOC_PREFIX)) {
    try {
      const meta = JSON.parse(notes.slice(DOC_PREFIX.length)) as {
        construction_id?: string;
        template_id: string;
        form: FormValues;
      };
      if (meta.template_id) {
        return {
          template_id: meta.template_id,
          form: meta.form ?? {},
          construction_id: meta.construction_id,
        };
      }
    } catch {
      // fall through
    }
  }

  try {
    const parsed = JSON.parse(notes) as {
      contract_draft?: { template_id: string; form: FormValues };
    };
    if (parsed.contract_draft?.template_id) {
      return {
        template_id: parsed.contract_draft.template_id,
        form: parsed.contract_draft.form ?? {},
      };
    }
  } catch {
    // plain text notes
  }

  return null;
}

/** 契約レコードのドラフトから documents へアーカイブ（WF承認時など） */
export async function archiveContractDocumentFromRecord(contractId: string) {
  const supabase = await createClient();
  const { data: contract } = await supabase
    .from("contracts")
    .select(`
      id, customer_id, title, start_date, end_date, amount, notes,
      customer:customers(name, address, company_name, customer_type, notes)
    `)
    .eq("id", contractId)
    .single();

  if (!contract?.customer_id) return { ok: false as const, reason: "no_customer" };

  const draft = parseContractDraft(contract.notes);
  if (!draft) return { ok: false as const, reason: "no_draft" };

  const tpl = findTemplate(draft.template_id);
  if (!tpl) return { ok: false as const, reason: "no_template" };

  const company = await getCompany();
  const pdfTpl = resolvePdfTemplates(
    (company?.settings as Record<string, unknown> | undefined)?.pdf_templates,
  ).contract ?? resolvePdfTemplates(null).contract;
  const companyCtx = resolveCompanyContext(company, pdfTpl);

  const customerRow = contract.customer;
  const customer = Array.isArray(customerRow) ? customerRow[0] : customerRow;
  const renderCtx: RenderContext = {
    construction: {
      title: contract.title,
      start_date: contract.start_date,
      end_date: contract.end_date,
      order_amount: contract.amount,
    },
    customer: customer ? {
      name: customer.name,
      address: customer.address,
      company_name: customer.company_name ?? null,
      customer_type: customer.customer_type ?? null,
      notes: customer.notes ?? null,
    } : null,
    company: companyCtx.name || companyCtx.address ? companyCtx : null,
  };

  const form = mergeDefaults(tpl, renderCtx, draft.form);
  const html = buildContractArchiveHtml(tpl, form, renderCtx, pdfTpl);
  const name = contractArchiveDocumentName(tpl.name);

  const doc = await archiveContractDocumentHtml({
    html,
    name,
    customer_id: contract.customer_id,
    construction_id: draft.construction_id,
    contract_id: contractId,
  });

  return { ok: true as const, documentId: doc.id };
}
