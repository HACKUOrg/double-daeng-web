import Link from "next/link";
import { ArrowLeft, ExternalLink, Link2, UserRound } from "lucide-react";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getPrisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/session";
import { roleLabels } from "@/lib/rbac";
import { updateAdminManagedUser } from "@/app/users/actions";
import { ManagedUserForm } from "../_components/managed-user-form";
import { UserStatusBanner, UserStatusPill } from "../_components/user-ui";

type UserDetailPageProps = {
  params: Promise<{
    userId: string;
  }>;
  searchParams: Promise<{
    created?: string;
    updated?: string;
    error?: string;
  }>;
};

export default async function UserDetailPage({
  params,
  searchParams
}: UserDetailPageProps) {
  await requirePermission("users.manage.all");
  const [{ userId }, query] = await Promise.all([params, searchParams]);
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
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
    }
  });

  if (!user || user.role === "SA" || user.role === "RESIDENT") {
    notFound();
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-4">
        <Button asChild variant="ghost" size="sm" className="w-fit px-2">
          <Link href="/admin/users">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to users
          </Link>
        </Button>
        <div>
          <p className="text-sm font-medium text-primary">Users</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-normal">
              {user.displayName}
            </h1>
            <UserStatusPill status={user.status} />
          </div>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Update this profile and password. Organization access is managed in
            memberships.
          </p>
        </div>
      </section>

      <UserStatusBanner params={query} />

      <section className="rounded-lg border bg-card p-5">
        <div className="mb-5 flex items-center gap-2">
          <UserRound className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-base font-semibold">User details</h2>
          <span className="rounded-full border bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {roleLabels[user.role]}
          </span>
        </div>
        <ManagedUserForm
          mode="edit"
          action={updateAdminManagedUser}
          user={{
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
            status: user.status
          }}
        />
      </section>

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Link2 className="size-4 text-primary" aria-hidden="true" />
            <h2 className="text-base font-semibold">Organization memberships</h2>
            <span className="rounded-full border bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {user.memberships.length} memberships
            </span>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/memberships">
              <ExternalLink className="size-4" aria-hidden="true" />
              Manage memberships
            </Link>
          </Button>
        </div>
        {user.memberships.length ? (
          <div className="divide-y">
            {user.memberships.map((membership) => (
              <div
                key={membership.id}
                className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {membership.organization.name}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Organization status: {membership.organization.status}
                  </p>
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  Read-only here
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <Link2 className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-medium">No memberships assigned</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Use Manage memberships to assign organization access.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
