"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { getPrisma } from "@/lib/prisma";

const uuidSchema = z.string().uuid();

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function invalidMembership(): never {
  redirect("/admin/memberships?error=invalid-membership");
}

function membershipSnapshot(membership: {
  id: string;
  userId: string;
  organizationId: string;
  user?: {
    email: string;
    role: string;
  };
  organization?: {
    name: string;
  };
}) {
  return {
    id: membership.id,
    userId: membership.userId,
    organizationId: membership.organizationId,
    userEmail: membership.user?.email,
    userRole: membership.user?.role,
    organizationName: membership.organization?.name
  };
}

async function requireSA() {
  const actor = await requirePermission("memberships.manage");

  return {
    actorUserId: actor.id,
    prisma: getPrisma()
  };
}

export async function assignOrganizationMembership(formData: FormData) {
  const { actorUserId, prisma } = await requireSA();
  const parsed = z
    .object({
      userId: uuidSchema,
      organizationId: uuidSchema
    })
    .safeParse({
      userId: getString(formData, "userId"),
      organizationId: getString(formData, "organizationId")
    });

  if (!parsed.success) {
    invalidMembership();
  }

  const [user, organization, existingMembership] = await Promise.all([
    prisma.user.findUnique({
      where: { id: parsed.data.userId },
      select: {
        id: true,
        email: true,
        role: true,
        status: true
      }
    }),
    prisma.organization.findUnique({
      where: { id: parsed.data.organizationId },
      select: {
        id: true,
        name: true,
        status: true
      }
    }),
    prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: parsed.data.userId,
          organizationId: parsed.data.organizationId
        }
      },
      select: { id: true }
    })
  ]);

  if (
    !user ||
    !["MANAGER", "OPERATION"].includes(user.role) ||
    user.status !== "ACTIVE" ||
    !organization ||
    organization.status !== "ACTIVE"
  ) {
    invalidMembership();
  }

  if (existingMembership) {
    redirect("/admin/memberships?updated=membership");
  }

  await prisma.$transaction(async (tx) => {
    const membership = await tx.organizationMembership.create({
      data: {
        userId: user.id,
        organizationId: organization.id
      },
      select: {
        id: true,
        userId: true,
        organizationId: true,
        user: {
          select: {
            email: true,
            role: true
          }
        },
        organization: {
          select: {
            name: true
          }
        }
      }
    });

    await writeAuditLog(tx, {
      actorUserId,
      action: "membership.assign",
      entityType: "organization_membership",
      entityId: membership.id,
      organizationId: membership.organizationId,
      after: membershipSnapshot(membership)
    });
  });

  revalidatePath("/admin");
  revalidatePath("/admin/memberships");
  revalidatePath("/admin/organizations");
  redirect("/admin/memberships?created=membership");
}

export async function removeOrganizationMembership(formData: FormData) {
  const { actorUserId, prisma } = await requireSA();
  const parsed = uuidSchema.safeParse(getString(formData, "membershipId"));

  if (!parsed.success) {
    invalidMembership();
  }

  const before = await prisma.organizationMembership.findUnique({
    where: { id: parsed.data },
    select: {
      id: true,
      userId: true,
      organizationId: true,
      user: {
        select: {
          email: true,
          role: true
        }
      },
      organization: {
        select: {
          name: true
        }
      }
    }
  });

  if (!before || !["MANAGER", "OPERATION"].includes(before.user.role)) {
    invalidMembership();
  }

  await prisma.$transaction(async (tx) => {
    await tx.organizationMembership.delete({
      where: { id: before.id }
    });

    await writeAuditLog(tx, {
      actorUserId,
      action: "membership.remove",
      entityType: "organization_membership",
      entityId: before.id,
      organizationId: before.organizationId,
      before: membershipSnapshot(before)
    });
  });

  revalidatePath("/admin");
  revalidatePath("/admin/memberships");
  revalidatePath("/admin/organizations");
  redirect("/admin/memberships?deleted=membership");
}
