import { AuthProvider } from "@/components/providers/auth-provider";
import { MainLayout } from "@/components/layout/main-layout";

export const dynamic = "force-dynamic";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <MainLayout>{children}</MainLayout>
    </AuthProvider>
  );
}
