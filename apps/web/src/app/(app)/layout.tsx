import { AuthProvider } from "@/components/providers/auth-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { MainLayout } from "@/components/layout/main-layout";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <AuthProvider>
        <MainLayout>{children}</MainLayout>
      </AuthProvider>
    </QueryProvider>
  );
}
