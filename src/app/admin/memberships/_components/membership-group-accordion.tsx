"use client";

import { useId, useState } from "react";
import { ChevronDown, Users } from "lucide-react";
import { roleLabels } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { MembershipRemoveDialog } from "./membership-remove-dialog";

type MembershipAction = (formData: FormData) => void | Promise<void>;

type MembershipGroup = {
  user: {
    id: string;
    email: string;
    role: keyof typeof roleLabels;
  };
  memberships: Array<{
    id: string;
    organization: {
      name: string;
      status: string;
    };
  }>;
};

export function MembershipGroupAccordion({
  action,
  group
}: {
  action: MembershipAction;
  group: MembershipGroup;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();

  return (
    <div>
      <button
        type="button"
        className="group flex min-h-16 w-full items-center justify-between gap-4 px-5 py-4 text-left outline-none transition-colors hover:bg-secondary/50 focus-visible:bg-secondary/50"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label={`${isOpen ? "Collapse" : "Expand"} memberships for ${group.user.email}`}
      >
        <span className="flex min-w-0 items-center gap-3">
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
              !isOpen && "-rotate-90"
            )}
            aria-hidden="true"
          />
          <Users className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block truncate font-semibold">
              {group.user.email}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{roleLabels[group.user.role]}</span>
              <span aria-hidden="true">/</span>
              <span>{group.memberships.length} organizations</span>
            </span>
          </span>
        </span>
        <span className="shrink-0 text-xs font-medium text-muted-foreground">
          View organizations
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
          <div className="border-t bg-background/40 px-5">
            {group.memberships.map((membership) => (
              <div
                key={membership.id}
                className="flex flex-col gap-3 border-b py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {membership.organization.name}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {membership.organization.status}
                  </p>
                </div>
                <MembershipRemoveDialog
                  action={action}
                  membershipId={membership.id}
                  organizationName={membership.organization.name}
                  userEmail={group.user.email}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
