"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAnyPermission } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { getPrisma } from "@/lib/prisma";
import { type Role } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";

const uuidSchema = z.string().uuid();
const textSchema = z.string().trim().min(1).max(160);
const optionalTextSchema = z.string().trim().max(240).optional();
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .transform((value) => new Date(`${value}T00:00:00.000Z`));
const moneySchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/);
const idDocumentSchema = z.string().trim().min(6).max(64);
const meterTypeSchema = z.enum(["WATER", "ELECTRIC"]);
const invoiceStatusSchema = z.enum([
  "DRAFT",
  "ISSUED",
  "PAID",
  "OVERDUE",
  "CANCELLED"
]);
const maintenancePrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
const maintenanceStatusSchema = z.enum([
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CANCELLED"
]);

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getOptionalString(formData: FormData, key: string) {
  const value = getString(formData, key).trim();
  return value || undefined;
}

function operationsPath(organizationId: string, search: string) {
  return `/app/operations?organizationId=${organizationId}&${search}`;
}

function invalidOperation(organizationId: string): never {
  redirect(operationsPath(organizationId, "error=invalid-operation"));
}

function forbiddenOperation(organizationId: string): never {
  redirect(operationsPath(organizationId, "error=forbidden-operation"));
}

async function resolveOperationContext({
  formData,
  permissions
}: {
  formData: FormData;
  permissions: Parameters<typeof requireAnyPermission>[0];
}) {
  const actor = await requireAnyPermission(permissions);
  const parsedOrganizationId = uuidSchema.safeParse(
    getString(formData, "organizationId")
  );

  if (!parsedOrganizationId.success) {
    redirect("/app?error=invalid-organization");
  }

  const activeMembership = actor.memberships.find(
    (membership) =>
      membership.organizationId === parsedOrganizationId.data &&
      membership.organization.status === "ACTIVE"
  );

  if (!activeMembership) {
    redirect("/app?error=organization-scope");
  }

  return {
    actor,
    actorRole: actor.role as Role,
    organizationId: parsedOrganizationId.data,
    prisma: getPrisma()
  };
}

async function getRoomInOrganization({
  organizationId,
  prisma,
  roomId
}: {
  organizationId: string;
  prisma: ReturnType<typeof getPrisma>;
  roomId: string;
}) {
  return prisma.room.findFirst({
    where: {
      id: roomId,
      floor: {
        building: {
          asset: {
            organizationId
          }
        }
      }
    },
    include: {
      floor: {
        include: {
          building: {
            include: {
              asset: true
            }
          }
        }
      }
    }
  });
}

async function getAssignmentInOrganization({
  assignmentId,
  organizationId,
  prisma
}: {
  assignmentId: string;
  organizationId: string;
  prisma: ReturnType<typeof getPrisma>;
}) {
  return prisma.roomAssignment.findFirst({
    where: {
      id: assignmentId,
      organizationId,
      status: "ACTIVE"
    },
    include: {
      room: {
        include: {
          floor: {
            include: {
              building: {
                include: {
                  asset: true
                }
              }
            }
          }
        }
      }
    }
  });
}

function revalidateOperations(organizationId: string) {
  revalidatePath("/app");
  revalidatePath("/app/operations");
  redirect(operationsPath(organizationId, "updated=operation"));
}

