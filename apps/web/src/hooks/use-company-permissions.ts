"use client";

import { useEffect, useState, useCallback } from "react";
import { NAV_ITEM_ROLES, type Role } from "@/lib/constants";
import { getCompany } from "@/lib/actions/profiles";

export type CustomRole = {
  id: string;
  name: string;
  base_role: "hq_admin" | "contractor_admin" | "employee";
  color: string;
};

/** 機能キー → 許可ロール slug 配列 */
export type RolePermissions = Record<string, string[]>;

const STORAGE_KEY = "bridge_role_permissions";
const CUSTOM_ROLES_KEY = "bridge_custom_roles";

/** NAV_ITEM_ROLES から初期値を生成（owner は常に全機能アクセス） */
function buildDefaultPerms(): RolePermissions {
  const all: Role[] = ["owner", "hq_admin", "contractor_admin", "employee"];
  const result: RolePermissions = {};
  // 制限なし機能はすべてのロールに付与
  const allKeys = [
    "dashboard", "bi", "crm", "deals", "quotes", "craftsmen",
    "contracts", "constructions", "invoices", "budget",
    "calendar", "mail", "attendance", "workflow", "circulation", "documents",
  ];
  allKeys.forEach((key) => {
    const restricted = NAV_ITEM_ROLES[key] as Role[] | undefined;
    result[key] = restricted ? [...restricted] : [...all];
  });
  // 管理系
  result["settings_member"]     = ["owner", "hq_admin"];
  result["settings_company"]    = ["owner", "hq_admin"];
  result["settings_attendance"] = ["owner", "hq_admin"];
  result["settings_workflow"]   = ["owner", "hq_admin"];
  result["settings_crm"]        = ["owner", "hq_admin"];
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
