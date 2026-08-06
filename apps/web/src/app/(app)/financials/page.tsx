import { Suspense } from "react";
import {
  getFinancialAccountItems,
  getFinancialReportSettings,
  listFinancialStatements,
} from "@/lib/actions/financial-statements";
import { FinancialsClient } from "./financials-client";

/**
 * 決算書画面（No.85/103）
 * 入口はBI画面のボタンのみ（サイドバーには追加しない）。
 * アクセス権限: hq_admin / admin / executive（middleware + ROUTE_ROLES で制御）
 */
export default async function FinancialsPage() {
  const [initialItems, initialStatements, initialSettings] = await Promise.all([
    getFinancialAccountItems().catch(() => []),
    listFinancialStatements().catch(() => []),
    getFinancialReportSettings().catch(() => null),
  ]);

  return (
    <Suspense
      fallback={
        <div className="p-4 md:p-6">
          <div className="mb-4 h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="h-96 animate-pulse rounded-xl bg-muted" />
        </div>
      }
    >
      <FinancialsClient
        initialItems={initialItems}
        initialStatements={initialStatements}
        initialSettings={initialSettings}
      />
    </Suspense>
  );
}
