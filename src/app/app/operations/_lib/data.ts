import { resolveActiveOrganization } from "@/lib/auth/organization-scope";
import { requirePermission } from "@/lib/auth/session";
import { getPrisma } from "@/lib/prisma";
import {
  hasAnyPermission,
  hasPermission,
  type Permission,
  type Role
} from "@/lib/rbac";

export type OperationSearchParams = Promise<{
  organizationId?: string;
  error?: string;
  updated?: string;
}>;

export async function getOperationState(searchParams: OperationSearchParams) {
  const profile = await requirePermission("app.access");
  const role = profile.role as Exclude<Role, "SA">;
  const query = await searchParams;
  const { activeOrganization } = resolveActiveOrganization(
    profile,
    query.organizationId
  );
  const prisma = getPrisma();
  const data = activeOrganization
    ? await getOperationsData({
        organizationId: activeOrganization.id,
        profileId: profile.id,
        role,
        prisma
      })
    : null;

  return {
    activeOrganization,
    canCreateMaintenance: hasPermission(role, "maintenance.create"),
    canManageCustomers: hasPermission(role, "customers.manage"),
    canManageMaintenance: hasPermission(role, "maintenance.manage"),
    canManageRooms: hasPermission(role, "rooms.manage"),
    canRecordMeters:
      hasPermission(role, "room_status.update") ||
      hasPermission(role, "rooms.manage"),
    data,
    profile,
    query,
    role
  };
}

export function canUseModule(
  role: Exclude<Role, "SA">,
  permissions: Permission[]
) {
  return hasAnyPermission(role, permissions);
}

export async function getOperationsData({
  organizationId,
  profileId,
  role,
  prisma
}: {
  organizationId: string;
  profileId: string;
  role: Exclude<Role, "SA">;
  prisma: ReturnType<typeof getPrisma>;
}) {
  const maintenanceWhere =
    role === "RESIDENT"
      ? {
          organizationId,
          roomAssignment: {
            loginUserId: profileId,
            status: "ACTIVE" as const
          }
        }
      : {
          organizationId
        };
  const invoiceWhere =
    role === "RESIDENT"
      ? {
          organizationId,
          roomAssignment: {
            loginUserId: profileId,
            status: "ACTIVE" as const
          }
        }
      : {
          organizationId
        };
  const roomWhere =
    role === "RESIDENT"
      ? {
          assignments: {
            some: {
              loginUserId: profileId,
              organizationId,
              status: "ACTIVE" as const
            }
          }
        }
      : {
          floor: {
            building: {
              asset: {
                organizationId
              }
            }
          }
        };

  const [
    rooms,
    activeReservations,
    activeAssignments,
    invoices,
    meterReadings,
    maintenanceRequests,
    staffUsers
  ] = await Promise.all([
    prisma.room.findMany({
      where: roomWhere,
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
      },
      orderBy: [
        {
          floor: {
            building: {
              asset: {
                name: "asc"
              }
            }
          }
        },
        {
          roomNumber: "asc"
        }
      ]
    }),
    prisma.roomReservation.findMany({
      where: {
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
        },
        reservedByUser: true
      },
      orderBy: {
        createdAt: "desc"
      }
    }),
    prisma.roomAssignment.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        ...(role === "RESIDENT"
          ? {
              loginUserId: profileId
            }
          : {})
      },
      include: {
        contract: true,
        loginUser: true,
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
      },
      orderBy: {
        createdAt: "desc"
      }
    }),
    prisma.invoice.findMany({
      where: invoiceWhere,
      include: {
        roomAssignment: {
          include: {
            room: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 20
    }),
    prisma.meterReading.findMany({
      where: {
        organizationId,
        ...(role === "RESIDENT"
          ? {
              room: {
                assignments: {
                  some: {
                    loginUserId: profileId,
                    organizationId,
                    status: "ACTIVE" as const
                  }
                }
              }
            }
          : {})
      },
      include: {
        room: true
      },
      orderBy: {
        readingDate: "desc"
      },
      take: 12
    }),
    prisma.maintenanceRequest.findMany({
      where: maintenanceWhere,
      include: {
        roomAssignment: true,
        room: true,
        createdBy: true,
        assignedTo: true
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 20
    }),
    prisma.user.findMany({
      where: {
        role: {
          in: ["MANAGER", "OPERATION"]
        },
        status: "ACTIVE",
        memberships: {
          some: {
            organizationId
          }
        }
      },
      orderBy: [{ role: "asc" }, { email: "asc" }]
    })
  ]);

  return {
    activeAssignments,
    activeReservations,
    invoices,
    maintenanceRequests,
    meterReadings,
    ownAssignment: activeAssignments[0] ?? null,
    openInvoices: invoices.filter((invoice) =>
      ["DRAFT", "ISSUED", "OVERDUE"].includes(invoice.status)
    ).length,
    openMaintenance: maintenanceRequests.filter((request) =>
      ["OPEN", "IN_PROGRESS"].includes(request.status)
    ).length,
    rooms,
    staffUsers
  };
}

export type OperationsData = Awaited<ReturnType<typeof getOperationsData>>;
