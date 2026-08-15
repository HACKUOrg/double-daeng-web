import Link from "next/link";
import { ClipboardList, ChevronLeft, ChevronRight } from "lucide-react";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { getPrisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { AuditFilterPanel } from "./audit-filter-panel";
import {
  AuditLogRowAccordion,
  type AuditLogRow
} from "./audit-log-row-accordion";

type AuditPageProps = {
  searchParams: Promise<{
    action?: string;
    actorUserId?: string;
    entityType?: string;
    organizationId?: string;
    q?: string;
    page?: string;
    limit?: string;
  }>;
};

const uuidSchema = z.string().uuid();
const textFilterSchema = z.string().trim().max(120);
const pageSchema = z.coerce.number().int().min(1).catch(1);
const limitValues = [10, 25, 50] as const;
const defaultLimit = 10;

export default async function AuditPage({ searchParams }: AuditPageProps) {
  await requirePermission("audit.view");
  const params = await parseFilters(await searchParams);
  const prisma = getPrisma();
  const where = buildAuditWhere(params);
  const [totalCount, actionsAndEntities, organizations, actors] =
    await Promise.all([
      prisma.auditLog.count({ where }),
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

  const totalPages = Math.max(1, Math.ceil(totalCount / params.limit));
  const currentPage = Math.min(params.page, totalPages);
  const auditLogs = await prisma.auditLog.findMany({
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
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (currentPage - 1) * params.limit,
    take: params.limit
  });

  const actions = [...new Set(actionsAndEntities.map((item) => item.action))];
  const entityTypes = [
    ...new Set(actionsAndEntities.map((item) => item.entityType))
  ];
  const activeFilterCount = [
    params.action,
    params.actorUserId,
    params.entityType,
    params.organizationId,
    params.q
  ].filter(Boolean).length;

  const rows: AuditLogRow[] = auditLogs.map((log) => ({
    id: log.id,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    before: log.before,
    after: log.after,
    createdAt: log.createdAt.toISOString(),
    actor: log.actor,
    organization: log.organization
  }));

  return (
    <div className="grid min-w-0 gap-6">
      <section className="grid gap-3">
        <p className="text-sm font-medium text-primary">Phase 6</p>
        <h1 className="text-3xl font-semibold tracking-normal">Audit log</h1>
        <p className="max-w-2xl text-muted-foreground">
          Review the latest system changes, actors, organization scope, and
          before/after snapshots.
        </p>
      </section>

      <section className="min-w-0 overflow-hidden rounded-lg border bg-card">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b px-5 py-4">
          <div className="flex min-w-0 items-center gap-2">
            <ClipboardList className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <h2 className="text-base font-semibold">Recent activity</h2>
          </div>
          <AuditFilterPanel
            actionOptions={actions}
            actorOptions={actors}
            entityOptions={entityTypes}
            organizationOptions={organizations}
            values={params}
            activeFilterCount={activeFilterCount}
            initialOpen={activeFilterCount > 0}
            limit={params.limit}
          />
        </div>

        {rows.length ? (
          <div className="divide-y">
            {rows.map((row) => (
              <AuditLogRowAccordion key={row.id} log={row} />
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

        <AuditPagination
          page={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          limit={params.limit}
          filters={params}
        />
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
    q: textFilterSchema.safeParse(raw.q ?? "").data ?? "",
    page: pageSchema.parse(raw.page ?? "1"),
    limit: parseLimit(raw.limit)
  };
}

function parseLimit(value?: string) {
  const parsed = Number(value ?? defaultLimit);
  return limitValues.includes(parsed as (typeof limitValues)[number])
    ? parsed
    : defaultLimit;
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

function AuditPagination({
  page,
  totalPages,
  totalCount,
  limit,
  filters
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  filters: Awaited<ReturnType<typeof parseFilters>>;
}) {
  const firstItem = totalCount ? (page - 1) * limit + 1 : 0;
  const lastItem = Math.min(page * limit, totalCount);
  const hrefForPage = (nextPage: number) => {
    const query = new URLSearchParams();
    query.set("page", String(nextPage));
    query.set("limit", String(limit));
    appendFilters(query, filters);
    return `/admin/audit?${query.toString()}`;
  };
  const hrefForLimit = (nextLimit: number) => {
    const query = new URLSearchParams();
    query.set("page", "1");
    query.set("limit", String(nextLimit));
    appendFilters(query, filters);
    return `/admin/audit?${query.toString()}`;
  };

  return (
    <div className="flex flex-col gap-3 border-t px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground">
        Showing {firstItem}–{lastItem} of {totalCount}
      </p>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <div className="flex items-center gap-1.5" aria-label="Rows per page">
          <span className="hidden text-muted-foreground sm:inline">Rows</span>
          {limitValues.map((value) => (
            <Link
              key={value}
              href={hrefForLimit(value)}
              aria-current={value === limit ? "page" : undefined}
              className={cn(
                "inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs font-medium transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                value === limit && "border-primary/40 bg-primary/10 text-primary"
              )}
            >
              {value}
            </Link>
          ))}
        </div>
        <span className="whitespace-nowrap text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <div className="flex items-center gap-2">
          <PaginationLink
            href={hrefForPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            label="Previous page"
            icon={<ChevronLeft className="size-4" aria-hidden="true" />}
          />
          <PaginationLink
            href={hrefForPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            label="Next page"
            icon={<ChevronRight className="size-4" aria-hidden="true" />}
          />
        </div>
      </div>
    </div>
  );
}

function PaginationLink({
  href,
  disabled,
  label,
  icon
}: {
  href: string;
  disabled: boolean;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : undefined}
      className={cn(
        "inline-flex size-10 items-center justify-center rounded-md border bg-background transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        disabled && "pointer-events-none opacity-40"
      )}
    >
      {icon}
    </Link>
  );
}

function appendFilters(
  query: URLSearchParams,
  filters: Awaited<ReturnType<typeof parseFilters>>
) {
  if (filters.action) query.set("action", filters.action);
  if (filters.actorUserId) query.set("actorUserId", filters.actorUserId);
  if (filters.entityType) query.set("entityType", filters.entityType);
  if (filters.organizationId) query.set("organizationId", filters.organizationId);
  if (filters.q) query.set("q", filters.q);
}
