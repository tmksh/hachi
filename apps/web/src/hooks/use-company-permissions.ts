"use client";

import { useEffect, useState, useCallback } from "react";
import { NAV_ITEM_ROLES, SYSTEM_PERMISSION_ROLES, type AssignableRole, type Role } from "@/lib/constants";
import { getCompany } from "@/lib/actions/profiles";

export type CustomRole = {
  id: string;
  name: string;
  base_role: AssignableRole;
  color: string;
};

/** 機能キー → 許可ロール slug 配列 */
export type RolePermissions = Record<string, string[]>;

const STORAGE_KEY = "bridge_role_permissions";
const CUSTOM_ROLES_KEY = "bridge_custom_roles";

/** NAV_ITEM_ROLES から初期値を生成 */
function buildDefaultPerms(): RolePermissions {
  const all: Role[] = [...SYSTEM_PERMISSION_ROLES];
  const result: RolePermissions = {};
  const allKeys = [
    "dashboard", "bi", "crm", "deals", "quotes", "craftsmen",
    "contracts", "constructions", "invoices", "budget",
    "calendar", "mail", "attendance", "workflow", "circulation", "documents",
  ];
  allKeys.forEach((key) => {
    const restricted = NAV_ITEM_ROLES[key] as Role[] | undefined;
    result[key] = restricted ? [...restricted] : [...all];
  });
  result["settings_member"]     = ["hq_admin"];
  result["settings_company"]    = ["hq_admin"];
  result["settings_attendance"] = ["hq_admin"];
  result["settings_workflow"]   = ["hq_admin"];
  result["settings_crm"]        = ["hq_admin"];
  return result;
}

export const DEFAULT_PERMISSIONS = buildDefaultPerms();

export function useCompanyPermissions() {
  const [permissions, setPermissions] = useState<RolePermissions>(() => {
    if (typeof window === "undefined") return DEFAULT_PERMISSIONS;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...DEFAULT_PERMISSIONS, ...JSON.parse(stored) } : DEFAULT_PERMISSIONS;
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
      const company = await getCompany();
      if (!company) return;
      const s = company.settings as Record<string, unknown>;
      if (s?.role_permissions) {
        const merged = { ...DEFAULT_PERMISSIONS, ...(s.role_permissions as RolePermissions) };
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
    void refresh();
  }, [refresh]);

  /** ロール（システム or カスタム）が機能キーにアクセスできるか */
  const canAccess = useCallback(
    (featureKey: string, roleSlugs: string[]): boolean => {
      const allowed = permissions[featureKey];
      if (!allowed) return true;
      return roleSlugs.some((r) => allowed.includes(r));
    },
    [permissions],
  );

  return { permissions, customRoles, canAccess, refresh };
}
