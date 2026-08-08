import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type OrganizationMembershipOption = {
  organization: {
    id: string;
    name: string;
    status: string;
  };
};

export function OrganizationSwitcher({
  activeOrganizationId,
  action,
  memberships,
  size = "default"
}: {
  activeOrganizationId: string;
  action: string;
  memberships: OrganizationMembershipOption[];
  size?: "default" | "compact";
}) {
  const compact = size === "compact";

  return (
    <form
      method="get"
      action={action}
      className={
        compact
          ? "flex items-center gap-2"
          : "grid gap-3 md:grid-cols-[1fr_auto]"
      }
    >
      <label
        className={
          compact ? "grid gap-1" : "grid gap-2 text-sm font-medium"
        }
      >
        <span className={compact ? "sr-only" : undefined}>Organization</span>
        <select
          name="organizationId"
          defaultValue={activeOrganizationId}
          className={
            compact
              ? "h-9 max-w-52 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              : "h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          }
        >
          {memberships.map((membership) => (
            <option
              key={membership.organization.id}
              value={membership.organization.id}
            >
              {membership.organization.name}
            </option>
          ))}
        </select>
      </label>
      <Button
        type="submit"
        variant={compact ? "ghost" : "outline"}
        size={compact ? "icon" : "default"}
        className={compact ? "size-9" : undefined}
        title="Switch organization"
      >
        <RefreshCw className="size-4" aria-hidden="true" />
        {compact ? <span className="sr-only">Switch</span> : "Switch"}
      </Button>
    </form>
  );
}
