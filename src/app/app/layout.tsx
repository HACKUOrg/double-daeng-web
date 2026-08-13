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
  const navItems: SidebarNavItem[] = [
    {
      href: "/app",
      icon: "dashboard",
      label: "Dashboard"
    },
    {
      href: "/app/rooms",
      icon: "bed",
      label: "Rooms"
    }
  ];

  if (hasPermission(role, "customers.manage") || hasPermission(role, "rooms.manage")) {
    navItems.push(
      {
        group: "Operations",
        href: "/app/operations/move-in",
        icon: "logIn",
        label: "Move-in"
      },
      {
        group: "Operations",
        href: "/app/operations/move-out",
        icon: "logOut",
        label: "Move-out"
      },
      {
        group: "Operations",
        href: "/app/operations/reserve-room",
        icon: "calendarCheck",
        label: "Reserve room"
      },
      {
        group: "Operations",
        href: "/app/operations/monthly-invoice",
        icon: "receipt",
        label: "Monthly invoice"
      }
    );
  }

  if (
    hasPermission(role, "room_status.update") ||
    hasPermission(role, "rooms.manage")
  ) {
    navItems.push({
      group: "Operations",
      href: "/app/operations/meter-reading",
      icon: "gauge",
      label: "Meter reading"
    });
  }

  if (hasPermission(role, "rooms.manage")) {
    navItems.push({
      group: "Operations",
      href: "/app/operations/mark-unavailable",
      icon: "calendarX",
      label: "Mark unavailable"
    });
  }

  if (
    hasPermission(role, "maintenance.manage") ||
    hasPermission(role, "maintenance.create")
  ) {
    navItems.push({
      group: "Operations",
      href: "/app/operations/maintenance",
      icon: "lifeBuoy",
      label: "Maintenance"
    });
  }

  if (hasPermission(role, "users.manage.organization")) {
    navItems.push({
      group: "Admin",
      href: "/app/users",
      icon: "users",
      label: "Users"
    });
  }

  return (
    <div className="min-h-screen">
      <SidebarNav
        ariaLabel="Application navigation"
        brandHref="/app"
        items={navItems}
        organization={
          activeOrganization
            ? {
                activeOrganizationId: activeOrganization.id,
                memberships: activeMemberships
              }
            : undefined
        }
        userLabel={profile.displayName}
        userMeta={roleLabels[role]}
      />
      <div className="min-h-screen lg:pl-[4.75rem]">
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
