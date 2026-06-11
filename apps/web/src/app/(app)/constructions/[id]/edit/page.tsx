import { notFound } from "next/navigation";
import { getConstruction } from "@/lib/actions/constructions";
import { getBiDepartmentNames } from "@/lib/actions/bi";
import { ConstructionEditClient } from "./construction-edit-client";

export default async function ConstructionEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [initialConstruction, initialDepartments] = await Promise.all([
    getConstruction(id).catch(() => null),
    getBiDepartmentNames().catch(() => []),
  ]);

  if (!initialConstruction) {
    notFound();
  }

  return (
    <ConstructionEditClient
      id={id}
      initialConstruction={initialConstruction}
      initialDepartments={initialDepartments}
    />
  );
}
