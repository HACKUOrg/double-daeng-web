import Link from "next/link";
import {
  Building2,
  ClipboardList,
  DoorOpen,
  Home,
  Layers3,
  LifeBuoy,
  ShieldCheck,
  Users,
  Wrench
} from "lucide-react";
import { OrganizationSwitcher } from "@/app/app/_components/organization-switcher";
import { Button } from "@/components/ui/button";
import { resolveActiveOrganization } from "@/lib/auth/organization-scope";
import { requirePermission } from "@/lib/auth/session";
import { getPrisma } from "@/lib/prisma";
import { roleLabels, type Role } from "@/lib/rbac";

type AppPageProps = {
  searchParams: Promise<{
    organizationId?: string;
    error?: string;
  }>;
};

type RoomStatus = "VACANT" | "OCCUPIED" | "MAINTENANCE" | "UNAVAILABLE" | "RESERVED";

const roomStatusLabels: Record<RoomStatus, string> = {
  VACANT: "Vacant",
  OCCUPIED: "Occupied",
  MAINTENANCE: "Maintenance",
  UNAVAILABLE: "Unavailable",
  RESERVED: "Reserved"
};

const roleDashboardCopy: Record<
  Exclude<Role, "SA">,
  {
    title: string;
    description: string;
    focus: string[];
  }
> = {
  MANAGER: {
    title: "Manager dashboard",
    description:
      "Track organization coverage, property readiness, and team access before daily operations expand in Phase 8.",
    focus: ["Organization health", "Team coverage", "Room readiness"]
  },
  OPERATION: {
    title: "Operation dashboard",
    description:
      "Keep the active organization visible and prepare the workspace for room, resident, and maintenance workflows.",
    focus: ["Daily work queue", "Room status", "Resident support"]
  },
  RESIDENT: {
    title: "Resident dashboard",
    description:
      "Access room-scoped resident records and maintenance requests for the active stay.",
    focus: ["My room", "My requests", "My information"]
  }
};

export default async function AppPage({ searchParams }: AppPageProps) {
  const profile = await requirePermission("app.access");
  const role = profile.role as Exclude<Role, "SA">;
  const query = await searchParams;
  const { activeMemberships, activeOrganization } = resolveActiveOrganization(
    profile,
    query.organizationId
  );
  const prisma = getPrisma();

  const dashboard = activeOrganization
    ? await getOrganizationDashboard(prisma, activeOrganization.id)
    : null;
  const copy = roleDashboardCopy[role];

  return (
    <div className="grid gap-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">
            {roleLabels[role]}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">
            {copy.title}
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            {copy.description}
          </p>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3 text-sm md:min-w-64">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            Signed in as
          </p>
          <p className="mt-1 font-semibold">{profile.displayName}</p>
          <p className="text-muted-foreground">{profile.email}</p>
        </div>
      </section>

      <StatusBanner error={query.error} />

      {activeOrganization && dashboard ? (
        <>
          <section className="rounded-lg border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Building2 className="size-4 text-primary" aria-hidden="true" />
              <h2 className="text-base font-semibold">Active organization</h2>
            </div>
            <OrganizationSwitcher
              activeOrganizationId={activeOrganization.id}
              action="/app"
              memberships={activeMemberships}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              {copy.focus.map((item) => (
                <span
                  key={item}
                  className="rounded-full border bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground"
                >
                  {item}
                </span>
              ))}
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-4">
            <Metric
              icon={<Home className="size-5" aria-hidden="true" />}
              label="Assets"
              value={dashboard.assets}
            />
            <Metric
              icon={<Building2 className="size-5" aria-hidden="true" />}
              label="Buildings"
              value={dashboard.buildings}
            />
            <Metric
              icon={<Layers3 className="size-5" aria-hidden="true" />}
              label="Floors"
              value={dashboard.floors}
            />
            <Metric
              icon={<DoorOpen className="size-5" aria-hidden="true" />}
              label="Rooms"
              value={dashboard.rooms}
            />
          </section>

          <RoleWorkspace
            organizationName={activeOrganization.name}
            role={role}
            dashboard={dashboard}
          />
        </>
      ) : (
        <section className="rounded-lg border border-dashed bg-card p-8 text-center">
          <Building2 className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No active memberships assigned</p>
          <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
            Ask an SA to assign this user to an active organization before using
            the app workspace.
          </p>
        </section>
      )}
    </div>
  );
}

