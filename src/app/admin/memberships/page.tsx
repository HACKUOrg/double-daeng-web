import { Link2, Trash2, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPrisma } from "@/lib/prisma";
import { roleLabels } from "@/lib/rbac";
import { requirePermission } from "@/lib/auth/session";
import {
  assignOrganizationMembership,
  removeOrganizationMembership
} from "./actions";

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
          not: "SA"
        }
      },
      orderBy: [{ role: "asc" }, { email: "asc" }]
    }),
    prisma.organization.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }]
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
        <div className="grid grid-cols-2 gap-2 text-sm md:min-w-56">
          <Metric label="Users" value={users.length} />
          <Metric label="Memberships" value={memberships.length} />
        </div>
      </section>

      <StatusBanner params={params} />

      <section className="rounded-lg border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <UserPlus className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-base font-semibold">Assign membership</h2>
        </div>
        {users.length && organizations.length ? (
          <form
            action={assignOrganizationMembership}
            className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"
          >
            <label className="grid gap-2 text-sm font-medium">
              User
              <select
                name="userId"
                required
                className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.email} - {roleLabels[user.role]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Organization
              <select
                name="organizationId"
                required
                className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name} - {organization.status}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" className="self-end">
              <Link2 className="size-4" aria-hidden="true" />
              Assign
            </Button>
          </form>
        ) : (
          <p className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
            No non-SA user profiles are available for assignment yet.
          </p>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="border-b px-5 py-4">
          <h2 className="text-base font-semibold">Assigned memberships</h2>
        </div>
        {memberships.length ? (
          <div className="divide-y">
            {memberships.map((membership) => (
              <article
                key={membership.id}
                className="grid gap-4 p-5 md:grid-cols-[1fr_auto]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Users className="size-4 text-primary" aria-hidden="true" />
                    <h3 className="font-semibold">{membership.user.email}</h3>
                    <span className="rounded-full border bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {roleLabels[membership.user.role]}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {membership.organization.name} -{" "}
                    {membership.organization.status}
                  </p>
                </div>
                <form action={removeOrganizationMembership} className="self-start">
                  <input
                    type="hidden"
                    name="membershipId"
                    value={membership.id}
                  />
                  <Button type="submit" variant="destructive" size="sm">
                    <Trash2 className="size-4" aria-hidden="true" />
                    Remove
                  </Button>
                </form>
              </article>
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
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
