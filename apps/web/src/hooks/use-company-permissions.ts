"use client";

import { useEffect, useState, useCallback } from "react";
import { type AssignableRole } from "@/lib/constants";
import { getCompanySettings } from "@/lib/actions/profiles";
import {
  DEFAULT_ROLE_PERMISSIONS,
  mergeRolePermissions,
  canAccessFeature,
  type RolePermissions,
} from "@/lib/role-permissions";

export type CustomRole = {
  id: string;
  name: string;
  base_role: AssignableRole;
  color: string;
};

export type { RolePermissions };

const STORAGE_KEY = "bridge_role_permissions";
const CUSTOM_ROLES_KEY = "bridge_custom_roles";

export const DEFAULT_PERMISSIONS = DEFAULT_ROLE_PERMISSIONS;

export function useCompanyPermissions() {
  const [permissions, setPermissions] = useState<RolePermissions>(() => {
    if (typeof window === "undefined") return DEFAULT_PERMISSIONS;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? mergeRolePermissions(JSON.parse(stored) as RolePermissions) : DEFAULT_PERMISSIONS;
    } catch {
      return DEFAULT_PERMISSIONS;
    }
  });

  const [customRoles, setCustomRoles] = useState<CustomRole[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(CUSTOM_ROLES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const refresh = useCallback(async () => {
    try {
      const s = await getCompanySettings();
      if (!s) return;
      if (s?.role_permissions) {
        const merged = mergeRolePermissions(s.role_permissions as RolePermissions);
        setPermissions(merged);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s.role_permissions));
      }
      if (s?.custom_roles) {
        const cr = s.custom_roles as CustomRole[];
        setCustomRoles(cr);
        localStorage.setItem(CUSTOM_ROLES_KEY, JSON.stringify(cr));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    // 権限マトリクスはメニュー表示の正本のため、遅延せず即時取得する
    void refresh();
  }, [refresh]);

  /** ロール（システム or カスタム）が機能キーにアクセスできるか — マトリクス正本 */
  const canAccess = useCallback(
    (featureKey: string, roleSlugs: string[]): boolean => {
      return canAccessFeature(featureKey, roleSlugs, permissions);
    },
    [permissions],
  );

  return { permissions, customRoles, canAccess, refresh };
}
