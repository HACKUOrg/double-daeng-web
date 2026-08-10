import {
  Banknote,
  CalendarCheck,
  CalendarX,
  ClipboardList,
  DoorOpen,
  FileText,
  Gauge,
  LifeBuoy,
  LogOut,
  Users,
  Wrench
} from "lucide-react";
import { OrganizationSwitcher } from "@/app/app/_components/organization-switcher";
import {
  assignRoom,
  cancelReservation,
  createInvoice,
  createMaintenanceRequest,
  markRoomUnavailable,
  moveOutRoom,
  recordMeterReading,
  reserveRoom,
  updateMaintenanceStatus
} from "@/app/app/operations/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveActiveOrganization } from "@/lib/auth/organization-scope";
import { requirePermission } from "@/lib/auth/session";
import { getPrisma } from "@/lib/prisma";
import { hasPermission, roleLabels, type Role } from "@/lib/rbac";

type OperationsPageProps = {
  searchParams: Promise<{
    organizationId?: string;
    error?: string;
    updated?: string;
  }>;
};

const invoiceStatuses = ["DRAFT", "ISSUED", "PAID", "OVERDUE", "CANCELLED"];
const maintenancePriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const maintenanceStatuses = ["OPEN", "IN_PROGRESS", "RESOLVED", "CANCELLED"];

export default async function OperationsPage({
  searchParams
}: OperationsPageProps) {
  const profile = await requirePermission("app.access");
  const role = profile.role as Exclude<Role, "SA">;
  const query = await searchParams;
  const { activeMemberships, activeOrganization } = resolveActiveOrganization(
    profile,
    query.organizationId
  );
  const prisma = getPrisma();
  const canManageCustomers = hasPermission(role, "customers.manage");
  const canManageMaintenance = hasPermission(role, "maintenance.manage");
  const canCreateMaintenance = hasPermission(role, "maintenance.create");
  const canManageRooms = hasPermission(role, "rooms.manage");
  const canRecordMeters =
    hasPermission(role, "room_status.update") || hasPermission(role, "rooms.manage");

  const data = activeOrganization
    ? await getOperationsData({
        organizationId: activeOrganization.id,
        profileId: profile.id,
        role,
        prisma
      })
    : null;

  return (
    <div className="grid gap-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Phase 8</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">
            Core operations
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Manage move-ins, room assignments, contracts, invoices, meter
            readings, and maintenance requests inside the active organization.
          </p>
        </div>
        {activeOrganization ? (
          <div className="md:min-w-72">
            <OrganizationSwitcher
              activeOrganizationId={activeOrganization.id}
              action="/app/operations"
              memberships={activeMemberships}
            />
          </div>
        ) : null}
      </section>

      <StatusBanner error={query.error} updated={query.updated} />

      {activeOrganization && data ? (
        <>
          <section className="grid gap-3 md:grid-cols-4">
            <Metric
              icon={<Users className="size-5" aria-hidden="true" />}
              label="Residents"
              value={data.activeAssignments.length}
            />
            <Metric
              icon={<DoorOpen className="size-5" aria-hidden="true" />}
              label="Active stays"
              value={data.activeAssignments.length}
            />
            <Metric
              icon={<Banknote className="size-5" aria-hidden="true" />}
              label="Open invoices"
              value={data.openInvoices}
            />
            <Metric
              icon={<Wrench className="size-5" aria-hidden="true" />}
              label="Open maintenance"
              value={data.openMaintenance}
            />
          </section>

          {role === "RESIDENT" ? (
            <ResidentOperations
              activeAssignment={data.ownAssignment}
              invoices={data.invoices}
              maintenanceRequests={data.maintenanceRequests}
              organizationId={activeOrganization.id}
              rooms={data.rooms}
              canCreateMaintenance={canCreateMaintenance}
            />
          ) : (
            <StaffOperations
              activeAssignments={data.activeAssignments}
              activeReservations={data.activeReservations}
              canManageCustomers={canManageCustomers}
              canManageMaintenance={canManageMaintenance}
              canManageRooms={canManageRooms}
              canRecordMeters={canRecordMeters}
              invoices={data.invoices}
              maintenanceRequests={data.maintenanceRequests}
              meterReadings={data.meterReadings}
              organizationId={activeOrganization.id}
              role={role}
              rooms={data.rooms}
              staffUsers={data.staffUsers}
            />
          )}
        </>
      ) : (
        <section className="rounded-lg border border-dashed bg-card p-8 text-center">
          <ClipboardList className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No active memberships assigned</p>
          <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
            Ask an SA to assign this account to an active organization before
            using operations.
          </p>
        </section>
      )}
    </div>
  );
}

