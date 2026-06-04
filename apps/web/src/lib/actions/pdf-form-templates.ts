"use server";

import { createClient } from "@/lib/supabase/server";
import {
  PDF_FORM_TEMPLATES_KEY,
  resolvePdfFormTemplates,
  type PdfFormTemplate,
} from "@/lib/pdf-form-template";

async function getCompanyContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("Profile not found");
  return { supabase, companyId: profile.company_id, role: profile.role, userId: user.id };
}

/** 会社のPDFフォームテンプレート一覧 */
export async function getPdfFormTemplates(): Promise<PdfFormTemplate[]> {
  const { supabase, companyId } = await getCompanyContext();
  const { data } = await supabase
    .from("companies")
    .select("settings")
    .eq("id", companyId)
    .single();
  const raw = (data?.settings as Record<string, unknown> | null)?.[PDF_FORM_TEMPLATES_KEY];
  return resolvePdfFormTemplates(raw);
}

/** テンプレートを保存（新規 or 更新）。管理者(hq_admin)のみ。 */
export async function savePdfFormTemplate(template: PdfFormTemplate): Promise<PdfFormTemplate> {
  const { supabase, companyId, role } = await getCompanyContext();
  if (role !== "hq_admin") throw new Error("権限がありません");

  const { data: current } = await supabase
    .from("companies")
    .select("settings")
    .eq("id", companyId)
    .single();

  const settings = (current?.settings as Record<string, unknown> | null) ?? {};
  const list = resolvePdfFormTemplates(settings[PDF_FORM_TEMPLATES_KEY]);

  const now = new Date().toISOString();
  const idx = list.findIndex((t) => t.id === template.id);
  const next: PdfFormTemplate = {
    ...template,
    updatedAt: now,
    createdAt: idx >= 0 ? list[idx].createdAt : (template.createdAt || now),
  };
  if (idx >= 0) list[idx] = next;
  else list.push(next);

  const { error } = await supabase
    .from("companies")
    .update({ settings: { ...settings, [PDF_FORM_TEMPLATES_KEY]: list } })
    .eq("id", companyId);
  if (error) throw error;
  return next;
}

/** テンプレート削除。管理者(hq_admin)のみ。 */
export async function deletePdfFormTemplate(id: string): Promise<void> {
  const { supabase, companyId, role } = await getCompanyContext();
  if (role !== "hq_admin") throw new Error("権限がありません");

  const { data: current } = await supabase
    .from("companies")
    .select("settings")
    .eq("id", companyId)
    .single();
  const settings = (current?.settings as Record<string, unknown> | null) ?? {};
  const list = resolvePdfFormTemplates(settings[PDF_FORM_TEMPLATES_KEY]).filter((t) => t.id !== id);

  const { error } = await supabase
    .from("companies")
    .update({ settings: { ...settings, [PDF_FORM_TEMPLATES_KEY]: list } })
    .eq("id", companyId);
  if (error) throw error;
}

/** Storage 上の PDF への署名付きURLを返す（表示・差し込み用） */
export async function getPdfFormTemplateUrl(storagePath: string): Promise<string | null> {
  const { supabase } = await getCompanyContext();
  const { data, error } = await supabase
    .storage
    .from("documents")
    .createSignedUrl(storagePath, 3600);
  if (error || !data) return null;
  return data.signedUrl;
}
