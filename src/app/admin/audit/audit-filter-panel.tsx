"use client";

import { Filter, Search, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type FilterValues = {
  action: string;
  actorUserId: string;
  entityType: string;
  organizationId: string;
  q: string;
};

export function AuditFilterPanel({
  actionOptions,
  actorOptions,
  entityOptions,
  organizationOptions,
  values,
  activeFilterCount,
  initialOpen,
  limit
}: {
  actionOptions: string[];
  actorOptions: Array<{ id: string; email: string; role: string }>;
  entityOptions: string[];
  organizationOptions: Array<{ id: string; name: string; status: string }>;
  values: FilterValues;
  activeFilterCount: number;
  initialOpen: boolean;
  limit: number;
}) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const panelId = "audit-filter-panel";
  const clearHref = limit === 10 ? "/admin/audit" : `/admin/audit?limit=${limit}`;

  return (
    <div className="contents">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((open) => !open)}
      >
        <Filter className="size-4" aria-hidden="true" />
        Filter
        {activeFilterCount ? (
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
            {activeFilterCount}
          </span>
        ) : null}
      </Button>
      <div
        id={panelId}
        className={cn(
          "col-span-2 grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mt-4 border-t pt-4">
            <form
              action="/admin/audit"
              method="get"
              className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4"
            >
              <input type="hidden" name="page" value="1" />
              <input type="hidden" name="limit" value={limit} />
              <label className="grid min-w-0 gap-1.5 text-xs font-medium sm:col-span-2 xl:col-span-2">
                Search
                <Input
                  name="q"
                  defaultValue={values.q}
                  placeholder="user.update or email"
                  className="h-9"
                />
              </label>
              <FilterSelect
                label="Action"
                name="action"
                value={values.action}
                options={actionOptions}
                emptyLabel="All actions"
              />
              <FilterSelect
                label="Entity"
                name="entityType"
                value={values.entityType}
                options={entityOptions}
                emptyLabel="All entities"
              />
              <FilterSelect
                label="Organization"
                name="organizationId"
                value={values.organizationId}
                options={organizationOptions.map((organization) => ({
                  value: organization.id,
                  label: `${organization.name} - ${organization.status}`
                }))}
                emptyLabel="All organizations"
              />
              <FilterSelect
                label="Actor"
                name="actorUserId"
                value={values.actorUserId}
                options={actorOptions.map((actor) => ({
                  value: actor.id,
                  label: `${actor.email} - ${actor.role}`
                }))}
                emptyLabel="All actors"
              />
              <div className="flex items-end gap-2 sm:col-span-2 xl:col-span-4">
                <Button type="submit" size="sm">
                  <Search className="size-4" aria-hidden="true" />
                  Apply
                </Button>
                <Button asChild type="button" size="sm" variant="ghost">
                  <Link href={clearHref}>
                    <X className="size-4" aria-hidden="true" />
                    Clear
                  </Link>
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  name,
  value,
  options,
  emptyLabel
}: {
  label: string;
  name: string;
  value: string;
  options: string[] | Array<{ value: string; label: string }>;
  emptyLabel: string;
}) {
  return (
    <label className="grid min-w-0 gap-1.5 text-xs font-medium">
      {label}
      <select
        name={name}
        defaultValue={value}
        className="h-9 min-w-0 rounded-md border bg-background px-2.5 text-sm outline-none transition-colors hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => {
          const normalized =
            typeof option === "string"
              ? { value: option, label: option }
              : option;
          return (
            <option key={normalized.value} value={normalized.value}>
              {normalized.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}
