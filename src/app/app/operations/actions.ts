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
const optionalDateSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  dateSchema.optional()
);
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
const moveOutDateSchema = dateSchema;
const optionalUuidSchema = z.union([uuidSchema, z.literal("")]).optional();

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getOptionalString(formData: FormData, key: string) {
  const value = getString(formData, key).trim();
  return value || undefined;
}

function operationsPath(
  organizationId: string,
  search: string,
  formData?: FormData
) {
  const rawReturnPath = formData ? getString(formData, "returnPath") : "";
  let pathname = "/app/operations";

  if (rawReturnPath) {
    try {
      const url = new URL(rawReturnPath, "http://double-daeng.local");
      const allowedPath =
        url.pathname === "/app/operations" ||
        url.pathname.startsWith("/app/operations/") ||
        url.pathname === "/app/rooms" ||
        url.pathname.startsWith("/app/rooms/");

      if (allowedPath) {
        pathname = url.pathname;
      }
    } catch {
      pathname = "/app/operations";
    }
  }

  const params = new URLSearchParams(search);
  params.set("organizationId", organizationId);

  return `${pathname}?${params.toString()}`;
}

function invalidOperation(organizationId: string, formData?: FormData): never {
  redirect(operationsPath(organizationId, "error=invalid-operation", formData));
}

