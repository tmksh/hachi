import { useQuery } from "@tanstack/react-query";
import { QK } from "@/lib/queries/portal";
import { fetchCraftsmenMasterLists } from "@/lib/queries/craftsmen-master";

export function useCraftsmenMasterOptions() {
  const { data, isPending } = useQuery({
    queryKey: QK.craftsmenMaster,
    queryFn: fetchCraftsmenMasterLists,
    staleTime: 0,
    refetchOnMount: "always",
  });
  return {
    specialties: data?.specialties ?? [],
    qualifications: data?.qualifications ?? [],
    isPending,
  };
}
