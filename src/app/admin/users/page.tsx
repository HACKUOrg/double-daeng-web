import Link from "next/link";
import { ArrowRight, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPrisma } from "@/lib/prisma";
import { roleLabels } from "@/lib/rbac";
import { requirePermission } from "@/lib/auth/session";
import { UserStatusBanner, UserStatusPill } from "./_components/user-ui";

type UsersPageProps = {
  searchParams: Promise<{
    created?: string;
    updated?: string;
    error?: string;
  }>;
};

export default async function UsersPage({ searchParams }: UsersPageProps) {
  await requirePermission("users.manage.all");
  const prisma = getPrisma();
  const [params, managedUsers] = await Promise.all([
    searchParams,
    prisma.user.findMany({
      where: {
        role: {
          in: ["MANAGER", "OPERATION"]
        }
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        status: true,
        _count: {
          select: {
            memberships: true
          }
        }
      },
      orderBy: [{ role: "asc" }, { email: "asc" }]
    })
  ]);

  return (
    <div className="grid gap-6">
      <section className="grid gap-3">
        <p className="text-sm font-medium text-primary">Phase 4</p>
        <h1 className="text-3xl font-semibold tracking-normal">Users</h1>
        <p className="max-w-2xl text-muted-foreground">
          Browse managed users and open a profile to update access credentials.
          Organization access is managed separately through memberships.
        </p>
      </section>

      <UserStatusBanner params={params} />

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-col gap-3 border-b px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">User registry</h2>
            <span className="rounded-full border bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {managedUsers.length} users
            </span>
          </div>
          <Button asChild size="sm">
            <Link href="/admin/users/new">
              <Plus className="size-4" aria-hidden="true" />
              Create
            </Link>
          </Button>
        </div>

        {managedUsers.length ? (
          <div className="grid gap-3 p-4">
            {managedUsers.map((user) => (
              <Link
                key={user.id}
                href={`/admin/users/${user.id}`}
                className="group block rounded-lg border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <article className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Users className="size-5 text-primary" aria-hidden="true" />
                      <h3 className="truncate text-lg font-semibold">
                        {user.email}
                      </h3>
                      <UserStatusPill status={user.status} />
                      <span className="rounded-full border bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        {roleLabels[user.role]}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {user.displayName} / {user._count.memberships} memberships
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-primary transition-transform group-hover:translate-x-1">
                    Open
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </span>
                </article>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <Users className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-medium">No managed users yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create the first Manager or Operation user.
            </p>
            <Button asChild className="mt-4">
              <Link href="/admin/users/new">
                <Plus className="size-4" aria-hidden="true" />
                Create
              </Link>
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
