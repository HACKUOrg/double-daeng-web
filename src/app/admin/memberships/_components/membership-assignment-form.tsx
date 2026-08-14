"use client";

import { useMemo, useState } from "react";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { roleLabels } from "@/lib/rbac";

type MembershipAction = (formData: FormData) => void | Promise<void>;

type AssignmentUser = {
  id: string;
  email: string;
  role: keyof typeof roleLabels;
};

type AssignmentOrganization = {
  id: string;
  name: string;
  status: string;
};

type ExistingMembership = {
  userId: string;
  organizationId: string;
};

export function MembershipAssignmentForm({
  action,
  users,
  organizations,
  memberships
}: {
  action: MembershipAction;
  users: AssignmentUser[];
  organizations: AssignmentOrganization[];
  memberships: ExistingMembership[];
}) {
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id ?? "");
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");

  const assignedOrganizationIds = useMemo(
    () =>
      new Set(
        memberships
          .filter((membership) => membership.userId === selectedUserId)
          .map((membership) => membership.organizationId)
      ),
    [memberships, selectedUserId]
  );

  const availableOrganizations = useMemo(
    () =>
      organizations.filter(
        (organization) =>
          organization.status === "ACTIVE" &&
          !assignedOrganizationIds.has(organization.id)
      ),
    [assignedOrganizationIds, organizations]
  );

  const organizationValue = availableOrganizations.some(
    (organization) => organization.id === selectedOrganizationId
  )
    ? selectedOrganizationId
    : availableOrganizations[0]?.id ?? "";

  function handleUserChange(userId: string) {
    setSelectedUserId(userId);
    setSelectedOrganizationId("");
  }

  return (
    <form
      action={action}
      className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-start"
    >
      <label className="grid min-w-0 gap-2">
        <span className="text-sm font-medium">User</span>
        <select
          name="userId"
          value={selectedUserId}
          onChange={(event) => handleUserChange(event.target.value)}
          required
          className="h-11 min-w-0 w-full rounded-md border bg-background px-3 text-sm outline-none transition-colors hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring"
        >
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.email} - {roleLabels[user.role]}
            </option>
          ))}
        </select>
      </label>
      <label className="grid min-w-0 gap-2">
        <span className="text-sm font-medium">Organization</span>
        <select
          name="organizationId"
          value={organizationValue}
          onChange={(event) => setSelectedOrganizationId(event.target.value)}
          required={availableOrganizations.length > 0}
          disabled={availableOrganizations.length === 0}
          className="h-11 min-w-0 w-full rounded-md border bg-background px-3 text-sm outline-none transition-colors hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        >
          {availableOrganizations.length ? (
            availableOrganizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))
          ) : (
            <option value="">No organizations available</option>
          )}
        </select>
        <span
          className="text-xs font-normal text-muted-foreground"
          aria-live="polite"
        >
          {availableOrganizations.length
            ? `${availableOrganizations.length} organization${
                availableOrganizations.length === 1 ? "" : "s"
              } available`
            : "This user already has all active organizations assigned."}
        </span>
      </label>
      <Button
        type="submit"
        className="w-full lg:mt-7 lg:w-auto lg:min-w-28"
        disabled={availableOrganizations.length === 0}
      >
        <Link2 className="size-4" aria-hidden="true" />
        Assign
      </Button>
    </form>
  );
}
