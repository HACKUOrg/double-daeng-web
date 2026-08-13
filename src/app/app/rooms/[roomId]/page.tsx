import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Banknote,
  CalendarCheck,
  CalendarX,
  DoorOpen,
  Gauge,
  LogOut,
  Wrench
} from "lucide-react";
import { z } from "zod";
import {
  EmptyState,
  ListPanel,
  Metric,
  ModuleHeader,
  NoOrganizationState,
  StatusBanner,
  StatusPill,
  formatDate,
  formatMoney,
  roomLabel
} from "@/app/app/operations/_components/operation-ui";
import { Button } from "@/components/ui/button";
import { resolveActiveOrganization } from "@/lib/auth/organization-scope";
import { requirePermission } from "@/lib/auth/session";
import { getPrisma } from "@/lib/prisma";
import { hasPermission, type Role } from "@/lib/rbac";

type RoomDetailPageProps = {
  params: Promise<{
    roomId: string;
  }>;
  searchParams: Promise<{
    organizationId?: string;
    error?: string;
    updated?: string;
  }>;
};

const uuidSchema = z.string().uuid();

export default async function RoomDetailPage({
  params,
  searchParams
}: RoomDetailPageProps) {
  const profile = await requirePermission("app.access");
  const role = profile.role as Exclude<Role, "SA">;
  const [{ roomId }, query] = await Promise.all([params, searchParams]);
  const parsedRoomId = uuidSchema.safeParse(roomId);

  if (!parsedRoomId.success) {
    notFound();
  }

  const { activeOrganization } = resolveActiveOrganization(
    profile,
    query.organizationId
  );

  if (!activeOrganization) {
    return (
      <div className="grid gap-8">
        <ModuleHeader
          eyebrow="Rooms"
          title="Room details"
          description="Choose an active organization from the sidebar before viewing room details."
        />
        <StatusBanner error={query.error} updated={query.updated} />
        <NoOrganizationState />
      </div>
    );
  }

  const room = await getRoomDetail({
    organizationId: activeOrganization.id,
    profileId: profile.id,
    role,
    roomId: parsedRoomId.data
  });

  if (!room) {
    notFound();
  }

  const assignment = room.assignments[0];
  const reservation = room.reservations[0];
  const canManageCustomers = hasPermission(role, "customers.manage");
  const canManageRooms = hasPermission(role, "rooms.manage");
  const canManageMaintenance = hasPermission(role, "maintenance.manage");
  const canCreateMaintenance = hasPermission(role, "maintenance.create");
  const canRecordMeters =
    hasPermission(role, "room_status.update") || hasPermission(role, "rooms.manage");
  const orgQuery = `organizationId=${activeOrganization.id}`;

  return (
    <div className="grid gap-8">
      <ModuleHeader
        eyebrow="Rooms"
        title={`Room ${room.roomNumber}`}
        description={roomLabel(room)}
        actions={
          <Button asChild variant="outline">
            <Link href={`/app/rooms?${orgQuery}`}>Back to rooms</Link>
          </Button>
        }
      />
      <StatusBanner error={query.error} updated={query.updated} />

      <section className="grid gap-3 md:grid-cols-4">
        <Metric
          icon={<DoorOpen className="size-5" aria-hidden="true" />}
          label="Status"
          value={room.status}
        />
        <Metric
          icon={<Banknote className="size-5" aria-hidden="true" />}
          label="Rent"
          value={formatMoney(room.rentAmount)}
        />
        <Metric
          icon={<Banknote className="size-5" aria-hidden="true" />}
          label="Deposit"
          value={formatMoney(room.depositAmount)}
        />
        <Metric
          icon={<Wrench className="size-5" aria-hidden="true" />}
          label="Open maintenance"
          value={room.maintenanceRequests.length}
        />
      </section>

      <section className="rounded-lg border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Room action shortcuts</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Status changes still happen only through workflow actions.
            </p>
          </div>
          <StatusPill label={room.status} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {canManageCustomers && room.status === "VACANT" ? (
            <>
              <Button asChild size="sm">
                <Link href={`/app/operations/move-in?${orgQuery}`}>
                  <DoorOpen className="size-4" aria-hidden="true" />
                  Move in
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/app/operations/reserve-room?${orgQuery}`}>
                  <CalendarCheck className="size-4" aria-hidden="true" />
                  Reserve
                </Link>
              </Button>
            </>
          ) : null}
          {canManageRooms && room.status === "VACANT" ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/app/operations/mark-unavailable?${orgQuery}`}>
                <CalendarX className="size-4" aria-hidden="true" />
                Mark unavailable
              </Link>
            </Button>
          ) : null}
          {canManageCustomers && room.status === "RESERVED" ? (
            <Button asChild size="sm">
              <Link href={`/app/operations/reserve-room?${orgQuery}`}>
                <CalendarCheck className="size-4" aria-hidden="true" />
                Manage reservation
              </Link>
            </Button>
          ) : null}
          {canManageCustomers && room.status === "OCCUPIED" ? (
            <>
              <Button asChild size="sm">
                <Link href={`/app/operations/move-out?${orgQuery}`}>
                  <LogOut className="size-4" aria-hidden="true" />
                  Move out
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/app/operations/monthly-invoice?${orgQuery}`}>
                  <Banknote className="size-4" aria-hidden="true" />
                  Invoice
                </Link>
              </Button>
            </>
          ) : null}
          {canRecordMeters ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/app/operations/meter-reading?${orgQuery}`}>
                <Gauge className="size-4" aria-hidden="true" />
                Meter reading
              </Link>
            </Button>
          ) : null}
          {(canManageMaintenance || canCreateMaintenance) &&
          (room.status === "VACANT" ||
            room.status === "OCCUPIED" ||
            room.status === "MAINTENANCE") ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/app/operations/maintenance?${orgQuery}`}>
                <Wrench className="size-4" aria-hidden="true" />
                Maintenance
              </Link>
            </Button>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <ListPanel
          icon={<DoorOpen className="size-5" aria-hidden="true" />}
          title="Current stay"
        >
          {assignment ? (
            <article className="grid gap-2 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{assignment.residentFullName}</h3>
                <StatusPill label={assignment.residentCode} />
              </div>
              <p className="text-sm text-muted-foreground">
                {assignment.residentPhone || "No phone"} - moved in{" "}
                {formatDate(assignment.moveInDate)}
              </p>
              <p className="text-sm text-muted-foreground">
                Login: {assignment.loginUser?.username || "No active room login"}
              </p>
              {assignment.contract ? (
                <p className="text-sm text-muted-foreground">
                  Contract {assignment.contract.contractNumber} - rent{" "}
                  {formatMoney(assignment.contract.rentAmount)}
                </p>
              ) : null}
            </article>
          ) : (
            <EmptyState label="No active stay in this room." />
          )}
        </ListPanel>

        <ListPanel
          icon={<CalendarCheck className="size-5" aria-hidden="true" />}
          title="Reservation"
        >
          {reservation ? (
            <article className="grid gap-2 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{reservation.reserverName}</h3>
                <StatusPill label={reservation.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                {reservation.reserverPhone || "No phone"} - reserved{" "}
                {formatDate(reservation.reservedDate)}
              </p>
              {reservation.expectedMoveInDate ? (
                <p className="text-sm text-muted-foreground">
                  Expected move-in {formatDate(reservation.expectedMoveInDate)}
                </p>
              ) : null}
            </article>
          ) : (
            <EmptyState label="No active reservation for this room." />
          )}
        </ListPanel>

        <ListPanel
          icon={<Banknote className="size-5" aria-hidden="true" />}
          title="Recent invoices"
        >
          {assignment?.invoices.length ? (
            assignment.invoices.map((invoice) => (
              <article
                key={invoice.id}
                className="grid gap-2 border-b py-4 last:border-b-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{invoice.invoiceNumber}</h3>
                  <StatusPill label={invoice.status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatMoney(invoice.totalAmount)} - due{" "}
                  {formatDate(invoice.dueDate)}
                </p>
              </article>
            ))
          ) : (
            <EmptyState label="No invoices for the current stay." />
          )}
        </ListPanel>

        <ListPanel
          icon={<Gauge className="size-5" aria-hidden="true" />}
          title="Recent meter readings"
        >
          {room.meterReadings.length ? (
            room.meterReadings.map((reading) => (
              <article
                key={reading.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b py-4 last:border-b-0"
              >
                <div>
                  <p className="font-semibold">
                    {reading.meterType === "WATER" ? "Water" : "Electric"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(reading.readingDate)} - {reading.note || "No note"}
                  </p>
                </div>
                <StatusPill label={formatMoney(reading.readingValue)} />
              </article>
            ))
          ) : (
            <EmptyState label="No meter readings for this room." />
          )}
        </ListPanel>

        <ListPanel
          icon={<Wrench className="size-5" aria-hidden="true" />}
          title="Maintenance"
        >
          {room.maintenanceRequests.length ? (
            room.maintenanceRequests.map((request) => (
              <article
                key={request.id}
                className="grid gap-2 border-b py-4 last:border-b-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{request.title}</h3>
                  <StatusPill label={request.status} />
                  <StatusPill label={request.priority} muted />
                </div>
                <p className="text-sm text-muted-foreground">
                  {request.assignedTo?.email || "Unassigned"} -{" "}
                  {formatDate(request.createdAt)}
                </p>
              </article>
            ))
          ) : (
            <EmptyState label="No maintenance requests for this room." />
          )}
        </ListPanel>
      </section>
    </div>
  );
}

async function getRoomDetail({
  organizationId,
  profileId,
  role,
  roomId
}: {
  organizationId: string;
  profileId: string;
  role: Exclude<Role, "SA">;
  roomId: string;
}) {
  const prisma = getPrisma();
  const roomWhere =
    role === "RESIDENT"
      ? {
          id: roomId,
          assignments: {
            some: {
              loginUserId: profileId,
              organizationId,
              status: "ACTIVE" as const
            }
          }
        }
      : {
          id: roomId,
          floor: {
            building: {
              asset: {
                organizationId
              }
            }
          }
        };

  return prisma.room.findFirst({
    where: roomWhere,
    include: {
      assignments: {
        where: {
          organizationId,
          status: "ACTIVE"
        },
        include: {
          contract: true,
          invoices: {
            orderBy: {
              createdAt: "desc"
            },
            take: 8
          },
          loginUser: true
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 1
      },
      floor: {
        include: {
          building: {
            include: {
              asset: true
            }
          }
        }
      },
      maintenanceRequests: {
        where: {
          organizationId
        },
        include: {
          assignedTo: true
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 10
      },
      meterReadings: {
        where: {
          organizationId
        },
        orderBy: {
          readingDate: "desc"
        },
        take: 8
      },
      reservations: {
        where: {
          organizationId,
          status: "ACTIVE"
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 1
      }
    }
  });
}
