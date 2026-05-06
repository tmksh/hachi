"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "./sidebar";
import { AdminSidebar } from "./admin-sidebar";
import { MobileNav } from "./mobile-nav";
import { Skeleton } from "@/components/ui/skeleton";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { profile, loading, signOut } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const pathname = usePathname();
  const isAdminLogin = pathname === "/admin/login";
  const isAdminConsole = (pathname?.startsWith("/admin") ?? false) && !isAdminLogin;

  if (isAdminLogin) {
    return <>{children}</>;
  }

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

  if (isAdminConsole) {
    return (
      <div className="min-h-screen">
        <AdminSidebar />
        <main className="hidden md:block" style={{ paddingLeft: 220 + 12 + 12 }}>
          <div className="mx-auto max-w-[1600px]">
            {children}
          </div>
        </main>
        <main className="md:hidden pb-20">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Sidebar
        profile={profile}
        onSignOut={signOut}
        expanded={expanded}
        onExpandedChange={setExpanded}
      />
      <MobileNav />
      {/* Desktop */}
      <motion.main
        animate={{ paddingLeft: expanded ? 220 + 12 + 12 : 68 + 12 + 12 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="hidden md:block"
      >
        <div className="mx-auto max-w-[1600px]">
          {children}
        </div>
      </motion.main>
      {/* Mobile */}
      <main className="md:hidden pb-32">
        {children}
      </main>
    </div>
  );
}
