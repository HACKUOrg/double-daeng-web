import { redirect } from "next/navigation";
import { z } from "zod";

const organizationIdSchema = z.string().uuid();

type OrganizationScopeProfile = {
  memberships: {
    organization: {
      id: string;
      name: string;
      status: string;
    };
  }[];
};

export function resolveActiveOrganization(
  profile: OrganizationScopeProfile,
  requestedOrganizationId?: string
) {
  const activeMemberships = profile.memberships.filter(
    (membership) => membership.organization.status === "ACTIVE"
  );

  if (!activeMemberships.length) {
    return {
      activeMemberships,
      activeOrganization: null
    };
  }

  if (requestedOrganizationId) {
    const parsed = organizationIdSchema.safeParse(requestedOrganizationId);

    if (!parsed.success) {
      redirect("/app?error=invalid-organization");
    }

    const requestedMembership = activeMemberships.find(
      (membership) => membership.organization.id === parsed.data
    );

    if (!requestedMembership) {
      redirect("/app?error=organization-scope");
    }

    return {
      activeMemberships,
      activeOrganization: requestedMembership.organization
    };
  }

  return {
    activeMemberships,
    activeOrganization: activeMemberships[0].organization
  };
}
