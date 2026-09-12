import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseTenantSlug, resolveAppDomain } from "@/lib/tenant-host";
import { LoginForm } from "./login-form";

async function getCompanyContext(): Promise<{ name: string | null; tenantId: string | null }> {
  try {
    const headersList = await headers();
    const host = headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "";
    const tenantIdFromHeader = headersList.get("x-tenant-id");
    const slug = parseTenantSlug(host, resolveAppDomain(host, process.env.NEXT_PUBLIC_APP_DOMAIN));

    const supabase = createAdminClient();
    if (tenantIdFromHeader) {
      const { data } = await supabase
        .from("companies")
        .select("name")
        .eq("id", tenantIdFromHeader)
        .single();
      return { name: data?.name ?? null, tenantId: tenantIdFromHeader };
    }
    if (slug) {
      const { data: companyId } = await supabase.rpc("resolve_company_id_by_slug", { p_slug: slug });
      if (typeof companyId === "string" && companyId) {
        const { data } = await supabase
          .from("companies")
          .select("name")
          .eq("id", companyId)
          .single();
        return { name: data?.name ?? null, tenantId: companyId };
      }
    }
    return { name: null, tenantId: null };
  } catch {
    return { name: null, tenantId: null };
  }
}

export default async function LoginPage() {
  const { name, tenantId } = await getCompanyContext();

  return <LoginForm companyName={name} tenantId={tenantId} />;
}
