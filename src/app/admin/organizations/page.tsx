import Link from "next/link";
import { ArrowRight, Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPrisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/session";

type OrganizationsPageProps = {
  searchParams: Promise<{
    created?: string;
    updated?: string;
    deleted?: string;
    error?: string;
  }>;
};

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
      <section className="grid gap-3">
        <p className="text-sm font-medium text-primary">Admin</p>
        <h1 className="text-3xl font-semibold tracking-normal">
          Organizations
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Browse tenant organizations and open one to manage its property
          structure.
        </p>
      </section>

      <StatusBanner params={params} />

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-col gap-3 border-b px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">Organization registry</h2>
            <span className="rounded-full border bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {organizations.length} Organizations
            </span>
          </div>
          <Button asChild size="sm">
            <Link href="/admin/organizations/new">
              <Plus className="size-4" aria-hidden="true" />
              Create
            </Link>
          </Button>
        </div>

        {organizations.length ? (
          <div className="grid gap-3 p-4">
            {organizations.map((organization) => (
              <Link
                key={organization.id}
                href={`/admin/organizations/${organization.id}`}
                className="group block rounded-lg border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <article className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Building2
                        className="size-5 text-primary"
                        aria-hidden="true"
                      />
                      <h3 className="truncate text-lg font-semibold">
                        {organization.name}
                      </h3>
                      <StatusPill status={organization.status} />
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {organization._count.assets} assets /{" "}
                      {organization._count.memberships} members
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-transform group-hover:translate-x-1">
                    Open
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </span>
                </article>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <Building2 className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-medium">No organizations yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create the first organization to start building the property
              structure.
            </p>
            <Button asChild className="mt-4">
              <Link href="/admin/organizations/new">
                <Plus className="size-4" aria-hidden="true" />
                Create
              </Link>
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

function StatusBanner({
  params
}: {
  params: {
    created?: string;
    updated?: string;
    deleted?: string;
    error?: string;
  };
}) {
  if (params.error) {
    return (
      <p
        className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        role="alert"
      >
        The submitted organization data could not be saved.
      </p>
    );
  }

  if (params.created || params.updated || params.deleted) {
    return (
      <p
        className="rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary"
        role="status"
      >
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
