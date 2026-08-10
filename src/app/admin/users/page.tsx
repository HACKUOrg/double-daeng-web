import { KeyRound, RefreshCw, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPrisma } from "@/lib/prisma";
import { roleLabels } from "@/lib/rbac";
import { requirePermission } from "@/lib/auth/session";
import {
  createManagedUser,
  resetManagedUserPassword,
  updateManagedUser
} from "@/app/users/actions";

type UsersPageProps = {
  searchParams: Promise<{
    created?: string;
    updated?: string;
    error?: string;
  }>;
};

const creatableRoles = ["MANAGER", "OPERATION"] as const;
const statuses = ["ACTIVE", "SUSPENDED"] as const;

export default async function UsersPage({ searchParams }: UsersPageProps) {
  await requirePermission("users.manage.all");
  const prisma = getPrisma();
  const [params, users, organizations] = await Promise.all([
    searchParams,
    prisma.user.findMany({
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
    }),
    prisma.organization.findMany({
      where: {
        status: "ACTIVE"
      },
      orderBy: {
        name: "asc"
      }
    })
  ]);
  const managedUsers = users.filter(
    (user) => user.role !== "SA" && user.role !== "RESIDENT"
  );

  return (
    <div className="grid gap-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Phase 4</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">
            Users
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Create users directly, assign organization access, update status,
            and reset passwords from the admin area.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm md:min-w-56">
          <Metric label="Managed users" value={managedUsers.length} />
          <Metric label="Active orgs" value={organizations.length} />
        </div>
      </section>

      <StatusBanner params={params} />

      <section className="rounded-lg border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <UserPlus className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-base font-semibold">Create user</h2>
        </div>
        {organizations.length ? (
          <form
            action={createManagedUser}
            className="grid gap-3 lg:grid-cols-[1fr_1fr_170px_1fr_1fr_auto]"
          >
            <label className="grid gap-2 text-sm font-medium">
              Email
              <Input name="email" type="email" placeholder="manager@example.com" required />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Display name
              <Input name="displayName" placeholder="Building Manager" required />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Role
              <select
                name="role"
                defaultValue="MANAGER"
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
              Organizations
              <select
                name="organizationIds"
                multiple
                required
                className="min-h-10 rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
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
        ) : (
          <p className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
            Create an active organization before creating users.
          </p>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="border-b px-5 py-4">
          <h2 className="text-base font-semibold">User registry</h2>
        </div>
        {managedUsers.length ? (
          <div className="divide-y">
            {managedUsers.map((user) => (
                <article key={user.id} className="grid gap-4 p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Users className="size-4 text-primary" aria-hidden="true" />
                        <h3 className="font-semibold">{user.email}</h3>
                        <StatusPill status={user.status} />
                        <span className="rounded-full border bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                          {roleLabels[user.role]}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {user.displayName} - {user.memberships.length} organizations
                      </p>
                    </div>
                  </div>

                  <form
                    action={updateManagedUser}
                    className="grid gap-3 lg:grid-cols-[1fr_170px_170px_1fr_auto]"
                  >
                    <input type="hidden" name="userId" value={user.id} />
                    <label className="grid gap-2 text-sm font-medium">
                      Display name
                      <Input name="displayName" defaultValue={user.displayName} required />
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
                    <label className="grid gap-2 text-sm font-medium">
                      Organizations
                      <select
                        name="organizationIds"
                        multiple
                        required
                        defaultValue={user.memberships.map(
                          (membership) => membership.organizationId
                        )}
                        className="min-h-10 rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {organizations.map((organization) => (
                          <option
                            key={organization.id}
                            value={organization.id}
                          >
                            {organization.name}
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
            <p className="mt-3 font-medium">No managed users yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create the first Manager or Operation user above.
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
