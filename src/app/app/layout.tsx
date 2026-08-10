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
  const { activeOrganization } = resolveActiveOrganization(profile);
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
      icon: "dashboard",
      label: "Dashboard"
    },
    {
      href: operationsHref,
      icon: "wrench",
      label: "Operations"
    }
  ];

  if (hasPermission(role, "users.manage.organization")) {
    navItems.push({
      href: usersHref,
      icon: "users",
      label: "Users"
    });
  }

  return (
    <div className="min-h-screen">
      <SidebarNav
        ariaLabel="Application navigation"
        brandHref={dashboardHref}
        items={navItems}
        userLabel={profile.displayName}
        userMeta={roleLabels[role]}
      />
      <div className="min-h-screen lg:pl-[4.75rem]">
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
