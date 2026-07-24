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

/** Sidebar + MobileNav の二重 fetch を1本にまとめる */
let inflightSettings: Promise<{
  role_permissions?: RolePermissions;
  custom_roles?: CustomRole[];
} | null> | null = null;

function fetchCompanySettingsOnce(force = false) {
  if (force) inflightSettings = null;
  if (!inflightSettings) {
    inflightSettings = getCompanySettings()
      .then((s) => s)
      .finally(() => {
        // 短いクールダウン後に再取得可能にする
        setTimeout(() => {
          inflightSettings = null;
        }, 2_000);
      });
  }
  return inflightSettings;
}

function readLocalPermissions(): RolePermissions {
  if (typeof window === "undefined") return DEFAULT_PERMISSIONS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored
      ? mergeRolePermissions(JSON.parse(stored) as RolePermissions)
      : DEFAULT_PERMISSIONS;
  } catch {
    return DEFAULT_PERMISSIONS;
  }
}

export function useCompanyPermissions() {
  const [permissions, setPermissions] = useState<RolePermissions>(readLocalPermissions);

  const [customRoles, setCustomRoles] = useState<CustomRole[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(CUSTOM_ROLES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const refresh = useCallback(async (force = false) => {
    try {
      const s = await fetchCompanySettingsOnce(force);
      if (!s) return;

      // サーバ未保存でもデフォルトへ同期し、古い localStorage を破棄する
      const raw = (s.role_permissions && typeof s.role_permissions === "object")
        ? (s.role_permissions as RolePermissions)
        : null;
      const merged = mergeRolePermissions(raw);
      setPermissions((prev) =>
        JSON.stringify(prev) === JSON.stringify(merged) ? prev : merged,
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(raw ?? merged));

      if (s?.custom_roles) {
        const cr = s.custom_roles as CustomRole[];
        setCustomRoles((prev) =>
          JSON.stringify(prev) === JSON.stringify(cr) ? prev : cr,
        );
        localStorage.setItem(CUSTOM_ROLES_KEY, JSON.stringify(cr));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    // 初回メニューは localStorage で即描画し、設定取得は idle 後に更新
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const start = () => {
      void refresh(true);
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(start, { timeout: 2500 });
    } else {
      timeoutId = setTimeout(start, 400);
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === CUSTOM_ROLES_KEY) {
        void refresh(true);
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      window.removeEventListener("storage", onStorage);
    };
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
