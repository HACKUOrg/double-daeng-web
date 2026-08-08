import Link from "next/link";
import { Building2, ClipboardList, Shield, ShieldCheck, Users } from "lucide-react";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";

export default async function AdminLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await requirePermission("admin.access");
  const role = profile.role;

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <Link href="/admin" className="flex items-center gap-3 font-semibold">
            <Shield className="size-5 text-primary" aria-hidden="true" />
            double-daeng-web Admin
          </Link>
          <nav className="flex flex-wrap items-center gap-2 text-sm">
            {hasPermission(role, "organizations.manage") ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/organizations">
                  <Building2 className="size-4" aria-hidden="true" />
                  Organizations
                </Link>
              </Button>
            ) : null}
            {hasPermission(role, "memberships.manage") ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/memberships">
                  <Users className="size-4" aria-hidden="true" />
                  Memberships
                </Link>
              </Button>
            ) : null}
            {hasPermission(role, "users.manage.all") ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/users">
                  <Users className="size-4" aria-hidden="true" />
                  Users
                </Link>
              </Button>
            ) : null}
            {hasPermission(role, "iam.view") ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/iam">
                  <ShieldCheck className="size-4" aria-hidden="true" />
                  IAM
                </Link>
              </Button>
            ) : null}
            {hasPermission(role, "audit.view") ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/audit">
                  <ClipboardList className="size-4" aria-hidden="true" />
                  Audit
                </Link>
              </Button>
            ) : null}
          </nav>
          <div className="flex items-center gap-4 lg:justify-end">
            <span className="text-sm text-muted-foreground">
              {profile.displayName}
            </span>
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
