import { AuthProvider } from "@/components/providers/auth-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { MainLayout } from "@/components/layout/main-layout";

export default function AppLayout({
  children,
  detail,
}: {
  children: React.ReactNode;
  detail: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <AuthProvider>
        <MainLayout>{children}{detail}</MainLayout>
      </AuthProvider>
    </QueryProvider>
  );
}
