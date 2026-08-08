import Link from "next/link";
import { ArrowRight, Building2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPrisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/session";
import {
  createOrganization,
  deleteOrganization,
  updateOrganization
} from "./actions";

type OrganizationsPageProps = {
  searchParams: Promise<{
    created?: string;
    updated?: string;
    error?: string;
  }>;
};

const statusOptions = ["ACTIVE", "SUSPENDED"] as const;

export default async function OrganizationsPage({
  searchParams
}: OrganizationsPageProps) {
  await requirePermission("organizations.manage");
  const prisma = getPrisma();
  const [params, organizations] = await Promise.all([
    searchParams,
    prisma.organization.findMany({
      include: {
        _count: {
          select: {
            assets: true,
            memberships: true
          }
        }
      },
      orderBy: [{ status: "asc" }, { name: "asc" }]
    })
  ]);

  return (
    <div className="grid gap-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Phase 2</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">
            Organizations
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Create tenant organizations, control status, and open each
            organization to manage assets, buildings, floors, and rooms.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm md:min-w-56">
          <Metric label="Organizations" value={organizations.length} />
          <Metric
            label="Active"
            value={organizations.filter((org) => org.status === "ACTIVE").length}
          />
        </div>
      </section>

      <StatusBanner params={params} />

      <section className="rounded-lg border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Plus className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-base font-semibold">Create organization</h2>
        </div>
        <form action={createOrganization} className="grid gap-3 md:grid-cols-[1fr_auto]">
          <label className="grid gap-2 text-sm font-medium">
            Name
            <Input name="name" placeholder="Sathorn Residence" required />
          </label>
          <Button type="submit" className="self-end">
            <Plus className="size-4" aria-hidden="true" />
            Create
          </Button>
        </form>
      </section>

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="border-b px-5 py-4">
          <h2 className="text-base font-semibold">Organization registry</h2>
        </div>
        <div className="divide-y">
          {organizations.length ? (
            organizations.map((organization) => (
              <article key={organization.id} className="grid gap-4 p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">{organization.name}</h3>
                      <StatusPill status={organization.status} />
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {organization._count.assets} assets ·{" "}
                      {organization._count.memberships} members
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/organizations/${organization.id}`}>
                      Open
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  </Button>
                </div>

                <form
                  action={updateOrganization}
                  className="grid gap-3 md:grid-cols-[1fr_180px_auto]"
                >
                  <input
                    type="hidden"
                    name="organizationId"
                    value={organization.id}
                  />
                  <label className="grid gap-2 text-sm font-medium">
                    Name
                    <Input name="name" defaultValue={organization.name} required />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Status
                    <select
                      name="status"
                      defaultValue={organization.status}
                      className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button type="submit" variant="outline" className="self-end">
                    <RefreshCw className="size-4" aria-hidden="true" />
                    Save
                  </Button>
                </form>
                <form action={deleteOrganization}>
                  <input
                    type="hidden"
                    name="organizationId"
                    value={organization.id}
                  />
                  <Button type="submit" variant="destructive" size="sm">
                    <Trash2 className="size-4" aria-hidden="true" />
                    Delete organization
                  </Button>
                </form>
              </article>
            ))
          ) : (
            <div className="p-8 text-center">
              <Building2 className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 font-medium">No organizations yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create the first organization to start building the property
                structure.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function StatusBanner({
  params
}: {
  params: { created?: string; updated?: string; error?: string };
}) {
  if (params.error) {
    return (
      <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        The submitted organization data could not be saved.
      </p>
    );
  }

  if (params.created || params.updated) {
    return (
      <p className="rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
        Organization changes saved.
      </p>
    );
  }

  return null;
}

function StatusPill({ status }: { status: string }) {
  const className =
    status === "ACTIVE"
      ? "border-primary/30 bg-primary/10 text-primary"
      : "border-muted bg-secondary text-muted-foreground";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}>
      {status}
    </span>
  );
}
