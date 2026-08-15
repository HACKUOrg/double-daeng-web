"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAnyPermission, requirePermission } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { getPrisma } from "@/lib/prisma";
import { canCreateRole, type Role } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";

const uuidSchema = z.string().uuid();
const emailSchema = z.string().trim().email().max(254);
const displayNameSchema = z.string().trim().min(1).max(120);
const passwordSchema = z.string().min(8).max(128);
const managedRoleSchema = z.enum(["MANAGER", "OPERATION"]);
const userStatusSchema = z.enum(["ACTIVE", "SUSPENDED"]);
const suspendedAuthDuration = "876000h";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getStrings(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string");
}

function usersPath(actorRole: Role, search: string) {
  return actorRole === "SA" ? `/admin/users?${search}` : `/app/users?${search}`;
}

function invalidUser(actorRole: Role): never {
  redirect(usersPath(actorRole, "error=invalid-user"));
}

function forbiddenUser(actorRole: Role): never {
  redirect(usersPath(actorRole, "error=forbidden-user"));
}

function userSnapshot(user: {
  id: string;
  authUserId: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  memberships?: {
    organizationId: string;
    organization?: {
      name: string;
    };
  }[];
}) {
  return {
    id: user.id,
    authUserId: user.authUserId,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    organizationIds:
      user.memberships?.map((membership) => membership.organizationId) ?? [],
    organizationNames:
      user.memberships
        ?.map((membership) => membership.organization?.name)
        .filter((name): name is string => Boolean(name)) ?? []
  };
}

function authUserPayload({
  displayName,
  role,
  status
}: {
  displayName: string;
  role: string;
  status: string;
}) {
  return {
    app_metadata: {
      role,
      status
    },
    user_metadata: {
      display_name: displayName
    },
    ban_duration: status === "SUSPENDED" ? suspendedAuthDuration : "none"
  };
}

async function requireUserManager() {
  const actor = await requireAnyPermission([
    "users.manage.all",
    "users.manage.organization"
  ]);

  return {
    actor,
    prisma: getPrisma()
  };
}

function actorActiveOrganizationIds(
  actor: Awaited<ReturnType<typeof requireAnyPermission>>
) {
  return actor.memberships
    .filter((membership) => membership.organization.status === "ACTIVE")
    .map((membership) => membership.organizationId);
}

async function resolveAssignableOrganizations({
  actor,
  organizationIds,
  prisma
}: {
  actor: Awaited<ReturnType<typeof requireAnyPermission>>;
  organizationIds: string[];
  prisma: ReturnType<typeof getPrisma>;
}) {
  const uniqueOrganizationIds = [...new Set(organizationIds)];

  if (!uniqueOrganizationIds.length) {
    invalidUser(actor.role as Role);
  }

  const organizations = await prisma.organization.findMany({
    where: {
      id: {
        in: uniqueOrganizationIds
      },
      status: "ACTIVE"
    },
    select: {
      id: true,
      name: true
    }
  });

  if (organizations.length !== uniqueOrganizationIds.length) {
    invalidUser(actor.role as Role);
  }

  if (actor.role !== "SA") {
    const allowedOrganizationIds = actorActiveOrganizationIds(actor);
    const unauthorized = uniqueOrganizationIds.some(
      (organizationId) => !allowedOrganizationIds.includes(organizationId)
    );

    if (unauthorized) {
      forbiddenUser(actor.role as Role);
    }
  }

  return organizations;
}

