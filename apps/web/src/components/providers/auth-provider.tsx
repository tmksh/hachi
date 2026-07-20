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
import { type Role } from "@/lib/constants";
import { applyFontSize, isFontSize } from "@/lib/font-size";
import {
  canAccessPathWithPermissions,
  type RolePermissions,
} from "@/lib/role-permissions";

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
  const [rolePermissions, setRolePermissions] = useState<RolePermissions | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(
    async (authUser: User | null) => {
      if (!authUser) {
        setProfile(null);
        setRolePermissions(null);
        return;
      }
      const fontMeta = authUser.user_metadata?.font_size;
      if (isFontSize(fontMeta)) applyFontSize(fontMeta);
      const { data } = await supabase
        .from("profiles")
        .select("id, company_id, display_name, email, role, avatar_url, department, position, phone")
        .eq("id", authUser.id)
        .single();
      setProfile(data as Profile | null);

      if (data?.company_id) {
        const { data: company } = await supabase
          .from("companies")
          .select("settings")
          .eq("id", data.company_id)
          .maybeSingle();
        const settings = (company?.settings ?? null) as Record<string, unknown> | null;
        const rp = settings?.role_permissions;
        setRolePermissions(
          rp && typeof rp === "object" ? (rp as RolePermissions) : null,
        );
      } else {
        setRolePermissions(null);
      }
    },
    [supabase],
  );

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const authUser = session?.user ?? null;
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
      canAccess: (pathname: string) =>
        !!role && canAccessPathWithPermissions(pathname, role, rolePermissions),
      supabase,
    }),
    [user, profile, loading, signOut, role, rolePermissions, supabase],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const SSR_DEFAULT: AuthContextValue = {
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  role: null,
  isAdmin: false,
  isOwner: false,
  isManager: false,
  isEmployee: false,
  hasRole: () => false,
  canAccess: () => false,
  supabase: null as unknown as ReturnType<typeof createClient>,
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  // SSR時はAuthProviderのコンテキストが存在しないためSSRデフォルトを返す
  return ctx ?? SSR_DEFAULT;
}