async function getOperationsData({
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
        organizationId
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

function StaffOperations({
  activeAssignments,
  activeReservations,
  canManageCustomers,
  canManageMaintenance,
  canManageRooms,
  canRecordMeters,
  invoices,
  maintenanceRequests,
  meterReadings,
  organizationId,
  role,
  rooms,
  staffUsers
}: {
  activeAssignments: Awaited<ReturnType<typeof getOperationsData>>["activeAssignments"];
  activeReservations: Awaited<ReturnType<typeof getOperationsData>>["activeReservations"];
  canManageCustomers: boolean;
  canManageMaintenance: boolean;
  canManageRooms: boolean;
  canRecordMeters: boolean;
  invoices: Awaited<ReturnType<typeof getOperationsData>>["invoices"];
  maintenanceRequests: Awaited<ReturnType<typeof getOperationsData>>["maintenanceRequests"];
  meterReadings: Awaited<ReturnType<typeof getOperationsData>>["meterReadings"];
  organizationId: string;
  role: Exclude<Role, "SA">;
  rooms: Awaited<ReturnType<typeof getOperationsData>>["rooms"];
  staffUsers: Awaited<ReturnType<typeof getOperationsData>>["staffUsers"];
}) {
  const vacantRooms = rooms.filter((room) => room.status === "VACANT");
  const occupiableRooms = vacantRooms;
  const maintenanceRooms = rooms.filter(
    (room) => room.status === "VACANT" || room.status === "OCCUPIED"
  );
  const unavailableRooms = vacantRooms;

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 xl:grid-cols-2">
        {canManageCustomers ? (
          <Panel
            icon={<DoorOpen className="size-5" aria-hidden="true" />}
            title="Move-in"
            description="Create the resident stay, room login, and optional contract in one step."
          >
            <form action={assignRoom} className="grid gap-3">
              <input type="hidden" name="organizationId" value={organizationId} />
              <SelectField label="Room" name="roomId">
                {occupiableRooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {roomLabel(room)}
                  </option>
                ))}
              </SelectField>
              <div className="grid gap-3 md:grid-cols-2">
                <TextField name="residentFullName" label="Resident full name" required />
                <TextField name="residentPhone" label="Phone" />
                <TextField name="emergencyContact" label="Emergency contact" />
                <TextField name="moveInDate" label="Move-in date" type="date" required />
                <TextField
                  name="idDocumentNumber"
                  label="ID / passport number"
                  minLength={6}
                  maxLength={64}
                  required
                />
                <TextField name="contractNumber" label="Contract number" />
              </div>
              <Button type="submit" className="justify-self-start">
                <DoorOpen className="size-4" aria-hidden="true" />
                Assign room
              </Button>
            </form>
          </Panel>
        ) : null}
        {canManageCustomers ? (
          <Panel
            icon={<CalendarCheck className="size-5" aria-hidden="true" />}
            title="Reserve room"
            description="Hold a vacant room for a prospective resident."
          >
            <form action={reserveRoom} className="grid gap-3">
              <input type="hidden" name="organizationId" value={organizationId} />
              <SelectField label="Room" name="roomId">
                {vacantRooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {roomLabel(room)}
                  </option>
                ))}
              </SelectField>
              <div className="grid gap-3 md:grid-cols-2">
                <TextField name="reserverName" label="Reserver name" required />
                <TextField name="reserverPhone" label="Phone" />
                <TextField name="reservedDate" label="Reserved date" type="date" required />
                <TextField
                  name="expectedMoveInDate"
                  label="Expected move-in"
                  type="date"
                />
              </div>
              <TextField name="note" label="Note" />
              <Button type="submit" className="justify-self-start">
                <CalendarCheck className="size-4" aria-hidden="true" />
                Reserve room
              </Button>
            </form>
          </Panel>
        ) : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {canManageCustomers ? (
          <Panel
            icon={<Banknote className="size-5" aria-hidden="true" />}
            title="Monthly invoice"
            description="Create an invoice for a current stay."
          >
            <form action={createInvoice} className="grid gap-3">
              <input type="hidden" name="organizationId" value={organizationId} />
              <SelectField label="Stay" name="roomAssignmentId">
                {activeAssignments.map((assignment) => (
                  <option key={assignment.id} value={assignment.id}>
                    {assignment.residentFullName} - {roomLabel(assignment.room)}
                  </option>
                ))}
              </SelectField>
              <div className="grid gap-3 md:grid-cols-2">
                <TextField name="invoiceNumber" label="Invoice number" required />
                <TextField name="totalAmount" label="Total amount" inputMode="decimal" required />
                <TextField name="issueDate" label="Issue date" type="date" required />
                <TextField name="dueDate" label="Due date" type="date" required />
              </div>
              <SelectField label="Status" name="status" defaultValue="ISSUED">
                {invoiceStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </SelectField>
              <Button type="submit" className="justify-self-start">
                <Banknote className="size-4" aria-hidden="true" />
                Create invoice
              </Button>
            </form>
          </Panel>
        ) : null}

        {canRecordMeters ? (
          <Panel
            icon={<Gauge className="size-5" aria-hidden="true" />}
            title="Meter reading"
            description="Record water or electric readings for a room."
          >
            <form action={recordMeterReading} className="grid gap-3">
              <input type="hidden" name="organizationId" value={organizationId} />
              <SelectField label="Room" name="roomId">
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {roomLabel(room)}
                  </option>
                ))}
              </SelectField>
              <div className="grid gap-3 md:grid-cols-3">
                <SelectField label="Meter" name="meterType" defaultValue="WATER">
                  <option value="WATER">Water</option>
                  <option value="ELECTRIC">Electric</option>
                </SelectField>
                <TextField name="readingDate" label="Reading date" type="date" required />
                <TextField name="readingValue" label="Reading" inputMode="decimal" required />
              </div>
              <TextField name="note" label="Note" />
              <Button type="submit" className="justify-self-start">
                <Gauge className="size-4" aria-hidden="true" />
                Record reading
              </Button>
            </form>
          </Panel>
        ) : null}
        {canManageRooms ? (
          <Panel
            icon={<CalendarX className="size-5" aria-hidden="true" />}
            title="Mark unavailable"
            description="Take a vacant room out of service."
          >
            <form action={markRoomUnavailable} className="grid gap-3">
              <input type="hidden" name="organizationId" value={organizationId} />
              <SelectField label="Room" name="roomId">
                {unavailableRooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {roomLabel(room)}
                  </option>
                ))}
              </SelectField>
              <Button type="submit" variant="outline" className="justify-self-start">
                <CalendarX className="size-4" aria-hidden="true" />
                Mark unavailable
              </Button>
            </form>
          </Panel>
        ) : null}
      </section>

      <Panel
        icon={<LifeBuoy className="size-5" aria-hidden="true" />}
        title="Maintenance"
        description={
          role === "MANAGER"
            ? "Create requests and assign work to staff."
            : "Create requests and update maintenance work."
        }
      >
        <form action={createMaintenanceRequest} className="grid gap-3">
          <input type="hidden" name="organizationId" value={organizationId} />
          <div className="grid gap-3 md:grid-cols-2">
            <SelectField label="Room" name="roomId">
              {maintenanceRooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {roomLabel(room)}
                </option>
              ))}
            </SelectField>
            <SelectField label="Stay" name="roomAssignmentId" optional>
              {activeAssignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {assignment.residentFullName} - {roomLabel(assignment.room)}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_180px]">
            <TextField name="title" label="Title" required />
            <SelectField label="Priority" name="priority" defaultValue="MEDIUM">
              {maintenancePriorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </SelectField>
          </div>
          <label className="grid gap-2 text-sm font-medium">
            Description
            <textarea
              name="description"
              required
              className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <Button type="submit" className="justify-self-start">
            <LifeBuoy className="size-4" aria-hidden="true" />
            Create request
          </Button>
        </form>
      </Panel>

      <section className="grid gap-4 xl:grid-cols-2">
        <ListPanel
          icon={<CalendarCheck className="size-5" aria-hidden="true" />}
          title="Reservations"
        >
          {activeReservations.length ? (
            activeReservations.map((reservation) => (
              <article key={reservation.id} className="grid gap-3 border-b py-4 last:border-b-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{reservation.reserverName}</h3>
                  <StatusPill label={reservation.status} />
                  <StatusPill label={roomLabel(reservation.room)} muted />
                </div>
                <p className="text-sm text-muted-foreground">
                  {reservation.reserverPhone || "No phone"} - reserved{" "}
                  {formatDate(reservation.reservedDate)}
                  {reservation.expectedMoveInDate
                    ? ` - expected ${formatDate(reservation.expectedMoveInDate)}`
                    : ""}
                </p>
                <form action={assignRoom} className="grid gap-2 md:grid-cols-2">
                  <input type="hidden" name="organizationId" value={organizationId} />
                  <input type="hidden" name="reservationId" value={reservation.id} />
                  <input type="hidden" name="roomId" value={reservation.roomId} />
                  <TextField name="moveInDate" label="Move-in date" type="date" required />
                  <TextField
                    name="idDocumentNumber"
                    label="ID / passport number"
                    minLength={6}
                    maxLength={64}
                    required
                  />
                  <TextField name="emergencyContact" label="Emergency contact" />
                  <TextField name="contractNumber" label="Contract number" />
                  <Button type="submit" className="justify-self-start">
                    <DoorOpen className="size-4" aria-hidden="true" />
                    Move in
                  </Button>
                </form>
                <form action={cancelReservation}>
                  <input type="hidden" name="organizationId" value={organizationId} />
                  <input type="hidden" name="reservationId" value={reservation.id} />
                  <Button type="submit" variant="outline" size="sm">
                    <CalendarX className="size-4" aria-hidden="true" />
                    Cancel reservation
                  </Button>
                </form>
              </article>
            ))
          ) : (
            <EmptyState label="No active reservations" />
          )}
        </ListPanel>

        <ListPanel
          icon={<Users className="size-5" aria-hidden="true" />}
          title="Residents and active stays"
        >
          {activeAssignments.length ? (
            activeAssignments.map((assignment) => (
              <article key={assignment.id} className="grid gap-2 border-b py-4 last:border-b-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{assignment.residentFullName}</h3>
                  <StatusPill label={assignment.residentCode} />
                  <StatusPill label={assignment.status} muted />
                </div>
                <p className="text-sm text-muted-foreground">
                  {assignment.residentPhone || "No phone"} -{" "}
                  {assignment.loginUser?.username || "No active room login"}
                </p>
                <p className="text-sm text-muted-foreground">
                    Active stay: {roomLabel(assignment.room)} since{" "}
                    {formatDate(assignment.moveInDate)}
                    {assignment.contract
                      ? ` · Contract ${assignment.contract.contractNumber}`
                      : ""}
                    {assignment.loginUser?.username
                      ? ` · Login ${assignment.loginUser.username}`
                      : ""}
                </p>
                {canManageCustomers && assignment.room.status === "OCCUPIED" ? (
                  <form action={moveOutRoom} className="grid gap-2 md:grid-cols-[180px_auto]">
                    <input type="hidden" name="organizationId" value={organizationId} />
                    <input type="hidden" name="assignmentId" value={assignment.id} />
                    <TextField name="moveOutDate" label="Move-out date" type="date" required />
                    <Button type="submit" variant="outline" className="self-end justify-self-start">
                      <LogOut className="size-4" aria-hidden="true" />
                      Move out
                    </Button>
                  </form>
                ) : null}
              </article>
            ))
          ) : (
            <EmptyState label="No active stays yet" />
          )}
        </ListPanel>

        <ListPanel
          icon={<Banknote className="size-5" aria-hidden="true" />}
          title="Invoices"
        >
          {invoices.length ? (
            invoices.map((invoice) => (
              <article key={invoice.id} className="grid gap-2 border-b py-4 last:border-b-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{invoice.invoiceNumber}</h3>
                  <StatusPill label={invoice.status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {invoice.roomAssignment?.residentFullName || "No stay"} · {formatMoney(invoice.totalAmount)} · due{" "}
                  {formatDate(invoice.dueDate)}
                </p>
              </article>
            ))
          ) : (
            <EmptyState label="No invoices yet" />
          )}
        </ListPanel>

        <ListPanel
          icon={<Gauge className="size-5" aria-hidden="true" />}
          title="Meter readings"
        >
          {meterReadings.length ? (
            meterReadings.map((reading) => (
              <article key={reading.id} className="flex items-center justify-between gap-3 border-b py-4 last:border-b-0">
                <div>
                  <p className="font-semibold">{reading.room.roomNumber}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(reading.readingDate)} · {reading.note || "No note"}
                  </p>
                </div>
                <StatusPill
                  label={`${reading.meterType === "WATER" ? "Water" : "Electric"} ${formatMoney(reading.readingValue)}`}
                />
              </article>
            ))
          ) : (
            <EmptyState label="No meter readings yet" />
          )}
        </ListPanel>

        <ListPanel
          icon={<Wrench className="size-5" aria-hidden="true" />}
          title="Maintenance requests"
        >
          {maintenanceRequests.length ? (
            maintenanceRequests.map((request) => (
              <article key={request.id} className="grid gap-3 border-b py-4 last:border-b-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{request.title}</h3>
                  <StatusPill label={request.status} />
                  <StatusPill label={request.priority} muted />
                </div>
                <p className="text-sm text-muted-foreground">
                  {request.room?.roomNumber || "No room"} ·{" "}
                  {request.roomAssignment?.residentFullName || "No stay"} ·{" "}
                  {request.assignedTo?.email || "Unassigned"}
                </p>
                {canManageMaintenance ? (
                  <form action={updateMaintenanceStatus} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                    <input type="hidden" name="organizationId" value={organizationId} />
                    <input type="hidden" name="requestId" value={request.id} />
                    <SelectField label="Status" name="status" defaultValue={request.status}>
                      {maintenanceStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </SelectField>
                    <SelectField
                      label="Assignee"
                      name="assignedToUserId"
                      defaultValue={request.assignedToUserId ?? ""}
                      optional
                    >
                      {staffUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.email} - {roleLabels[user.role]}
                        </option>
                      ))}
                    </SelectField>
                    <Button type="submit" variant="outline" className="self-end">
                      Save
                    </Button>
                  </form>
                ) : null}
              </article>
            ))
          ) : (
            <EmptyState label="No maintenance requests yet" />
          )}
        </ListPanel>
      </section>
    </div>
  );
}