async function getOrganizationDashboard(
  prisma: ReturnType<typeof getPrisma>,
  organizationId: string
) {
  const roomWhere = {
    floor: {
      building: {
        asset: {
          organizationId
        }
      }
    }
  };
  const [assets, buildings, floors, rooms, roomsByStatus, usersByRole] =
    await Promise.all([
      prisma.asset.count({
        where: {
          organizationId
        }
      }),
      prisma.building.count({
        where: {
          asset: {
            organizationId
          }
        }
      }),
      prisma.floor.count({
        where: {
          building: {
            asset: {
              organizationId
            }
          }
        }
      }),
      prisma.room.count({
        where: roomWhere
      }),
      prisma.room.groupBy({
        by: ["status"],
        where: roomWhere,
        _count: {
          _all: true
        }
      }),
      prisma.user.groupBy({
        by: ["role"],
        where: {
          role: {
            in: ["MANAGER", "OPERATION", "RESIDENT"]
          },
          memberships: {
            some: {
              organizationId
            }
          }
        },
        _count: {
          _all: true
        }
      })
    ]);

  return {
    assets,
    buildings,
    floors,
    rooms,
    roomsByStatus: Object.fromEntries(
      (Object.keys(roomStatusLabels) as RoomStatus[]).map((status) => [
        status,
        roomsByStatus.find((row) => row.status === status)?._count._all ?? 0
      ])
    ) as Record<RoomStatus, number>,
    usersByRole: Object.fromEntries(
      (["MANAGER", "OPERATION", "RESIDENT"] as const).map((userRole) => [
        userRole,
        usersByRole.find((row) => row.role === userRole)?._count._all ?? 0
      ])
    ) as Record<Exclude<Role, "SA">, number>
  };
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

function RoleWorkspace({
  dashboard,
  organizationName,
  role
}: {
  dashboard: Awaited<ReturnType<typeof getOrganizationDashboard>>;
  organizationName: string;
  role: Exclude<Role, "SA">;
}) {
  if (role === "RESIDENT") {
    return (
      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <WorkspacePanel
          icon={<ShieldCheck className="size-5" aria-hidden="true" />}
          title="My room access"
          description={`${organizationName} is the active workspace for this account.`}
        >
          <p className="text-sm text-muted-foreground">
            Resident profile, contracts, invoices, and requests are scoped to
            the active room assignment.
          </p>
        </WorkspacePanel>
        <WorkspacePanel
          icon={<LifeBuoy className="size-5" aria-hidden="true" />}
          title="Resident services"
          description="Maintenance requests and own-data views are limited to this stay."
        >
          <ReadinessList
            items={[
              "Active room assignment required",
              "Maintenance request ready",
              "Own data permission ready"
            ]}
          />
        </WorkspacePanel>
      </section>
    );
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <WorkspacePanel
        icon={<DoorOpen className="size-5" aria-hidden="true" />}
        title={role === "MANAGER" ? "Room readiness" : "Daily operations"}
        description="Room totals are limited to the selected organization."
      >
        <RoomStatusGrid roomsByStatus={dashboard.roomsByStatus} />
      </WorkspacePanel>
      <WorkspacePanel
        icon={<Users className="size-5" aria-hidden="true" />}
        title={role === "MANAGER" ? "Team coverage" : "Service scope"}
        description="User counts include active organization memberships only."
      >
        <PeopleByRole usersByRole={dashboard.usersByRole} />
      </WorkspacePanel>
      <WorkspacePanel
        icon={<ClipboardList className="size-5" aria-hidden="true" />}
        title="Phase 8 runway"
        description="The app shell is ready for core dorm and condo operations."
      >
        <ReadinessList
          items={["Move-in records", "Room assignment", "Move-in / move-out"]}
        />
      </WorkspacePanel>
      <WorkspacePanel
        icon={<Wrench className="size-5" aria-hidden="true" />}
        title="Work controls"
        description={
          role === "MANAGER"
            ? "Managers can prepare teams and property data."
            : "Operations can prepare resident support flows."
        }
      >
        <Button asChild variant="outline">
          <Link href="/app/operations">
            <Wrench className="size-4" aria-hidden="true" />
            Open operations
          </Link>
        </Button>
      </WorkspacePanel>
    </section>
  );
}

function WorkspacePanel({
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

function RoomStatusGrid({
  roomsByStatus
}: {
  roomsByStatus: Record<RoomStatus, number>;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {(Object.keys(roomStatusLabels) as RoomStatus[]).map((status) => (
        <div key={status} className="rounded-md border bg-background px-4 py-3">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            {roomStatusLabels[status]}
          </p>
          <p className="mt-1 text-2xl font-semibold">{roomsByStatus[status]}</p>
        </div>
      ))}
    </div>
  );
}

function PeopleByRole({
  usersByRole
}: {
  usersByRole: Record<Exclude<Role, "SA">, number>;
}) {
  return (
    <div className="grid gap-2">
      {(Object.keys(usersByRole) as Exclude<Role, "SA">[]).map((userRole) => (
        <div
          key={userRole}
          className="flex items-center justify-between rounded-md border bg-background px-4 py-3"
        >
          <span className="text-sm font-medium">{roleLabels[userRole]}</span>
          <span className="text-lg font-semibold">{usersByRole[userRole]}</span>
        </div>
      ))}
    </div>
  );
}

function ReadinessList({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-2 text-sm text-muted-foreground">
      {items.map((item) => (
        <li key={item} className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function StatusBanner({ error }: { error?: string }) {
  if (!error) {
    return null;
  }

  return (
    <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      The selected organization could not be used for this workspace.
    </p>
  );
}