function forbiddenOperation(organizationId: string, formData?: FormData): never {
  redirect(
    operationsPath(organizationId, "error=forbidden-operation", formData)
  );
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

async function getReservationInOrganization({
  organizationId,
  prisma,
  reservationId
}: {
  organizationId: string;
  prisma: ReturnType<typeof getPrisma>;
  reservationId: string;
}) {
  return prisma.roomReservation.findFirst({
    where: {
      id: reservationId,
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

function revalidateOperations(organizationId: string, formData: FormData) {
  revalidatePath("/app");
  revalidatePath("/app/operations");
  revalidatePath("/app/rooms");
  redirect(operationsPath(organizationId, "updated=operation", formData));
}

export async function assignRoom(formData: FormData) {
  const { actor, organizationId, prisma } = await resolveOperationContext({
    formData,
    permissions: ["customers.manage", "rooms.manage"]
  });
  const parsed = z
    .object({
      roomId: uuidSchema,
      reservationId: optionalUuidSchema,
      residentFullName: z.string().trim().max(160).optional(),
      residentPhone: optionalTextSchema,
      emergencyContact: optionalTextSchema,
      moveInDate: dateSchema,
      idDocumentNumber: idDocumentSchema,
      contractNumber: optionalTextSchema
    })
    .safeParse({
      roomId: getString(formData, "roomId"),
      reservationId: getString(formData, "reservationId"),
      residentFullName: getString(formData, "residentFullName"),
      residentPhone: getOptionalString(formData, "residentPhone"),
      emergencyContact: getOptionalString(formData, "emergencyContact"),
      moveInDate: getString(formData, "moveInDate"),
      idDocumentNumber: getString(formData, "idDocumentNumber"),
      contractNumber: getOptionalString(formData, "contractNumber")
    });

  if (!parsed.success) {
    invalidOperation(organizationId, formData);
  }

  const reservationId = parsed.data.reservationId || null;
  const [room, reservation, activeRoomAssignment] = await Promise.all([
    getRoomInOrganization({
      organizationId,
      prisma,
      roomId: parsed.data.roomId
    }),
    reservationId
      ? getReservationInOrganization({
          organizationId,
          prisma,
          reservationId
        })
      : null,
    prisma.roomAssignment.findFirst({
      where: {
        roomId: parsed.data.roomId,
        status: "ACTIVE"
      }
    })
  ]);

  if (!room || activeRoomAssignment) {
    invalidOperation(organizationId, formData);
  }

  if (reservationId) {
    if (!reservation || reservation.roomId !== room.id || room.status !== "RESERVED") {
      invalidOperation(organizationId, formData);
    }
  } else if (room.status !== "VACANT" || !parsed.data.residentFullName?.trim()) {
    invalidOperation(organizationId, formData);
  }

  const residentFullName = reservation?.reserverName ?? parsed.data.residentFullName?.trim();
  const residentPhone = reservation?.reserverPhone ?? parsed.data.residentPhone;

  if (!residentFullName) {
    invalidOperation(organizationId, formData);
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
        id: true,
        authUserId: true,
        status: true
      }
    }),
    prisma.roomAssignment.findFirst({
      where: {
        organizationId,
        residentCode: loginUsername,
        status: "ACTIVE"
      },
      select: {
        id: true
      }
    })
  ]);

  if (existingLoginUser?.status === "ACTIVE" || existingResidentCode) {
    invalidOperation(organizationId, formData);
  }

  const supabaseAdmin = createAdminClient();
  let authUserId = existingLoginUser?.authUserId ?? null;
  let createdAuthUserId: string | null = null;
  let assignmentId: string | null = null;

  if (authUserId) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
      password: parsed.data.idDocumentNumber,
      app_metadata: {
        role: "RESIDENT",
        status: "ACTIVE",
        login_type: "room"
      },
      user_metadata: {
        display_name: loginUsername
      }
    });

    if (error) {
      invalidOperation(organizationId, formData);
    }
  } else {
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

    authUserId = data.user?.id ?? null;
    createdAuthUserId = authUserId;

    if (error || !authUserId) {
      invalidOperation(organizationId, formData);
    }
  }

  try {
    const assignment = await prisma.$transaction(async (tx) => {
      const loginUser = existingLoginUser
        ? await tx.user.update({
            where: {
              id: existingLoginUser.id
            },
            data: {
              email: loginEmail,
              username: loginUsername,
              displayName: loginUsername,
              role: "RESIDENT",
              status: "ACTIVE"
            }
          })
        : await tx.user.create({
            data: {
              authUserId,
              email: loginEmail,
              username: loginUsername,
              displayName: loginUsername,
              role: "RESIDENT",
              status: "ACTIVE"
            }
          });

      await tx.organizationMembership.upsert({
        where: {
          userId_organizationId: {
            userId: loginUser.id,
            organizationId
          }
        },
        update: {},
        create: {
          userId: loginUser.id,
          organizationId
        }
      });

      const created = await tx.roomAssignment.create({
        data: {
          organizationId,
          roomId: parsed.data.roomId,
          loginUserId: loginUser.id,
          residentCode: loginUsername,
          residentFullName,
          residentPhone,
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

      if (reservation) {
        await tx.roomReservation.update({
          where: {
            id: reservation.id
          },
          data: {
            status: "CONVERTED"
          }
        });

        await writeAuditLog(tx, {
          actorUserId: actor.id,
          action: "room_reservation.convert",
          entityType: "room_reservation",
          entityId: reservation.id,
          organizationId,
          before: reservation,
          after: {
            status: "CONVERTED",
            assignmentId: created.id
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
          resident: residentFullName,
          previousRoomStatus: room.status,
          status: "OCCUPIED"
        }
      });

      return created;
    });

    assignmentId = assignment.id;
  } catch (error) {
    if (createdAuthUserId) {
      await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
    }
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

  revalidateOperations(organizationId, formData);
}

export async function moveOutRoom(formData: FormData) {
  const { actor, organizationId, prisma } = await resolveOperationContext({
    formData,
    permissions: ["customers.manage", "rooms.manage"]
  });
  const parsed = z
    .object({
      assignmentId: uuidSchema,
      moveOutDate: moveOutDateSchema
    })
    .safeParse({
      assignmentId: getString(formData, "assignmentId"),
      moveOutDate: getString(formData, "moveOutDate")
    });

  if (!parsed.success) {
    invalidOperation(organizationId, formData);
  }

  const before = await prisma.roomAssignment.findFirst({
    where: {
      id: parsed.data.assignmentId,
      organizationId,
      status: "ACTIVE"
    },
    include: {
      loginUser: true,
      room: true
    }
  });

  if (!before || before.room.status !== "OCCUPIED") {
    invalidOperation(organizationId, formData);
  }

  await prisma.$transaction(async (tx) => {
    const after = await tx.roomAssignment.update({
      where: {
        id: before.id
      },
      data: {
        status: "MOVED_OUT",
        moveOutDate: parsed.data.moveOutDate
      }
    });

    await tx.room.update({
      where: {
        id: before.roomId
      },
      data: {
        status: "VACANT"
      }
    });

    if (before.loginUserId) {
      await tx.user.update({
        where: {
          id: before.loginUserId
        },
        data: {
          status: "SUSPENDED"
        }
      });
    }

    await writeAuditLog(tx, {
      actorUserId: actor.id,
      action: "room_assignment.move_out",
      entityType: "room_assignment",
      entityId: before.id,
      organizationId,
      before,
      after: {
        assignment: after,
        roomStatus: "VACANT"
      }
    });
  });

  if (before.loginUser?.authUserId) {
    const { error } = await createAdminClient().auth.admin.updateUserById(
      before.loginUser.authUserId,
      {
        app_metadata: {
          role: "RESIDENT",
          status: "SUSPENDED",
          login_type: "room"
        }
      }
    );

    if (error) {
      invalidOperation(organizationId, formData);
    }
  }

  revalidateOperations(organizationId, formData);
}

export async function reserveRoom(formData: FormData) {
  const { actor, organizationId, prisma } = await resolveOperationContext({
    formData,
    permissions: ["customers.manage"]
  });
  const parsed = z
    .object({
      roomId: uuidSchema,
      reserverName: textSchema,
      reserverPhone: optionalTextSchema,
      reservedDate: dateSchema,
      expectedMoveInDate: optionalDateSchema,
      note: optionalTextSchema
    })
    .safeParse({
      roomId: getString(formData, "roomId"),
      reserverName: getString(formData, "reserverName"),
      reserverPhone: getOptionalString(formData, "reserverPhone"),
      reservedDate: getString(formData, "reservedDate"),
      expectedMoveInDate: getString(formData, "expectedMoveInDate"),
      note: getOptionalString(formData, "note")
    });

  if (!parsed.success) {
    invalidOperation(organizationId, formData);
  }

  const [room, activeReservation] = await Promise.all([
    getRoomInOrganization({
      organizationId,
      prisma,
      roomId: parsed.data.roomId
    }),
    prisma.roomReservation.findFirst({
      where: {
        roomId: parsed.data.roomId,
        status: "ACTIVE"
      }
    })
  ]);

  if (!room || room.status !== "VACANT" || activeReservation) {
    invalidOperation(organizationId, formData);
  }

  await prisma.$transaction(async (tx) => {
    const reservation = await tx.roomReservation.create({
      data: {
        organizationId,
        roomId: parsed.data.roomId,
        reservedByUserId: actor.id,
        reserverName: parsed.data.reserverName,
        reserverPhone: parsed.data.reserverPhone,
        reservedDate: parsed.data.reservedDate,
        expectedMoveInDate: parsed.data.expectedMoveInDate,
        note: parsed.data.note
      }
    });

    await tx.room.update({
      where: {
        id: parsed.data.roomId
      },
      data: {
        status: "RESERVED"
      }
    });

    await writeAuditLog(tx, {
      actorUserId: actor.id,
      action: "room_reservation.create",
      entityType: "room_reservation",
      entityId: reservation.id,
      organizationId,
      after: {
        reservation,
        previousRoomStatus: room.status,
        status: "RESERVED"
      }
    });
  });

  revalidateOperations(organizationId, formData);
}

export async function cancelReservation(formData: FormData) {
  const { actor, organizationId, prisma } = await resolveOperationContext({
    formData,
    permissions: ["customers.manage"]
  });
  const parsed = uuidSchema.safeParse(getString(formData, "reservationId"));

  if (!parsed.success) {
    invalidOperation(organizationId, formData);
  }

  const reservation = await getReservationInOrganization({
    organizationId,
    prisma,
    reservationId: parsed.data
  });

  if (!reservation || reservation.room.status !== "RESERVED") {
    invalidOperation(organizationId, formData);
  }

  await prisma.$transaction(async (tx) => {
    const after = await tx.roomReservation.update({
      where: {
        id: reservation.id
      },
      data: {
        status: "CANCELLED"
      }
    });

    await tx.room.update({
      where: {
        id: reservation.roomId
      },
      data: {
        status: "VACANT"
      }
    });

    await writeAuditLog(tx, {
      actorUserId: actor.id,
      action: "room_reservation.cancel",
      entityType: "room_reservation",
      entityId: reservation.id,
      organizationId,
      before: reservation,
      after: {
        reservation: after,
        roomStatus: "VACANT"
      }
    });
  });

  revalidateOperations(organizationId, formData);
}

export async function markRoomUnavailable(formData: FormData) {
  const { actor, organizationId, prisma } = await resolveOperationContext({
    formData,
    permissions: ["rooms.manage"]
  });
  const parsed = uuidSchema.safeParse(getString(formData, "roomId"));

  if (!parsed.success) {
    invalidOperation(organizationId, formData);
  }

  const room = await getRoomInOrganization({
    organizationId,
    prisma,
    roomId: parsed.data
  });

  if (!room || room.status !== "VACANT") {
    invalidOperation(organizationId, formData);
  }

  await prisma.$transaction(async (tx) => {
    const after = await tx.room.update({
      where: {
        id: room.id
      },
      data: {
        status: "UNAVAILABLE"
      }
    });

    await writeAuditLog(tx, {
      actorUserId: actor.id,
      action: "room.unavailable",
      entityType: "room",
      entityId: room.id,
      organizationId,
      before: room,
      after
    });
  });

  revalidateOperations(organizationId, formData);
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
    invalidOperation(organizationId, formData);
  }

  const assignment = await getAssignmentInOrganization({
    assignmentId: parsed.data.roomAssignmentId,
    organizationId,
    prisma
  });

  if (!assignment) {
    invalidOperation(organizationId, formData);
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

  revalidateOperations(organizationId, formData);
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
    invalidOperation(organizationId, formData);
  }

  const room = await getRoomInOrganization({
    organizationId,
    prisma,
    roomId: parsed.data.roomId
  });

  if (!room) {
    invalidOperation(organizationId, formData);
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

  revalidateOperations(organizationId, formData);
}

export async function createMaintenanceRequest(formData: FormData) {
  const { actor, actorRole, organizationId, prisma } =
    await resolveOperationContext({
      formData,
      permissions: ["maintenance.manage", "maintenance.create"]
    });
  const parsed = z
    .object({
      roomId: optionalUuidSchema,
      roomAssignmentId: optionalUuidSchema,
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
    invalidOperation(organizationId, formData);
  }

  let roomAssignmentId = parsed.data.roomAssignmentId || null;
  let targetRoomId = parsed.data.roomId || null;

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
      forbiddenOperation(organizationId, formData);
    }

    roomAssignmentId = ownAssignment.id;
    targetRoomId = ownAssignment.roomId;
  } else if (roomAssignmentId) {
    const assignment = await getAssignmentInOrganization({
      assignmentId: roomAssignmentId,
      organizationId,
      prisma
    });

    if (!assignment) {
      invalidOperation(organizationId, formData);
    }

    targetRoomId ??= assignment.roomId;
  }

  if (!targetRoomId) {
    invalidOperation(organizationId, formData);
  }

  let previousRoomStatus: "VACANT" | "OCCUPIED" | null = null;

  const room = await getRoomInOrganization({
    organizationId,
    prisma,
    roomId: targetRoomId
  });

  if (!room) {
    invalidOperation(organizationId, formData);
  }

  if (room.status !== "VACANT" && room.status !== "OCCUPIED") {
    invalidOperation(organizationId, formData);
  }

  previousRoomStatus = room.status;

  await prisma.$transaction(async (tx) => {
    const request = await tx.maintenanceRequest.create({
      data: {
        organizationId,
        roomId: targetRoomId,
        roomAssignmentId,
        createdByUserId: actor.id,
        title: parsed.data.title,
        description: parsed.data.description,
        priority: parsed.data.priority,
        previousRoomStatus
      }
    });

    await tx.room.update({
      where: {
        id: targetRoomId
      },
      data: {
        status: "MAINTENANCE"
      }
    });

    await writeAuditLog(tx, {
      actorUserId: actor.id,
      action: "maintenance_request.create",
      entityType: "maintenance_request",
      entityId: request.id,
      organizationId,
      after: {
        request,
        previousRoomStatus,
        roomStatus: "MAINTENANCE"
      }
    });
  });

  revalidateOperations(organizationId, formData);
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
    invalidOperation(organizationId, formData);
  }

  const before = await prisma.maintenanceRequest.findFirst({
    where: {
      id: parsed.data.requestId,
      organizationId
    }
  });

  if (!before) {
    invalidOperation(organizationId, formData);
  }

  if (
    (before.status === "RESOLVED" || before.status === "CANCELLED") &&
    (parsed.data.status === "OPEN" || parsed.data.status === "IN_PROGRESS")
  ) {
    invalidOperation(organizationId, formData);
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
      invalidOperation(organizationId, formData);
    }
  }

  await prisma.$transaction(async (tx) => {
    const after = await tx.maintenanceRequest.update({
      where: {
        id: before.id
      },
      data: {
        status: parsed.data.status,
        assignedToUserId
      }
    });

    const isClosing =
      (parsed.data.status === "RESOLVED" || parsed.data.status === "CANCELLED") &&
      before.status !== "RESOLVED" &&
      before.status !== "CANCELLED";

    if (isClosing && before.roomId && before.previousRoomStatus) {
      const openSiblingCount = await tx.maintenanceRequest.count({
        where: {
          id: {
            not: before.id
          },
          roomId: before.roomId,
          status: {
            in: ["OPEN", "IN_PROGRESS"]
          }
        }
      });

      const room = await tx.room.findUnique({
        where: {
          id: before.roomId
        },
        select: {
          status: true
        }
      });

      if (openSiblingCount === 0 && room?.status === "MAINTENANCE") {
        await tx.room.update({
          where: {
            id: before.roomId
          },
          data: {
            status: before.previousRoomStatus
          }
        });
      }
    }

    await writeAuditLog(tx, {
      actorUserId: actor.id,
      action: "maintenance_request.update",
      entityType: "maintenance_request",
      entityId: after.id,
      organizationId,
      before,
      after
    });
  });

  revalidateOperations(organizationId, formData);
}
