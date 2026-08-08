import { Building2, ClipboardList, ShieldCheck, Users } from "lucide-react";
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
    ...(hasPermission(role, "organizations.manage")
      ? [
          {
            href: "/admin/organizations",
            icon: Building2,
            label: "Organizations"
          }
        ]
      : []),
    ...(hasPermission(role, "memberships.manage")
      ? [
          {
            href: "/admin/memberships",
            icon: Users,
            label: "Memberships"
          }
        ]
      : []),
    ...(hasPermission(role, "users.manage.all")
      ? [
          {
            href: "/admin/users",
            icon: Users,
            label: "Users"
          }
        ]
      : []),
    ...(hasPermission(role, "iam.view")
      ? [
          {
            href: "/admin/iam",
            icon: ShieldCheck,
            label: "IAM"
          }
        ]
      : []),
    ...(hasPermission(role, "audit.view")
      ? [
          {
            href: "/admin/audit",
            icon: ClipboardList,
            label: "Audit"
          }
        ]
      : [])
  ];

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
      <div className="min-h-screen pl-[4.75rem]">
        <header className="border-b bg-background/80 backdrop-blur">
          <div className="mx-auto max-w-6xl px-6 py-4">
            <p className="text-sm font-medium text-primary">System Admin</p>
            <p className="text-sm text-muted-foreground">
              Manage organizations, memberships, access, and audit activity.
            </p>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
