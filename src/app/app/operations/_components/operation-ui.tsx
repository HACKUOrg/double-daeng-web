import Link from "next/link";
import { Building2, ClipboardList, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const invoiceStatuses = [
  "DRAFT",
  "ISSUED",
  "PAID",
  "OVERDUE",
  "CANCELLED"
] as const;
export const maintenancePriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const maintenanceStatuses = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CANCELLED"
] as const;

export function ModuleHeader({
  actions,
  description,
  eyebrow = "Operations",
  title
}: {
  actions?: React.ReactNode;
  description: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-sm font-medium text-primary">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">{title}</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">{description}</p>
      </div>
      {actions}
    </section>
  );
}

export function StatusBanner({
  error,
  updated
}: {
  error?: string;
  updated?: string;
}) {
  if (error) {
    return (
      <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        The submitted operation could not be saved.
      </p>
    );
  }

  if (updated) {
    return (
      <p className="rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
        Operation saved.
      </p>
    );
  }

  return null;
}

export function NoOrganizationState({
  description = "Ask an SA to assign this account to an active organization before using app modules.",
  title = "No active memberships assigned"
}: {
  description?: string;
  title?: string;
}) {
  return (
    <section className="rounded-lg border border-dashed bg-card p-8 text-center">
      <Building2 className="mx-auto size-8 text-muted-foreground" />
      <p className="mt-3 font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
        {description}
      </p>
    </section>
  );
}

export function AccessDeniedState({
  description = "This module is hidden from your role and its server actions still require the matching permission.",
  title = "This module is not available"
}: {
  description?: string;
  title?: string;
}) {
  return (
    <section className="rounded-lg border border-dashed bg-card p-8 text-center">
      <LockKeyhole className="mx-auto size-8 text-muted-foreground" />
      <p className="mt-3 font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
        {description}
      </p>
    </section>
  );
}

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="py-8 text-center text-sm text-muted-foreground">
      <ClipboardList className="mx-auto mb-3 size-7" aria-hidden="true" />
      {label}
    </div>
  );
}

export function Panel({
  children,
  description,
  icon,
  title
}: {
  children: React.ReactNode;
  description: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="flex items-center gap-3 text-primary">
        {icon}
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function ListPanel({
  children,
  icon,
  title
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center gap-3 border-b px-5 py-4 text-primary">
        {icon}
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      </div>
      <div className="px-5">{children}</div>
    </section>
  );
}

export function Metric({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
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

export function HiddenOperationFields({
  organizationId,
  returnPath
}: {
  organizationId: string;
  returnPath: string;
}) {
  return (
    <>
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="returnPath" value={returnPath} />
    </>
  );
}

export function TextField({
  label,
  name,
  type = "text",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <Input name={name} type={type} {...props} />
    </label>
  );
}

export function SelectField({
  children,
  defaultValue,
  label,
  name,
  optional
}: {
  children: React.ReactNode;
  defaultValue?: string;
  label: string;
  name: string;
  optional?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <select
        name={name}
        defaultValue={defaultValue ?? (optional ? "" : undefined)}
        className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {optional ? <option value="">None</option> : null}
        {children}
      </select>
    </label>
  );
}

export function StatusPill({
  label,
  muted
}: {
  label: string;
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium",
        statusTone(label, muted)
      )}
    >
      {formatStatus(label)}
    </span>
  );
}

export function RoomLink({
  children,
  organizationId,
  roomId
}: {
  children: React.ReactNode;
  organizationId: string;
  roomId: string;
}) {
  return (
    <Button asChild variant="outline" size="sm">
      <Link href={`/app/rooms/${roomId}?organizationId=${organizationId}`}>
        {children}
      </Link>
    </Button>
  );
}

export function roomLabel(room: {
  roomNumber: string;
  floor?: {
    name: string;
    building?: {
      name: string;
      asset?: {
        name: string;
      };
    };
  };
}) {
  return [
    room.floor?.building?.asset?.name,
    room.floor?.building?.name,
    room.floor?.name,
    room.roomNumber
  ]
    .filter(Boolean)
    .join(" / ");
}

export function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    dateStyle: "medium"
  });
}

export function formatMoney(value: { toString(): string }) {
  return Number(value.toString()).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function formatStatus(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function statusTone(label: string, muted?: boolean) {
  if (muted) {
    return "border-muted bg-secondary text-muted-foreground";
  }

  if (label === "VACANT" || label === "PAID" || label === "RESOLVED") {
    return "border-primary/30 bg-primary/10 text-primary";
  }

  if (label === "OCCUPIED" || label === "ISSUED" || label === "IN_PROGRESS") {
    return "border-accent/40 bg-accent/10 text-accent";
  }

  if (label === "MAINTENANCE" || label === "OVERDUE" || label === "URGENT") {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }

  return "border-muted bg-secondary text-muted-foreground";
}
