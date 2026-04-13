"use client";

import { useEffect, useState } from "react";
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

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        setProfile(data);
      }

      setLoading(false);
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const role = profile?.role ?? null;

  /** owner または hq_admin */
  const isAdmin = role === "owner" || role === "hq_admin";
  /** オーナーのみ */
  const isOwner = role === "owner";
  /** 施工店管理者以上 (contractor_admin | hq_admin | owner) */
  const isManager = role === "owner" || role === "hq_admin" || role === "contractor_admin";
  /** 一般社員 */
  const isEmployee = role === "employee";

  /** 指定ロールのいずれかに該当するか */
  const hasRole = (...roles: Role[]) => !!role && roles.includes(role);

  /** パスにアクセス権があるか (ミドルウェアと同じロジック) */
  const canAccess = (pathname: string) =>
    !!role && canAccessRoute(pathname, role);

  return {
    user,
    profile,
    loading,
    signOut,
    role,
    isAdmin,
    isOwner,
    isManager,
    isEmployee,
    hasRole,
    canAccess,
    supabase,
  };
}
