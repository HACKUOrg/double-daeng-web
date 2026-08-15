"use client";

import { useId, useState } from "react";
import { ChevronDown, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

export type AuditLogRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  createdAt: string;
  actor: {
    id: string;
    email: string;
    displayName: string;
    role: string;
  } | null;
  organization: {
    id: string;
    name: string;
    status: string;
  } | null;
};

export function AuditLogRowAccordion({ log }: { log: AuditLogRow }) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const actorLabel = log.actor
    ? `${log.actor.displayName} - ${log.actor.email}`
    : "System or deleted actor";

  return (
    <article>
      <button
        type="button"
        className="group flex min-h-16 w-full min-w-0 items-center justify-between gap-4 px-5 py-4 text-left outline-none transition-colors hover:bg-secondary/50 focus-visible:bg-secondary/50"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label={`${isOpen ? "Collapse" : "Expand"} audit entry ${log.action}`}
      >
        <span className="flex min-w-0 items-center gap-3">
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
              !isOpen && "-rotate-90"
            )}
            aria-hidden="true"
          />
          <ClipboardList className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="truncate font-semibold">{log.action}</span>
              <StatusPill label={log.entityType} />
              {log.organization ? (
                <StatusPill label={log.organization.name} muted />
              ) : null}
            </span>
            <span className="mt-1 block truncate text-sm text-muted-foreground">
              {actorLabel} at {formatDate(log.createdAt)}
            </span>
          </span>
        </span>
        <span className="hidden shrink-0 text-xs font-medium text-muted-foreground sm:block">
          {isOpen ? "Hide details" : "View details"}
        </span>
      </button>
      <div
        id={panelId}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="grid gap-3 border-t bg-background/40 px-5 py-4">
            <p className="break-all font-mono text-xs text-muted-foreground">
              entity_id={log.entityId}
            </p>
            <div className="grid min-w-0 gap-3 lg:grid-cols-2">
              <SnapshotBlock title="Before" value={log.before} />
              <SnapshotBlock title="After" value={log.after} />
            </div>
          </div>
        </div>
      </div>
    </article>
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
      <div className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-2">No snapshot</p>
      </div>
    );
  }

  return (
    <details className="min-w-0 rounded-md border bg-background p-3">
      <summary className="cursor-pointer text-sm font-medium">{title}</summary>
      <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-md bg-secondary p-3 font-mono text-xs text-secondary-foreground">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}
