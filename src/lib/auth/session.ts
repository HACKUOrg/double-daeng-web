import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/prisma";
import {
  hasAnyPermission,
  hasPermission,
  type Permission,
  type Role
} from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";

export async function getOptionalCurrentProfile() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const authUserId = data?.claims?.sub;

  if (error || !authUserId) {
    return null;
  }

  const prisma = getPrisma();

  return prisma.user.findUnique({
    where: {
      authUserId
    },
    include: {
      memberships: {
        include: {
          organization: true
        },
        orderBy: {
          organization: {
            name: "asc"
          }
        }
      }
    }
  });
}

export async function requireProfile() {
  const profile = await getOptionalCurrentProfile();

  if (!profile || profile.status !== "ACTIVE") {
    redirect("/login");
  }

  return profile;
}

export async function requireRole(allowedRoles: Role[]) {
  const profile = await requireProfile();

  if (!allowedRoles.includes(profile.role as Role)) {
    redirect(getLandingPath(profile.role as Role));
  }

  return profile;
}

export async function requirePermission(permission: Permission) {
  const profile = await requireProfile();

  if (!hasPermission(profile.role as Role, permission)) {
    redirect(getLandingPath(profile.role as Role));
  }

  return profile;
}

export async function requireAnyPermission(permissions: Permission[]) {
  const profile = await requireProfile();

  if (!hasAnyPermission(profile.role as Role, permissions)) {
    redirect(getLandingPath(profile.role as Role));
  }

  return profile;
}

export function getLandingPath(role: Role) {
  return role === "SA" ? "/admin" : "/app";
}
