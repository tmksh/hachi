"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { type Role, canAccessRoute } from "@/lib/constants";

export type Profile = {
  id: string;
  company_id: string;
  display_name: string;
  email: string;
  role: Role;
  avatar_url: string | null;
  department: string | null;
  position: string | null;
  phone: string | null;
};

type AuthContextValue = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  role: Role | null;
  isAdmin: boolean;
  isOwner: boolean;
  isManager: boolean;
  isEmployee: boolean;
  hasRole: (...roles: Role[]) => boolean;
  canAccess: (pathname: string) => boolean;
  supabase: ReturnType<typeof createClient>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(
    async (authUser: User | null) => {
      if (!authUser) {
        setProfile(null);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .single();
      setProfile(data as Profile | null);
    },
    [supabase],
  );

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(authUser);
      await loadProfile(authUser);
      if (mounted) setLoading(false);
    };

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (!nextUser) {
        setProfile(null);
        setLoading(false);
        return;
      }
      void loadProfile(nextUser);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }, [supabase]);

  const role = profile?.role ?? null;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      signOut,
      role,
      isAdmin: role === "hq_admin",
      isOwner: role === "hq_admin",
      isManager: role === "hq_admin" || role === "contractor_admin",
      isEmployee: role === "employee",
      hasRole: (...roles: Role[]) => !!role && roles.includes(role),
      canAccess: (pathname: string) => !!role && canAccessRoute(pathname, role),
      supabase,
    }),
    [user, profile, loading, signOut, role, supabase],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