async function getManagedUserOrRedirect({
  actor,
  prisma,
  userId
}: {
  actor: Awaited<ReturnType<typeof requireAnyPermission>>;
  prisma: ReturnType<typeof getPrisma>;
  userId: string;
}) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
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

  if (!user || user.role === "SA") {
    invalidUser(actor.role as Role);
  }

  if (!canCreateRole(actor.role as Role, user.role as Role)) {
    forbiddenUser(actor.role as Role);
  }

  if (actor.role !== "SA") {
    const allowedOrganizationIds = actorActiveOrganizationIds(actor);
    const inActorScope = user.memberships.some((membership) =>
      allowedOrganizationIds.includes(membership.organizationId)
    );
    const outsideActorScope = user.memberships.some(
      (membership) => !allowedOrganizationIds.includes(membership.organizationId)
    );

    if (!inActorScope || outsideActorScope) {
      forbiddenUser(actor.role as Role);
    }
  }

  return user;
}

function revalidateUsers(actorRole: Role) {
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/memberships");
  revalidatePath("/app");

  if (actorRole !== "SA") {
    revalidatePath("/app/users");
  }
}

function adminUserPath(userId?: string, search?: string) {
  const path = userId ? `/admin/users/${userId}` : "/admin/users/new";
  return search ? `${path}?${search}` : path;
}

function invalidAdminUser(userId?: string): never {
  redirect(adminUserPath(userId, "error=invalid-user"));
}

function forbiddenAdminUser(userId?: string): never {
  redirect(adminUserPath(userId, "error=forbidden-user"));
}

async function requireAdminUserManager() {
  const actor = await requirePermission("users.manage.all");

  return {
    actor,
    prisma: getPrisma()
  };
}

async function getAdminManagedUserOrRedirect({
  actor,
  prisma,
  userId
}: {
  actor: Awaited<ReturnType<typeof requirePermission>>;
  prisma: ReturnType<typeof getPrisma>;
  userId: string;
}) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
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

  if (!user || user.role === "SA" || user.role === "RESIDENT") {
    invalidAdminUser(userId);
  }

  if (!canCreateRole(actor.role as Role, user.role as Role)) {
    forbiddenAdminUser(userId);
  }

  return user;
}

export async function createAdminManagedUser(formData: FormData) {
  const { actor, prisma } = await requireAdminUserManager();
  const actorRole = actor.role as Role;
  const parsed = z
    .object({
      email: emailSchema,
      password: passwordSchema,
      displayName: displayNameSchema,
      role: managedRoleSchema
    })
    .safeParse({
      email: getString(formData, "email"),
      password: getString(formData, "password"),
      displayName: getString(formData, "displayName"),
      role: getString(formData, "role")
    });

  if (!parsed.success) {
    invalidAdminUser();
  }

  if (!canCreateRole(actorRole, parsed.data.role)) {
    forbiddenAdminUser();
  }

  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    app_metadata: {
      role: parsed.data.role,
      status: "ACTIVE"
    },
    user_metadata: {
      display_name: parsed.data.displayName
    }
  });
  const authUserId = data.user?.id;

  if (error || !authUserId) {
    invalidAdminUser();
  }

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          authUserId,
          email: parsed.data.email,
          displayName: parsed.data.displayName,
          role: parsed.data.role,
          status: "ACTIVE"
        }
      });

      await writeAuditLog(tx, {
        actorUserId: actor.id,
        action: "user.create",
        entityType: "user",
        entityId: user.id,
        organizationId: null,
        after: userSnapshot(user)
      });
    });
  } catch (createError) {
    await supabaseAdmin.auth.admin.deleteUser(authUserId);
    throw createError;
  }

  revalidateUsers(actorRole);
  const createdUser = await prisma.user.findUnique({
    where: { authUserId },
    select: { id: true }
  });

  if (!createdUser) {
    invalidAdminUser();
  }

  redirect(adminUserPath(createdUser.id, "created=user"));
}

