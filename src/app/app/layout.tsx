import { LayoutDashboard, Users, Wrench } from "lucide-react";
import { OrganizationSwitcher } from "@/app/app/_components/organization-switcher";
import { SidebarNav, type SidebarNavItem } from "@/components/sidebar-nav";
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
  const navItems: SidebarNavItem[] = [
    {
      href: dashboardHref,
      icon: LayoutDashboard,
      label: "Dashboard"
    },
    {
      href: operationsHref,
      icon: Wrench,
      label: "Operations"
    },
    ...(hasPermission(role, "users.manage.organization")
      ? [
          {
            href: usersHref,
            icon: Users,
            label: "Users"
          }
        ]
      : [])
  ];

  return (
    <div className="min-h-screen">
      <SidebarNav
        ariaLabel="Application navigation"
        brandHref={dashboardHref}
        items={navItems}
        userLabel={profile.displayName}
        userMeta={roleLabels[role]}
      />
      <div className="min-h-screen pl-[4.75rem]">
        <header className="border-b bg-background/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium text-primary">Workspace</p>
              <p className="text-sm text-muted-foreground">
                {activeOrganization
                  ? activeOrganization.name
                  : "No active organization"}
              </p>
            </div>
            {activeOrganization ? (
              <OrganizationSwitcher
                activeOrganizationId={activeOrganization.id}
                action="/app"
                memberships={activeMemberships}
                size="compact"
              />
            ) : null}
          </div>
          {!activeOrganization ? (
            <div className="mx-auto max-w-6xl px-6 pb-4">
              <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                No active organization is assigned to this account.
              </p>
            </div>
          ) : null}
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
