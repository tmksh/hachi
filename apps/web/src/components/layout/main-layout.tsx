"use client";

import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { Skeleton } from "@/components/ui/skeleton";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { profile, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center mx-auto animate-pulse">
            <span className="text-primary-foreground font-bold text-lg">B</span>
          </div>
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Sidebar profile={profile} onSignOut={signOut} />
      <MobileNav />
      <main className="md:pl-[72px] pb-20 md:pb-0">
        <div className="mx-auto max-w-[1600px]">
          {children}
        </div>
      </main>
    </div>
  );
}