export async function updateAdminManagedUser(formData: FormData) {
  const { actor, prisma } = await requireAdminUserManager();
  const actorRole = actor.role as Role;
  const parsed = z
    .object({
      userId: uuidSchema,
      displayName: displayNameSchema,
      role: managedRoleSchema,
      status: userStatusSchema,
      password: z.union([passwordSchema, z.literal("")])
    })
    .safeParse({
      userId: getString(formData, "userId"),
      displayName: getString(formData, "displayName"),
      role: getString(formData, "role"),
      status: getString(formData, "status"),
      password: getString(formData, "password")
    });

  if (!parsed.success) {
    invalidAdminUser(getString(formData, "userId"));
  }

  if (!canCreateRole(actorRole, parsed.data.role)) {
    forbiddenAdminUser(parsed.data.userId);
  }

  const before = await getAdminManagedUserOrRedirect({
    actor,
    prisma,
    userId: parsed.data.userId
  });
  const supabaseAdmin = createAdminClient();
  const beforeAuthPayload = authUserPayload({
    displayName: before.displayName,
    role: before.role,
    status: before.status
  });
  const nextAuthPayload = {
    ...authUserPayload({
      displayName: parsed.data.displayName,
      role: parsed.data.role,
      status: parsed.data.status
    }),
    ...(parsed.data.password
      ? {
          password: parsed.data.password
        }
      : {})
  };
  const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
    before.authUserId,
    nextAuthPayload
  );

  if (authUpdateError) {
    invalidAdminUser(before.id);
  }

  try {
    const after = await prisma.user.update({
      where: { id: before.id },
      data: {
        displayName: parsed.data.displayName,
        role: parsed.data.role,
        status: parsed.data.status
      },
      include: {
        memberships: {
          include: {
            organization: true
          }
        }
      }
    });

    await writeAuditLog(prisma, {
      actorUserId: actor.id,
      action: "user.update",
      entityType: "user",
      entityId: after.id,
      organizationId: null,
      before: userSnapshot(before),
      after: userSnapshot(after)
    });
  } catch (updateError) {
    await supabaseAdmin.auth.admin.updateUserById(
      before.authUserId,
      beforeAuthPayload
    );
    throw updateError;
  }

  revalidateUsers(actorRole);
  redirect(adminUserPath(before.id, "updated=user"));
}

export async function createManagedUser(formData: FormData) {
  const { actor, prisma } = await requireUserManager();
  const actorRole = actor.role as Role;
  const parsed = z
    .object({
      email: emailSchema,
      password: passwordSchema,
      displayName: displayNameSchema,
      role: managedRoleSchema,
      organizationIds: z.array(uuidSchema).min(1)
    })
    .safeParse({
      email: getString(formData, "email"),
      password: getString(formData, "password"),
      displayName: getString(formData, "displayName"),
      role: getString(formData, "role"),
      organizationIds: getStrings(formData, "organizationIds")
    });

  if (!parsed.success) {
    invalidUser(actorRole);
  }

  if (!canCreateRole(actorRole, parsed.data.role)) {
    forbiddenUser(actorRole);
  }

  const organizations = await resolveAssignableOrganizations({
    actor,
    organizationIds: parsed.data.organizationIds,
    prisma
  });
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    app_metadata: {
      role: parsed.data.role,
      status: "ACTIVE"
    },
    user_metadata: {
      display_name: parsed.data.displayName
    }
  });
  const authUserId = data.user?.id;

  if (error || !authUserId) {
    invalidUser(actorRole);
  }

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          authUserId,
          email: parsed.data.email,
          displayName: parsed.data.displayName,
          role: parsed.data.role,
          status: "ACTIVE",
          memberships: {
            create: organizations.map((organization) => ({
              organizationId: organization.id
            }))
          }
        },
        include: {
          memberships: {
            include: {
              organization: true
            }
          }
        }
      });

      await writeAuditLog(tx, {
        actorUserId: actor.id,
        action: "user.create",
        entityType: "user",
        entityId: user.id,
        organizationId: organizations[0]?.id ?? null,
        after: userSnapshot(user)
      });
    });
  } catch (error) {
    await supabaseAdmin.auth.admin.deleteUser(authUserId);
    throw error;
  }

  revalidateUsers(actorRole);
  redirect(usersPath(actorRole, "created=user"));
}

