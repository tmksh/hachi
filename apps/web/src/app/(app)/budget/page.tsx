import { PageHeader } from "@/components/shared/page-header";

export default function BudgetPage() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="予算管理" description="準備中" />
      <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
        <p>このページは開発中です</p>
      </div>
    </div>
  );
}
