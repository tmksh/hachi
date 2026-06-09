import { AuthProvider } from "@/components/providers/auth-provider";
import { MainLayout } from "@/components/layout/main-layout";

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
