import { notFound } from "next/navigation";
import { getCraftsman } from "@/lib/actions/craftsmen";
import { CraftsmanEditClient } from "./craftsman-edit-client";

export default async function CraftsmanEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const initialCraftsman = await getCraftsman(id).catch(() => null);

  if (!initialCraftsman) {
    notFound();
  }

  return <CraftsmanEditClient id={id} initialCraftsman={initialCraftsman} />;
}
