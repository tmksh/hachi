export type CraftsmanMasterItem = { id: string; label: string; sort_order: number };

export async function fetchCraftsmenMasterLists(): Promise<{
  specialties: CraftsmanMasterItem[];
  qualifications: CraftsmanMasterItem[];
}> {
  const res = await fetch("/api/settings/craftsmen-master", {
    cache: "no-store",
    credentials: "same-origin",
  });
  const data = (await res.json()) as {
    ok?: boolean;
    error?: string;
    specialties?: CraftsmanMasterItem[];
    qualifications?: CraftsmanMasterItem[];
  };
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? "マスタ一覧の取得に失敗しました");
  }
  return {
    specialties: data.specialties ?? [],
    qualifications: data.qualifications ?? [],
  };
}