export async function assignRoom(formData: FormData) {
  const { actor, organizationId, prisma } = await resolveOperationContext({
    formData,
    permissions: ["customers.manage", "rooms.manage"]
  });
  const parsed = z
    .object({
      roomId: uuidSchema,
      residentFullName: textSchema,
      residentPhone: optionalTextSchema,
      emergencyContact: optionalTextSchema,
      moveInDate: dateSchema,
      idDocumentNumber: idDocumentSchema,
      contractNumber: optionalTextSchema
    })
    .safeParse({
      roomId: getString(formData, "roomId"),
      residentFullName: getString(formData, "residentFullName"),
      residentPhone: getOptionalString(formData, "residentPhone"),
      emergencyContact: getOptionalString(formData, "emergencyContact"),
      moveInDate: getString(formData, "moveInDate"),
      idDocumentNumber: getString(formData, "idDocumentNumber"),
      contractNumber: getOptionalString(formData, "contractNumber")
    });

  if (!parsed.success) {
    invalidOperation(organizationId);
  }

  const [room, activeRoomAssignment] = await Promise.all([
    getRoomInOrganization({
      organizationId,
      prisma,
      roomId: parsed.data.roomId
    }),
    prisma.roomAssignment.findFirst({
      where: {
        roomId: parsed.data.roomId,
        status: "ACTIVE"
      }
    })
  ]);

  if (!room || activeRoomAssignment) {
    invalidOperation(organizationId);
  }

  const loginUsername =
    `${room.floor.building.asset.abbreviation}${room.roomNumber}`.toUpperCase();
  const loginEmail = `${loginUsername.toLowerCase()}@rooms.double-daeng.local`;
  const [existingLoginUser, existingResidentCode] = await Promise.all([
    prisma.user.findFirst({
      where: {
        username: loginUsername
      },
      select: {
        id: true
      }
    }),
    prisma.roomAssignment.findFirst({
      where: {
        organizationId,
        residentCode: loginUsername
      },
      select: {
        id: true
      }
    })
  ]);

  if (existingLoginUser || existingResidentCode) {
    invalidOperation(organizationId);
  }

  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: loginEmail,
    password: parsed.data.idDocumentNumber,
    email_confirm: true,
    app_metadata: {
      role: "RESIDENT",
      status: "ACTIVE",
      login_type: "room"
    },
    user_metadata: {
      display_name: loginUsername
    }
  });
  const authUserId = data.user?.id;

  if (error || !authUserId) {
    invalidOperation(organizationId);
  }

  let assignmentId: string | null = null;

  try {
    const assignment = await prisma.$transaction(async (tx) => {
      const loginUser = await tx.user.create({
        data: {
          authUserId,
          email: loginEmail,
          username: loginUsername,
          displayName: loginUsername,
          role: "RESIDENT",
          status: "ACTIVE",
          memberships: {
            create: {
              organizationId
            }
          }
        }
      });

      const created = await tx.roomAssignment.create({
        data: {
          organizationId,
          roomId: parsed.data.roomId,
          loginUserId: loginUser.id,
          residentCode: loginUsername,
          residentFullName: parsed.data.residentFullName,
          residentPhone: parsed.data.residentPhone,
          emergencyContact: parsed.data.emergencyContact,
          idDocumentNumber: parsed.data.idDocumentNumber,
          moveInDate: parsed.data.moveInDate
        }
      });

      await tx.room.update({
        where: {
          id: parsed.data.roomId
        },
        data: {
          status: "OCCUPIED"
        }
      });

      if (parsed.data.contractNumber) {
        await tx.contract.create({
          data: {
            organizationId,
            assignmentId: created.id,
            contractNumber: parsed.data.contractNumber,
            startDate: parsed.data.moveInDate,
            rentAmount: room.rentAmount,
            depositAmount: room.depositAmount
          }
        });
      }

      await writeAuditLog(tx, {
        actorUserId: actor.id,
        action: "room_assignment.create",
        entityType: "room_assignment",
        entityId: created.id,
        organizationId,
        after: {
          assignment: created,
          loginUsername,
          roomNumber: room.roomNumber,
          resident: parsed.data.residentFullName
        }
      });

      return created;
    });

    assignmentId = assignment.id;
  } catch (error) {
    await supabaseAdmin.auth.admin.deleteUser(authUserId);
    throw error;
  }

  await writeAuditLog(prisma, {
    actorUserId: actor.id,
    action: "room.status_update",
    entityType: "room",
    entityId: parsed.data.roomId,
    organizationId,
    after: {
      assignmentId,
      status: "OCCUPIED"
    }
  });

  revalidateOperations(organizationId);
}

