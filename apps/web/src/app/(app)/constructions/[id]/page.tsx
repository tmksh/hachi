import { PageHeader } from "@/components/shared/page-header";

export default async function ConstructionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="工事詳細" description="準備中" />
      <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
        <p>このページは開発中です (ID: {id})</p>
      </div>
    </div>
  );
}
