import { KeyRound, RefreshCw, UserPlus, Users } from "lucide-react";
import { OrganizationSwitcher } from "@/app/app/_components/organization-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveActiveOrganization } from "@/lib/auth/organization-scope";
import { requirePermission } from "@/lib/auth/session";
import { getPrisma } from "@/lib/prisma";
import { creatableRolesByRole, roleLabels, type Role } from "@/lib/rbac";
import {
  createManagedUser,
  resetManagedUserPassword,
  updateManagedUser
} from "@/app/users/actions";

type AppUsersPageProps = {
  searchParams: Promise<{
    organizationId?: string;
    created?: string;
    updated?: string;
    error?: string;
  }>;
};

const statuses = ["ACTIVE", "SUSPENDED"] as const;

export default async function AppUsersPage({ searchParams }: AppUsersPageProps) {
  const profile = await requirePermission("users.manage.organization");
  const query = await searchParams;
  const { activeMemberships, activeOrganization } = resolveActiveOrganization(
    profile,
    query.organizationId
  );
  const actorRole = profile.role as Role;
  const creatableRoles = creatableRolesByRole[actorRole].filter(
    (role) => role !== "SA"
  );
  const actorOrganizationIds = activeMemberships.map(
    (membership) => membership.organization.id
  );
  const prisma = getPrisma();
  const users = activeOrganization
    ? await prisma.user.findMany({
        where: {
          role: {
            in: creatableRoles
          },
          memberships: {
            some: {
              organizationId: activeOrganization.id
            },
            none: {
              organizationId: {
                notIn: actorOrganizationIds
              }
            }
          }
        },
        include: {
          memberships: {
            include: {
              organization: true
            },
            orderBy: {
              organization: {
                name: "asc"
              }
            }
          }
        },
        orderBy: [{ role: "asc" }, { email: "asc" }]
      })
    : [];

  return (
    <div className="grid gap-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">
            {roleLabels[actorRole]}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">
            Organization users
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Create and manage users for the selected organization.
          </p>
        </div>
        {activeOrganization ? (
          <div className="md:min-w-72">
            <OrganizationSwitcher
              activeOrganizationId={activeOrganization.id}
              action="/app/users"
              memberships={activeMemberships}
            />
          </div>
        ) : null}
      </section>

      <StatusBanner params={query} />

      {activeOrganization ? (
        <>
          <section className="rounded-lg border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <UserPlus className="size-4 text-primary" aria-hidden="true" />
              <h2 className="text-base font-semibold">Create user</h2>
            </div>
            <form
              action={createManagedUser}
              className="grid gap-3 lg:grid-cols-[1fr_1fr_170px_1fr_auto]"
            >
              <input
                type="hidden"
                name="organizationIds"
                value={activeOrganization.id}
              />
              <label className="grid gap-2 text-sm font-medium">
                Email
                <Input name="email" type="email" required />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Display name
                <Input name="displayName" required />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Role
                <select
                  name="role"
                  defaultValue={creatableRoles[0]}
                  className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {creatableRoles.map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Password
                <Input
                  name="password"
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  required
                />
              </label>
              <Button type="submit" className="self-end">
                <UserPlus className="size-4" aria-hidden="true" />
                Create
              </Button>
            </form>
          </section>

          <section className="overflow-hidden rounded-lg border bg-card">
            <div className="border-b px-5 py-4">
              <h2 className="text-base font-semibold">
                {activeOrganization.name}
              </h2>
            </div>
            {users.length ? (
              <div className="divide-y">
                {users.map((user) => (
                  <article key={user.id} className="grid gap-4 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Users className="size-4 text-primary" aria-hidden="true" />
                      <h3 className="font-semibold">{user.email}</h3>
                      <StatusPill status={user.status} />
                      <span className="rounded-full border bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        {roleLabels[user.role]}
                      </span>
                    </div>

                    <form
                      action={updateManagedUser}
                      className="grid gap-3 lg:grid-cols-[1fr_170px_170px_auto]"
                    >
                      <input type="hidden" name="userId" value={user.id} />
                      <input
                        type="hidden"
                        name="organizationIds"
                        value={activeOrganization.id}
                      />
                      <label className="grid gap-2 text-sm font-medium">
                        Display name
                        <Input
                          name="displayName"
                          defaultValue={user.displayName}
                          required
                        />
                      </label>
                      <label className="grid gap-2 text-sm font-medium">
                        Role
                        <select
                          name="role"
                          defaultValue={user.role}
                          className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {creatableRoles.map((role) => (
                            <option key={role} value={role}>
                              {roleLabels[role]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-2 text-sm font-medium">
                        Status
                        <select
                          name="status"
                          defaultValue={user.status}
                          className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {statuses.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Button type="submit" variant="outline" className="self-end">
                        <RefreshCw className="size-4" aria-hidden="true" />
                        Save
                      </Button>
                    </form>

                    <form
                      action={resetManagedUserPassword}
                      className="grid gap-3 rounded-md border bg-background p-4 md:grid-cols-[1fr_auto]"
                    >
                      <input type="hidden" name="userId" value={user.id} />
                      <label className="grid gap-2 text-sm font-medium">
                        New password
                        <Input
                          name="password"
                          type="password"
                          minLength={8}
                          autoComplete="new-password"
                          required
                        />
                      </label>
                      <Button type="submit" variant="outline" className="self-end">
                        <KeyRound className="size-4" aria-hidden="true" />
                        Reset password
                      </Button>
                    </form>
                  </article>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <Users className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-3 font-medium">No users in this organization</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create the first user for this organization above.
                </p>
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="rounded-lg border border-dashed bg-card p-8 text-center">
          <Users className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No active memberships assigned</p>
          <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
            Ask an SA to assign this account to an active organization.
          </p>
        </section>
      )}
    </div>
  );
}

function StatusBanner({
  params
}: {
  params: { created?: string; updated?: string; error?: string };
}) {
  if (params.error) {
    return (
      <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        The submitted user data could not be saved.
      </p>
    );
  }

  if (params.created || params.updated) {
    return (
      <p className="rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
        User changes saved.
      </p>
    );
  }

  return null;
}

function StatusPill({ status }: { status: string }) {
  const className =
    status === "ACTIVE"
      ? "border-primary/30 bg-primary/10 text-primary"
      : "border-muted bg-secondary text-muted-foreground";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}>
      {status}
    </span>
  );
}