function ResidentOperations({
  activeAssignment,
  canCreateMaintenance,
  invoices,
  maintenanceRequests,
  organizationId,
  rooms
}: {
  activeAssignment: Awaited<ReturnType<typeof getOperationsData>>["ownAssignment"];
  canCreateMaintenance: boolean;
  invoices: Awaited<ReturnType<typeof getOperationsData>>["invoices"];
  maintenanceRequests: Awaited<ReturnType<typeof getOperationsData>>["maintenanceRequests"];
  organizationId: string;
  rooms: Awaited<ReturnType<typeof getOperationsData>>["rooms"];
}) {
  return (
    <div className="grid gap-6">
      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Panel
          icon={<FileText className="size-5" aria-hidden="true" />}
          title="My active stay"
          description="Your operational records are scoped to your active organization."
        >
          {activeAssignment ? (
            <div className="grid gap-2 text-sm">
              <p className="font-semibold">{activeAssignment.residentFullName}</p>
              <p className="text-muted-foreground">
                {activeAssignment.residentCode} - {activeAssignment.residentPhone || "No phone"}
              </p>
              <p className="text-muted-foreground">
                Active stay: {roomLabel(activeAssignment.room)} since{" "}
                {formatDate(activeAssignment.moveInDate)}
              </p>
            </div>
          ) : (
            <EmptyState label="No active stay linked to this room login" />
          )}
        </Panel>

        {canCreateMaintenance ? (
          <Panel
            icon={<LifeBuoy className="size-5" aria-hidden="true" />}
            title="Create maintenance request"
            description="Send a request to the operation team."
          >
            <form action={createMaintenanceRequest} className="grid gap-3">
              <input type="hidden" name="organizationId" value={organizationId} />
              <SelectField label="Room" name="roomId" optional>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {roomLabel(room)}
                  </option>
                ))}
              </SelectField>
              <div className="grid gap-3 md:grid-cols-[1fr_160px]">
                <TextField name="title" label="Title" required />
                <SelectField label="Priority" name="priority" defaultValue="MEDIUM">
                  {maintenancePriorities.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </SelectField>
              </div>
              <label className="grid gap-2 text-sm font-medium">
                Description
                <textarea
                  name="description"
                  required
                  className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <Button type="submit" className="justify-self-start">
                <LifeBuoy className="size-4" aria-hidden="true" />
                Send request
              </Button>
            </form>
          </Panel>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ListPanel
          icon={<Banknote className="size-5" aria-hidden="true" />}
          title="My invoices"
        >
          {invoices.length ? (
            invoices.map((invoice) => (
              <article key={invoice.id} className="grid gap-2 border-b py-4 last:border-b-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{invoice.invoiceNumber}</h3>
                  <StatusPill label={invoice.status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatMoney(invoice.totalAmount)} · due {formatDate(invoice.dueDate)}
                </p>
              </article>
            ))
          ) : (
            <EmptyState label="No invoices yet" />
          )}
        </ListPanel>

        <ListPanel
          icon={<Wrench className="size-5" aria-hidden="true" />}
          title="My maintenance"
        >
          {maintenanceRequests.length ? (
            maintenanceRequests.map((request) => (
              <article key={request.id} className="grid gap-2 border-b py-4 last:border-b-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{request.title}</h3>
                  <StatusPill label={request.status} />
                  <StatusPill label={request.priority} muted />
                </div>
                <p className="text-sm text-muted-foreground">
                  {request.room?.roomNumber || "No room"} ·{" "}
                  {request.assignedTo?.email || "Unassigned"}
                </p>
              </article>
            ))
          ) : (
            <EmptyState label="No maintenance requests yet" />
          )}
        </ListPanel>
      </section>
    </div>
  );
}