export async function createInvoice(formData: FormData) {
  const { actor, organizationId, prisma } = await resolveOperationContext({
    formData,
    permissions: ["customers.manage"]
  });
  const parsed = z
    .object({
      roomAssignmentId: uuidSchema,
      invoiceNumber: textSchema,
      issueDate: dateSchema,
      dueDate: dateSchema,
      totalAmount: moneySchema,
      status: invoiceStatusSchema
    })
    .safeParse({
      roomAssignmentId: getString(formData, "roomAssignmentId"),
      invoiceNumber: getString(formData, "invoiceNumber"),
      issueDate: getString(formData, "issueDate"),
      dueDate: getString(formData, "dueDate"),
      totalAmount: getString(formData, "totalAmount"),
      status: getString(formData, "status") || "ISSUED"
    });

  if (!parsed.success) {
    invalidOperation(organizationId);
  }

  const assignment = await getAssignmentInOrganization({
    assignmentId: parsed.data.roomAssignmentId,
    organizationId,
    prisma
  });

  if (!assignment) {
    invalidOperation(organizationId);
  }

  const invoice = await prisma.invoice.create({
    data: {
      organizationId,
      roomAssignmentId: parsed.data.roomAssignmentId,
      invoiceNumber: parsed.data.invoiceNumber,
      issueDate: parsed.data.issueDate,
      dueDate: parsed.data.dueDate,
      totalAmount: parsed.data.totalAmount,
      status: parsed.data.status,
      paidAt: parsed.data.status === "PAID" ? new Date() : null
    }
  });

  await writeAuditLog(prisma, {
    actorUserId: actor.id,
    action: "invoice.create",
    entityType: "invoice",
    entityId: invoice.id,
    organizationId,
    after: invoice
  });

  revalidateOperations(organizationId);
}

export async function recordMeterReading(formData: FormData) {
  const { actor, organizationId, prisma } = await resolveOperationContext({
    formData,
    permissions: ["room_status.update", "rooms.manage"]
  });
  const parsed = z
    .object({
      roomId: uuidSchema,
      meterType: meterTypeSchema,
      readingDate: dateSchema,
      readingValue: moneySchema,
      note: optionalTextSchema
    })
    .safeParse({
      roomId: getString(formData, "roomId"),
      meterType: getString(formData, "meterType"),
      readingDate: getString(formData, "readingDate"),
      readingValue: getString(formData, "readingValue"),
      note: getOptionalString(formData, "note")
    });

  if (!parsed.success) {
    invalidOperation(organizationId);
  }

  const room = await getRoomInOrganization({
    organizationId,
    prisma,
    roomId: parsed.data.roomId
  });

  if (!room) {
    invalidOperation(organizationId);
  }

  const reading = await prisma.meterReading.create({
    data: {
      organizationId,
      roomId: parsed.data.roomId,
      meterType: parsed.data.meterType,
      readingDate: parsed.data.readingDate,
      readingValue: parsed.data.readingValue,
      note: parsed.data.note
    }
  });

  await writeAuditLog(prisma, {
    actorUserId: actor.id,
    action: "meter_reading.create",
    entityType: "meter_reading",
    entityId: reading.id,
    organizationId,
    after: reading
  });

  revalidateOperations(organizationId);
}

