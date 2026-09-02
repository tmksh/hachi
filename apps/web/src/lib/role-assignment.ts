import { ASSIGNABLE_TEAM_ROLES, ROLE_LABELS, type AssignableRole } from "@/lib/constants";

export type CustomRoleRef = {
  id: string;
  name: string;
  base_role: string;
};

export type MemberCustomRoles = Record<string, string>;

export function isAssignableRole(role: string): role is AssignableRole {
  return (ASSIGNABLE_TEAM_ROLES as readonly string[]).includes(role);
}

export function readMemberCustomRoles(settings: Record<string, unknown> | null | undefined): MemberCustomRoles {
  const raw = settings?.member_custom_roles;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: MemberCustomRoles = {};
  for (const [userId, roleId] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof roleId === "string" && roleId) out[userId] = roleId;
  }
  return out;
}

export function pruneMemberCustomRoles(
  map: MemberCustomRoles,
  customRoles: CustomRoleRef[],
): MemberCustomRoles {
  const valid = new Set(customRoles.map((r) => r.id));
  const next: MemberCustomRoles = {};
  for (const [userId, roleId] of Object.entries(map)) {
    if (valid.has(roleId)) next[userId] = roleId;
  }
  return next;
}

export function resolveRoleSelection(
  selected: string,
  customRoles: CustomRoleRef[],
): { role: AssignableRole; customRoleId: string | null } {
  const cr = customRoles.find((r) => r.id === selected);
  if (cr && isAssignableRole(cr.base_role)) {
    return { role: cr.base_role, customRoleId: cr.id };
  }
  if (isAssignableRole(selected)) {
    return { role: selected, customRoleId: null };
  }
  throw new Error("不正なロールです");
}

export function assignedRoleValue(member: {
  role: string;
  custom_role_id?: string | null;
}): string {
  return member.custom_role_id || member.role;
}

export function permissionRoleSlugs(profile: {
  role?: string | null;
  custom_role_id?: string | null;
}): string[] {
  if (profile.custom_role_id) return [profile.custom_role_id];
  return profile.role ? [profile.role] : [];
}

export function roleDisplayLabel(
  role: string | null | undefined,
  customRoleId: string | null | undefined,
  customRoles: CustomRoleRef[],
): string {
  if (customRoleId) {
    const cr = customRoles.find((r) => r.id === customRoleId);
    if (cr?.name) return cr.name;
  }
  if (role && role in ROLE_LABELS) return ROLE_LABELS[role as keyof typeof ROLE_LABELS];
  return role ?? "";
}
