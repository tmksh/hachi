import { CrmClient } from "./crm-client";

type ViewMode = "grid" | "list" | "pipeline";

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const params = await searchParams;
  const view = params.view;
  const initialView: ViewMode =
    view === "pipeline" || view === "grid" || view === "list" ? view : "list";
  return <CrmClient initialView={initialView} />;
}
