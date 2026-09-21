"use client";

import { useQuery } from "@tanstack/react-query";
import { getEstimateMarginThreshold } from "@/lib/actions/sales-flow";

/** 見積金額と承認基準を同じ会社設定で計算する。取得中を率0として扱わない。 */
export function useEstimateMarginInfo(estimateId: string, departmentName?: string | null) {
  return useQuery({
    queryKey: ["estimate-margin-info", estimateId, departmentName ?? ""],
    queryFn: async () => {
      const result = await getEstimateMarginThreshold(estimateId);
      if (!result) throw new Error("経営調整費・承認基準を取得できませんでした");
      return result;
    },
    enabled: Boolean(estimateId),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
