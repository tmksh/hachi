"use server";

import { createClient } from "@/lib/supabase/server";
import type { Document } from "@/lib/database.types";

export async function getDocuments(category?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("documents")
    .select("*, uploader:profiles!documents_uploaded_by_fkey(id, display_name)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (category && category !== "all") {
    query = query.eq("category", category);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createDocument(input: {
  name: string;
  category?: Document["category"];
  description?: string;
  storage_path: string;
  file_name: string;
  mime_type?: string;
  size?: number;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!profile) throw new Error("Profile not found");

  const { data, error } = await supabase
    .from("documents")
    .insert({
      company_id: profile.company_id,
      name: input.name,
      category: input.category || null,
      description: input.description || null,
      storage_path: input.storage_path,
      file_name: input.file_name,
      mime_type: input.mime_type || null,
      size: input.size || 0,
      uploaded_by: user.id,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Document;
}

export async function deleteDocument(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("documents").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
