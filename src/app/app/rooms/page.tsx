import Link from "next/link";
import { BedDouble, Building2, DoorOpen, Home, Wrench } from "lucide-react";
import {
  EmptyState,
  Metric,
  ModuleHeader,
  NoOrganizationState,
  StatusBanner,
  StatusPill,
  formatMoney,
  roomLabel
} from "@/app/app/operations/_components/operation-ui";
import { Button } from "@/components/ui/button";
import { resolveActiveOrganization } from "@/lib/auth/organization-scope";
import { requirePermission } from "@/lib/auth/session";
import { getPrisma } from "@/lib/prisma";
import { type Role } from "@/lib/rbac";

type RoomsPageProps = {
  searchParams: Promise<{
    organizationId?: string;
    error?: string;
    updated?: string;
  }>;
};

type RoomStatus =
  | "VACANT"
  | "OCCUPIED"
  | "MAINTENANCE"
  | "UNAVAILABLE"
  | "RESERVED";

const roomStatuses: RoomStatus[] = [
  "VACANT",
  "OCCUPIED",
  "MAINTENANCE",
  "RESERVED",
  "UNAVAILABLE"
];

export default async function RoomsPage({ searchParams }: RoomsPageProps) {
  const profile = await requirePermission("app.access");
  const role = profile.role as Exclude<Role, "SA">;
  const query = await searchParams;
  const { activeOrganization } = resolveActiveOrganization(
    profile,
    query.organizationId
  );

  if (!activeOrganization) {
    return (
      <div className="grid gap-8">
        <ModuleHeader
          eyebrow="Rooms"
          title="Rooms"
          description="Choose an active organization from the sidebar before viewing rooms."
        />
        <StatusBanner error={query.error} updated={query.updated} />
        <NoOrganizationState />
      </div>
    );
  }

  const rooms = await getRooms({
    organizationId: activeOrganization.id,
    profileId: profile.id,
    role
  });
  const counts = Object.fromEntries(
    roomStatuses.map((status) => [
      status,
      rooms.filter((room) => room.status === status).length
    ])
  ) as Record<RoomStatus, number>;

  return (
    <div className="grid gap-8">
      <ModuleHeader
        eyebrow="Rooms"
        title="Room overview"
        description={`${activeOrganization.name} rooms, current status, active stays, reservations, and open maintenance in one place.`}
      />
      <StatusBanner error={query.error} updated={query.updated} />

      <section className="grid gap-3 md:grid-cols-5">
        <Metric
          icon={<DoorOpen className="size-5" aria-hidden="true" />}
          label="Vacant"
          value={counts.VACANT}
        />
        <Metric
          icon={<BedDouble className="size-5" aria-hidden="true" />}
          label="Occupied"
          value={counts.OCCUPIED}
        />
        <Metric
          icon={<Wrench className="size-5" aria-hidden="true" />}
          label="Maintenance"
          value={counts.MAINTENANCE}
        />
        <Metric
          icon={<Home className="size-5" aria-hidden="true" />}
          label="Reserved"
          value={counts.RESERVED}
        />
        <Metric
          icon={<Building2 className="size-5" aria-hidden="true" />}
          label="Unavailable"
          value={counts.UNAVAILABLE}
        />
      </section>

      {rooms.length ? (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => {
            const assignment = room.assignments[0];
            const reservation = room.reservations[0];
            const openMaintenance = room.maintenanceRequests.length;

            return (
              <article key={room.id} className="rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{room.roomNumber}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {roomLabel(room)}
                    </p>
                  </div>
                  <StatusPill label={room.status} />
                </div>

                <dl className="mt-4 grid gap-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Rent</dt>
                    <dd className="font-medium">{formatMoney(room.rentAmount)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Deposit</dt>
                    <dd className="font-medium">
                      {formatMoney(room.depositAmount)}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
                  <p>
                    Resident:{" "}
                    <span className="text-foreground">
                      {assignment?.residentFullName || "None"}
                    </span>
                  </p>
                  <p>
                    Reservation:{" "}
                    <span className="text-foreground">
                      {reservation?.reserverName || "None"}
                    </span>
                  </p>
                  <p>
                    Open maintenance:{" "}
                    <span className="text-foreground">{openMaintenance}</span>
                  </p>
                </div>

                <div className="mt-5">
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={`/app/rooms/${room.id}?organizationId=${activeOrganization.id}`}
                    >
                      View details
                    </Link>
                  </Button>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <EmptyState label="No rooms found in this organization." />
      )}
    </div>
  );
}

async function getRooms({
  organizationId,
  profileId,
  role
}: {
  organizationId: string;
  profileId: string;
  role: Exclude<Role, "SA">;
}) {
  const prisma = getPrisma();
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

  return prisma.room.findMany({
    where: roomWhere,
    include: {
      assignments: {
        where: {
          organizationId,
          status: "ACTIVE"
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
          organizationId,
          status: {
            in: ["OPEN", "IN_PROGRESS"]
          }
        },
        take: 2
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
  });
}