export async function updateManagedUser(formData: FormData) {
  const { actor, prisma } = await requireUserManager();
  const actorRole = actor.role as Role;
  const parsed = z
    .object({
      userId: uuidSchema,
      displayName: displayNameSchema,
      role: managedRoleSchema,
      status: userStatusSchema,
      organizationIds: z.array(uuidSchema).min(1)
    })
    .safeParse({
      userId: getString(formData, "userId"),
      displayName: getString(formData, "displayName"),
      role: getString(formData, "role"),
      status: getString(formData, "status"),
      organizationIds: getStrings(formData, "organizationIds")
    });

  if (!parsed.success) {
    invalidUser(actorRole);
  }

  if (!canCreateRole(actorRole, parsed.data.role)) {
    forbiddenUser(actorRole);
  }

  const before = await getManagedUserOrRedirect({
    actor,
    prisma,
    userId: parsed.data.userId
  });
  const organizations = await resolveAssignableOrganizations({
    actor,
    organizationIds: parsed.data.organizationIds,
    prisma
  });

  const actorScopedOrganizationIds =
    actorRole === "SA" ? null : actorActiveOrganizationIds(actor);
  const supabaseAdmin = createAdminClient();
  const beforeAuthPayload = authUserPayload({
    displayName: before.displayName,
    role: before.role,
    status: before.status
  });
  const nextAuthPayload = authUserPayload({
    displayName: parsed.data.displayName,
    role: parsed.data.role,
    status: parsed.data.status
  });
  const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
    before.authUserId,
    nextAuthPayload
  );

  if (authUpdateError) {
    invalidUser(actorRole);
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.organizationMembership.deleteMany({
        where: {
          userId: before.id,
          ...(actorScopedOrganizationIds
            ? {
                organizationId: {
                  in: actorScopedOrganizationIds
                }
              }
            : {})
        }
      });

      const after = await tx.user.update({
        where: { id: before.id },
        data: {
          displayName: parsed.data.displayName,
          role: parsed.data.role,
          status: parsed.data.status,
          memberships: {
            create: organizations.map((organization) => ({
              organizationId: organization.id
            }))
          }
        },
        include: {
          memberships: {
            include: {
              organization: true
            }
          }
        }
      });

      await writeAuditLog(tx, {
        actorUserId: actor.id,
        action: "user.update",
        entityType: "user",
        entityId: after.id,
        organizationId: organizations[0]?.id ?? null,
        before: userSnapshot(before),
        after: userSnapshot(after)
      });
    });
  } catch (error) {
    await supabaseAdmin.auth.admin.updateUserById(
      before.authUserId,
      beforeAuthPayload
    );
    throw error;
  }

  revalidateUsers(actorRole);
  redirect(usersPath(actorRole, "updated=user"));
}

export async function resetManagedUserPassword(formData: FormData) {
  const { actor, prisma } = await requireUserManager();
  const actorRole = actor.role as Role;
  const parsed = z
    .object({
      userId: uuidSchema,
      password: passwordSchema
    })
    .safeParse({
      userId: getString(formData, "userId"),
      password: getString(formData, "password")
    });

  if (!parsed.success) {
    invalidUser(actorRole);
  }

  const user = await getManagedUserOrRedirect({
    actor,
    prisma,
    userId: parsed.data.userId
  });
  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin.auth.admin.updateUserById(
    user.authUserId,
    {
      password: parsed.data.password
    }
  );

  if (error) {
    invalidUser(actorRole);
  }

  await writeAuditLog(prisma, {
    actorUserId: actor.id,
    action: "user.password_reset",
    entityType: "user",
    entityId: user.id,
    organizationId: user.memberships[0]?.organizationId ?? null,
    before: userSnapshot(user)
  });

  revalidateUsers(actorRole);
  redirect(usersPath(actorRole, "updated=password"));
}
