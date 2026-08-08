import Link from "next/link";
import {
  Building2,
  ClipboardList,
  DoorOpen,
  Home,
  ShieldCheck,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPrisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";

export default async function AdminPage() {
  const profile = await requirePermission("admin.access");
  const role = profile.role;
  const prisma = getPrisma();
  const [organizationCount, assetCount, roomCount, membershipCount, auditCount] =
    await Promise.all([
    prisma.organization.count(),
    prisma.asset.count(),
    prisma.room.count(),
    prisma.organizationMembership.count(),
    prisma.auditLog.count()
  ]);

  return (
    <div className="grid gap-8">
      <section>
        <p className="text-sm font-medium text-primary">System Admin</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">
          Welcome, {profile.displayName}
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          This shell starts the SA-only area for organizations, users, assets,
          RBAC visibility, and audit logs.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <Metric
          icon={<Building2 className="size-5" aria-hidden="true" />}
          label="Organizations"
          value={organizationCount}
        />
        <Metric
          icon={<Home className="size-5" aria-hidden="true" />}
          label="Assets"
          value={assetCount}
        />
        <Metric
          icon={<DoorOpen className="size-5" aria-hidden="true" />}
          label="Rooms"
          value={roomCount}
        />
        <Metric
          icon={<Users className="size-5" aria-hidden="true" />}
          label="Memberships"
          value={membershipCount}
        />
        <Metric
          icon={<ClipboardList className="size-5" aria-hidden="true" />}
          label="Audit logs"
          value={auditCount}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {hasPermission(role, "iam.view") ? (
          <AdminCard
            href="/admin/iam"
            icon={<ShieldCheck className="size-5" aria-hidden="true" />}
            title="IAM / RBAC"
            description="Read-only role and permission map for the MVP."
          />
        ) : null}
        {hasPermission(role, "organizations.manage") ? (
          <AdminCard
            href="/admin/organizations"
            icon={<Building2 className="size-5" aria-hidden="true" />}
            title="Organizations"
            description="Create organizations and build the asset hierarchy."
          />
        ) : null}
        {hasPermission(role, "memberships.manage") ? (
          <AdminCard
            href="/admin/memberships"
            icon={<Users className="size-5" aria-hidden="true" />}
            title="Memberships"
            description="Assign existing users to organization scopes."
          />
        ) : null}
        {hasPermission(role, "users.manage.all") ? (
          <AdminCard
            href="/admin/users"
            icon={<Users className="size-5" aria-hidden="true" />}
            title="Users"
            description="Create users, assign access, and reset passwords."
          />
        ) : null}
        {hasPermission(role, "audit.view") ? (
          <AdminCard
            href="/admin/audit"
            icon={<ClipboardList className="size-5" aria-hidden="true" />}
            title="Audit Log"
            description="Review recent admin actions and record snapshots."
          />
        ) : null}
      </section>
    </div>
  );
}

function Metric({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-center gap-3 text-muted-foreground">
        {icon}
        <p className="text-sm font-medium">{label}</p>
      </div>
      <p className="mt-4 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function AdminCard({
  href,
  icon,
  title,
  description
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="mb-4 flex size-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
        {icon}
      </div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-2 min-h-12 text-sm text-muted-foreground">
        {description}
      </p>
      <Button asChild variant="outline" size="sm" className="mt-5">
        <Link href={href}>Open</Link>
      </Button>
    </div>
  );
}