export async function createMaintenanceRequest(formData: FormData) {
  const { actor, actorRole, organizationId, prisma } =
    await resolveOperationContext({
      formData,
      permissions: ["maintenance.manage", "maintenance.create"]
    });
  const parsed = z
    .object({
      roomId: z.union([uuidSchema, z.literal("")]).optional(),
      roomAssignmentId: z.union([uuidSchema, z.literal("")]).optional(),
      title: textSchema,
      description: z.string().trim().min(1).max(1000),
      priority: maintenancePrioritySchema
    })
    .safeParse({
      roomId: getString(formData, "roomId"),
      roomAssignmentId: getString(formData, "roomAssignmentId"),
      title: getString(formData, "title"),
      description: getString(formData, "description"),
      priority: getString(formData, "priority") || "MEDIUM"
    });

  if (!parsed.success) {
    invalidOperation(organizationId);
  }

  let roomAssignmentId = parsed.data.roomAssignmentId || null;

  let ownAssignmentRoomId: string | null = null;

  if (actorRole === "RESIDENT") {
    const ownAssignment = await prisma.roomAssignment.findFirst({
      where: {
        organizationId,
        loginUserId: actor.id,
        status: "ACTIVE"
      },
      select: {
        id: true,
        roomId: true
      }
    });

    if (!ownAssignment) {
      forbiddenOperation(organizationId);
    }

    roomAssignmentId = ownAssignment.id;
    ownAssignmentRoomId = ownAssignment.roomId;
  } else if (roomAssignmentId) {
    const assignment = await getAssignmentInOrganization({
      assignmentId: roomAssignmentId,
      organizationId,
      prisma
    });

    if (!assignment) {
      invalidOperation(organizationId);
    }
  }

  const roomId = parsed.data.roomId || null;

  if (actorRole === "RESIDENT" && roomId && roomId !== ownAssignmentRoomId) {
    forbiddenOperation(organizationId);
  }

  if (roomId) {
    const room = await getRoomInOrganization({
      organizationId,
      prisma,
      roomId
    });

    if (!room) {
      invalidOperation(organizationId);
    }
  }

  const request = await prisma.maintenanceRequest.create({
    data: {
      organizationId,
      roomId,
      roomAssignmentId,
      createdByUserId: actor.id,
      title: parsed.data.title,
      description: parsed.data.description,
      priority: parsed.data.priority
    }
  });

  await writeAuditLog(prisma, {
    actorUserId: actor.id,
    action: "maintenance_request.create",
    entityType: "maintenance_request",
    entityId: request.id,
    organizationId,
    after: request
  });

  revalidateOperations(organizationId);
}

export async function updateMaintenanceStatus(formData: FormData) {
  const { actor, organizationId, prisma } = await resolveOperationContext({
    formData,
    permissions: ["maintenance.manage"]
  });
  const parsed = z
    .object({
      requestId: uuidSchema,
      status: maintenanceStatusSchema,
      assignedToUserId: z.union([uuidSchema, z.literal("")]).optional()
    })
    .safeParse({
      requestId: getString(formData, "requestId"),
      status: getString(formData, "status"),
      assignedToUserId: getString(formData, "assignedToUserId")
    });

  if (!parsed.success) {
    invalidOperation(organizationId);
  }

  const before = await prisma.maintenanceRequest.findFirst({
    where: {
      id: parsed.data.requestId,
      organizationId
    }
  });

  if (!before) {
    invalidOperation(organizationId);
  }

  const assignedToUserId = parsed.data.assignedToUserId || null;

  if (assignedToUserId) {
    const assignee = await prisma.user.findFirst({
      where: {
        id: assignedToUserId,
        role: {
          in: ["MANAGER", "OPERATION"]
        },
        status: "ACTIVE",
        memberships: {
          some: {
            organizationId
          }
        }
      }
    });

    if (!assignee) {
      invalidOperation(organizationId);
    }
  }

  const after = await prisma.maintenanceRequest.update({
    where: {
      id: before.id
    },
    data: {
      status: parsed.data.status,
      assignedToUserId
    }
  });

  await writeAuditLog(prisma, {
    actorUserId: actor.id,
    action: "maintenance_request.update",
    entityType: "maintenance_request",
    entityId: after.id,
    organizationId,
    before,
    after
  });

  revalidateOperations(organizationId);
}
