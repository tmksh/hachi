import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { LoginForm } from "./login-form";

async function getCompanyName(): Promise<string | null> {
  try {
    const headersList = await headers();
    const tenantId = headersList.get("x-tenant-id");
    if (!tenantId) return null;

    const supabase = createAdminClient();
    const { data } = await supabase
      .from("companies")
      .select("name")
      .eq("id", tenantId)
      .single();
    return data?.name ?? null;
  } catch {
    return null;
  }
}

export default async function LoginPage() {
  const companyName = await getCompanyName();

  return <LoginForm companyName={companyName} />;
}