function Metric({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-center gap-3 text-muted-foreground">
        {icon}
        <p className="text-sm font-medium">{label}</p>
      </div>
      <p className="mt-4 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function Panel({
  children,
  description,
  icon,
  title
}: {
  children: React.ReactNode;
  description: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="flex items-center gap-3 text-primary">
        {icon}
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ListPanel({
  children,
  icon,
  title
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="flex items-center gap-3 text-primary">
        {icon}
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function TextField({
  label,
  name,
  type = "text",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <Input name={name} type={type} {...props} />
    </label>
  );
}

function SelectField({
  children,
  defaultValue,
  label,
  name,
  optional
}: {
  children: React.ReactNode;
  defaultValue?: string;
  label: string;
  name: string;
  optional?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <select
        name={name}
        defaultValue={defaultValue ?? (optional ? "" : undefined)}
        className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {optional ? <option value="">None</option> : null}
        {children}
      </select>
    </label>
  );
}

function StatusPill({ label, muted }: { label: string; muted?: boolean }) {
  const className = muted
    ? "border-muted bg-secondary text-muted-foreground"
    : "border-primary/30 bg-primary/10 text-primary";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{label}</p>;
}

function roomLabel(room: {
  roomNumber: string;
  floor?: {
    name: string;
    building?: {
      name: string;
      asset?: {
        name: string;
      };
    };
  };
}) {
  return [
    room.floor?.building?.asset?.name,
    room.floor?.building?.name,
    room.floor?.name,
    room.roomNumber
  ]
    .filter(Boolean)
    .join(" / ");
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    dateStyle: "medium"
  });
}

function formatMoney(value: { toString(): string }) {
  return Number(value.toString()).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function StatusBanner({
  error,
  updated
}: {
  error?: string;
  updated?: string;
}) {
  if (error) {
    return (
      <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        The submitted operation could not be saved.
      </p>
    );
  }

  if (updated) {
    return (
      <p className="rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
        Operation saved.
      </p>
    );
  }

  return null;
}
