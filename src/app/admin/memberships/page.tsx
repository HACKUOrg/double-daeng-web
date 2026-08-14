import { UserPlus, Users } from "lucide-react";
import { getPrisma } from "@/lib/prisma";
import { roleLabels } from "@/lib/rbac";
import { requirePermission } from "@/lib/auth/session";
import {
  assignOrganizationMembership,
  removeOrganizationMembership
} from "./actions";
import { MembershipAssignmentForm } from "./_components/membership-assignment-form";
import { MembershipGroupAccordion } from "./_components/membership-group-accordion";

type MembershipsPageProps = {
  searchParams: Promise<{
    created?: string;
    updated?: string;
    deleted?: string;
    error?: string;
  }>;
};

export default async function MembershipsPage({
  searchParams
}: MembershipsPageProps) {
  await requirePermission("memberships.manage");
  const prisma = getPrisma();
  const [params, users, organizations, memberships] = await Promise.all([
    searchParams,
    prisma.user.findMany({
      where: {
        role: {
          in: ["MANAGER", "OPERATION"]
        }
      },
      orderBy: [{ role: "asc" }, { email: "asc" }]
    }),
    prisma.organization.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" }
    }),
    prisma.organizationMembership.findMany({
      include: {
        organization: true,
        user: true
      },
      orderBy: [
        { organization: { name: "asc" } },
        { user: { email: "asc" } }
      ]
    })
  ]);
  const membershipGroups = groupMembershipsByUser(memberships);

  return (
    <div className="grid gap-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Phase 3</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">
            Organization memberships
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Assign existing non-SA user profiles to organizations so each user
            works inside the right tenant boundary.
          </p>
        </div>
      </section>

      <StatusBanner params={params} />

      <section className="rounded-lg border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <UserPlus className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-base font-semibold">Assign membership</h2>
        </div>
        {users.length && organizations.length ? (
          <MembershipAssignmentForm
            action={assignOrganizationMembership}
            users={users.map((user) => ({
              id: user.id,
              email: user.email,
              role: user.role
            }))}
            organizations={organizations}
            memberships={memberships.map(({ userId, organizationId }) => ({
              userId,
              organizationId
            }))}
          />
        ) : (
          <p className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
            {users.length
              ? "No active organizations are available for assignment yet."
              : "No non-SA user profiles are available for assignment yet."}
          </p>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="border-b px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">Assigned memberships</h2>
            <span className="rounded-full border bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {memberships.length} memberships
            </span>
          </div>
        </div>
        {membershipGroups.length ? (
          <div className="divide-y">
            {membershipGroups.map((group) => (
              <MembershipGroupAccordion
                key={group.user.id}
                action={removeOrganizationMembership}
                group={group}
              />
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <Users className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-medium">No memberships assigned</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Assign a user to an organization to unlock scoped `/app` access.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function groupMembershipsByUser(
  memberships: Array<{
    id: string;
    organization: { name: string; status: string };
    user: { id: string; email: string; role: keyof typeof roleLabels };
  }>
) {
  const groups = new Map<
    string,
    {
      user: (typeof memberships)[number]["user"];
      memberships: Array<(typeof memberships)[number]>;
    }
  >();

  for (const membership of memberships) {
    const existing = groups.get(membership.user.id);
    if (existing) {
      existing.memberships.push(membership);
      continue;
    }

    groups.set(membership.user.id, {
      user: membership.user,
      memberships: [membership]
    });
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      memberships: [...group.memberships].sort((left, right) =>
        left.organization.name.localeCompare(right.organization.name)
      )
    }))
    .sort((left, right) => left.user.email.localeCompare(right.user.email));
}

function StatusBanner({
  params
}: {
  params: {
    created?: string;
    updated?: string;
    deleted?: string;
    error?: string;
  };
}) {
  if (params.error) {
    return (
      <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        The submitted membership data could not be saved.
      </p>
    );
  }

  if (params.created || params.updated || params.deleted) {
    return (
      <p className="rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
        Membership changes saved.
      </p>
    );
  }

  return null;
}
