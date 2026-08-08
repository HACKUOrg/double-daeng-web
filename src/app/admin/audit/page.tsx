import Link from "next/link";
import { ClipboardList, Filter, RefreshCw, Search, X } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requirePermission } from "@/lib/auth/session";
import { getPrisma } from "@/lib/prisma";

type AuditPageProps = {
  searchParams: Promise<{
    action?: string;
    actorUserId?: string;
    entityType?: string;
    organizationId?: string;
    q?: string;
  }>;
};

const uuidSchema = z.string().uuid();
const textFilterSchema = z.string().trim().max(120);
const pageSize = 50;

export default async function AuditPage({ searchParams }: AuditPageProps) {
  await requirePermission("audit.view");
  const params = await parseFilters(await searchParams);
  const prisma = getPrisma();
  const where = buildAuditWhere(params);
  const [auditLogs, actionsAndEntities, organizations, actors] =
    await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: {
              id: true,
              email: true,
              displayName: true,
              role: true
            }
          },
          organization: {
            select: {
              id: true,
              name: true,
              status: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        take: pageSize
      }),
      prisma.auditLog.findMany({
        select: {
          action: true,
          entityType: true
        },
        distinct: ["action", "entityType"],
        orderBy: [{ action: "asc" }, { entityType: "asc" }]
      }),
      prisma.organization.findMany({
        select: {
          id: true,
          name: true,
          status: true
        },
        orderBy: [{ status: "asc" }, { name: "asc" }]
      }),
      prisma.user.findMany({
        where: {
          auditLogs: {
            some: {}
          }
        },
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true
        },
        orderBy: [{ role: "asc" }, { email: "asc" }]
      })
    ]);
  const actions = [...new Set(actionsAndEntities.map((item) => item.action))];
  const entityTypes = [
    ...new Set(actionsAndEntities.map((item) => item.entityType))
  ];

  return (
    <div className="grid gap-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Phase 6</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">
            Audit log
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Review the latest system changes, actors, organization scope, and
            before/after snapshots.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm md:min-w-56">
          <Metric label="Showing" value={auditLogs.length} />
          <Metric label="Limit" value={pageSize} />
        </div>
      </section>

      <section className="rounded-lg border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Filter className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-base font-semibold">Filters</h2>
        </div>
        <form
          action="/admin/audit"
          className="grid gap-3 lg:grid-cols-[1fr_170px_170px_1fr_1fr_auto_auto]"
        >
          <label className="grid gap-2 text-sm font-medium">
            Search
            <Input
              name="q"
              defaultValue={params.q}
              placeholder="user.update or email"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Action
            <select
              name="action"
              defaultValue={params.action}
              className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">All actions</option>
              {actions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Entity
            <select
              name="entityType"
              defaultValue={params.entityType}
              className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">All entities</option>
              {entityTypes.map((entityType) => (
                <option key={entityType} value={entityType}>
                  {entityType}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Organization
            <select
              name="organizationId"
              defaultValue={params.organizationId}
              className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">All organizations</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name} - {organization.status}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Actor
            <select
              name="actorUserId"
              defaultValue={params.actorUserId}
              className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">All actors</option>
              {actors.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.email} - {actor.role}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" className="self-end">
            <Search className="size-4" aria-hidden="true" />
            Apply
          </Button>
          <Button asChild type="button" variant="outline" className="self-end">
            <Link href="/admin/audit">
              <X className="size-4" aria-hidden="true" />
              Clear
            </Link>
          </Button>
        </form>
      </section>

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-base font-semibold">Recent activity</h2>
          <RefreshCw className="size-4 text-muted-foreground" aria-hidden="true" />
        </div>
        {auditLogs.length ? (
          <div className="divide-y">
            {auditLogs.map((log) => (
              <article key={log.id} className="grid gap-4 p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <ClipboardList
                        className="size-4 text-primary"
                        aria-hidden="true"
                      />
                      <h3 className="font-semibold">{log.action}</h3>
                      <StatusPill label={log.entityType} />
                      {log.organization ? (
                        <StatusPill label={log.organization.name} muted />
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {log.actor
                        ? `${log.actor.displayName} - ${log.actor.email}`
                        : "System or deleted actor"}{" "}
                      at {formatDate(log.createdAt)}
                    </p>
                    <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                      entity_id={log.entityId}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <SnapshotBlock title="Before" value={log.before} />
                  <SnapshotBlock title="After" value={log.after} />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <ClipboardList className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-medium">No audit logs found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Adjust filters or create/update a managed record to generate
              audit activity.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

async function parseFilters(raw: Awaited<AuditPageProps["searchParams"]>) {
  return {
    action: textFilterSchema.safeParse(raw.action ?? "").data ?? "",
    actorUserId: parseUuidFilter(raw.actorUserId),
    entityType: textFilterSchema.safeParse(raw.entityType ?? "").data ?? "",
    organizationId: parseUuidFilter(raw.organizationId),
    q: textFilterSchema.safeParse(raw.q ?? "").data ?? ""
  };
}

function parseUuidFilter(value?: string) {
  if (!value) {
    return "";
  }

  const parsed = uuidSchema.safeParse(value);
  return parsed.success ? parsed.data : "";
}

function buildAuditWhere(filters: Awaited<ReturnType<typeof parseFilters>>) {
  return {
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.actorUserId ? { actorUserId: filters.actorUserId } : {}),
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(filters.organizationId
      ? { organizationId: filters.organizationId }
      : {}),
    ...(filters.q
      ? {
          OR: [
            {
              action: {
                contains: filters.q,
                mode: "insensitive" as const
              }
            },
            {
              entityType: {
                contains: filters.q,
                mode: "insensitive" as const
              }
            },
            {
              actor: {
                is: {
                  email: {
                    contains: filters.q,
                    mode: "insensitive" as const
                  }
                }
              }
            },
            {
              actor: {
                is: {
                  displayName: {
                    contains: filters.q,
                    mode: "insensitive" as const
                  }
                }
              }
            }
          ]
        }
      : {})
  };
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function StatusPill({ label, muted }: { label: string; muted?: boolean }) {
  const className = muted
    ? "border-muted bg-secondary text-muted-foreground"
    : "border-primary/30 bg-primary/10 text-primary";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function SnapshotBlock({ title, value }: { title: string; value: unknown }) {
  if (!value) {
    return (
      <div className="rounded-md border bg-background p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-2">No snapshot</p>
      </div>
    );
  }

  return (
    <details className="rounded-md border bg-background p-4">
      <summary className="cursor-pointer text-sm font-medium">{title}</summary>
      <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md bg-secondary p-3 font-mono text-xs text-secondary-foreground">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function formatDate(date: Date) {
  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}
