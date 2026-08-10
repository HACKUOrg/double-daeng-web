import { SidebarNav, type SidebarNavItem } from "@/components/sidebar-nav";
import { requirePermission } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";

export default async function AdminLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await requirePermission("admin.access");
  const role = profile.role;
  const navItems: SidebarNavItem[] = [
    {
      href: "/admin",
      icon: "dashboard",
      label: "Dashboard"
    }
  ];

  if (hasPermission(role, "organizations.manage")) {
    navItems.push({
      href: "/admin/organizations",
      icon: "organizations",
      label: "Organizations"
    });
  }

  if (hasPermission(role, "memberships.manage")) {
    navItems.push({
      href: "/admin/memberships",
      icon: "users",
      label: "Memberships"
    });
  }

  if (hasPermission(role, "users.manage.all")) {
    navItems.push({
      href: "/admin/users",
      icon: "users",
      label: "Users"
    });
  }

  if (hasPermission(role, "iam.view")) {
    navItems.push({
      href: "/admin/iam",
      icon: "iam",
      label: "IAM"
    });
  }

  if (hasPermission(role, "audit.view")) {
    navItems.push({
      href: "/admin/audit",
      icon: "audit",
      label: "Audit"
    });
  }

  return (
    <div className="min-h-screen">
      <SidebarNav
        ariaLabel="Admin navigation"
        brandHref="/admin"
        eyebrow="Admin"
        items={navItems}
        userLabel={profile.displayName}
        userMeta="System admin"
      />
      <div className="min-h-screen lg:pl-[4.75rem]">
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
