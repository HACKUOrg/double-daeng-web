import Link from "next/link";
import {
  Building2,
  LayoutDashboard,
  Wrench,
  UserCircle,
  Users
} from "lucide-react";
import { OrganizationSwitcher } from "@/app/app/_components/organization-switcher";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { resolveActiveOrganization } from "@/lib/auth/organization-scope";
import { requirePermission } from "@/lib/auth/session";
import { hasPermission, roleLabels, type Role } from "@/lib/rbac";

export default async function AppLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await requirePermission("app.access");
  const role = profile.role as Role;
  const { activeMemberships, activeOrganization } =
    resolveActiveOrganization(profile);
  const dashboardHref = activeOrganization
    ? `/app?organizationId=${activeOrganization.id}`
    : "/app";
  const usersHref = activeOrganization
    ? `/app/users?organizationId=${activeOrganization.id}`
    : "/app/users";
  const operationsHref = activeOrganization
    ? `/app/operations?organizationId=${activeOrganization.id}`
    : "/app/operations";

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto grid max-w-6xl gap-3 px-6 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Link
              href={dashboardHref}
              className="flex items-center gap-3 font-semibold"
            >
              <Building2 className="size-5 text-primary" aria-hidden="true" />
              double-daeng-web
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              {activeOrganization ? (
                <OrganizationSwitcher
                  activeOrganizationId={activeOrganization.id}
                  action="/app"
                  memberships={activeMemberships}
                  size="compact"
                />
              ) : null}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <UserCircle className="size-4" aria-hidden="true" />
                <span>{profile.displayName}</span>
                <span className="rounded-full border bg-secondary px-2 py-0.5 text-xs">
                  {roleLabels[role]}
                </span>
              </div>
              <form action={signOut}>
                <Button type="submit" variant="outline" size="sm">
                  Sign out
                </Button>
              </form>
            </div>
          </div>
          <nav className="flex flex-wrap gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href={dashboardHref}>
                <LayoutDashboard className="size-4" aria-hidden="true" />
                Dashboard
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href={operationsHref}>
                <Wrench className="size-4" aria-hidden="true" />
                Operations
              </Link>
            </Button>
            {hasPermission(role, "users.manage.organization") ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={usersHref}>
                  <Users className="size-4" aria-hidden="true" />
                  Users
                </Link>
              </Button>
            ) : null}
          </nav>
          {!activeOrganization ? (
            <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
              No active organization is assigned to this account.
            </p>
          ) : null}
          </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
