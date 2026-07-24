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
  mergeRolePermissions,
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

      // 内容が同じなら setState しない（Auth 購読者全体の再レンダー防止）
      setProfile((prev) => {
        const next = (data as Profile | null) ?? null;
        if (
          prev
          && next
          && prev.id === next.id
          && prev.role === next.role
          && prev.display_name === next.display_name
          && prev.avatar_url === next.avatar_url
          && prev.company_id === next.company_id
          && prev.email === next.email
          && prev.department === next.department
          && prev.position === next.position
          && prev.phone === next.phone
        ) {
          return prev;
        }
        return next;
      });

      if (!data?.company_id) {
        setRolePermissions(null);
        return;
      }

      const { data: company } = await supabase
        .from("companies")
        .select("settings")
        .eq("id", data.company_id)
        .maybeSingle();
      const settings = (company?.settings ?? null) as Record<string, unknown> | null;
      const rp = settings?.role_permissions;
      const nextPerms =
        rp && typeof rp === "object"
          ? mergeRolePermissions(rp as RolePermissions)
          : null;
      setRolePermissions((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(nextPerms)) return prev;
        return nextPerms;
      });
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
      // セッション確定時点でシェル描画を解放し、profile は裏で読む
      setLoading(false);
      if (authUser) await loadProfile(authUser);
    };

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // トークン更新・初期セッションではプロフィール再取得しない（全体再レンダーの主因）
      if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") return;

      const nextUser = session?.user ?? null;
      setUser((prev) => (prev?.id === nextUser?.id ? prev : nextUser));
      if (!nextUser) {
        setProfile(null);
        setRolePermissions(null);
        setLoading(false);
        return;
      }
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        void loadProfile(nextUser);
      }
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
