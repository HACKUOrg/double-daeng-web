import { resolveActiveOrganization } from "../src/lib/auth/organization-scope";

const activeA = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Active A",
  status: "ACTIVE"
};
const activeB = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Active B",
  status: "ACTIVE"
};
const suspended = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Suspended",
  status: "SUSPENDED"
};

const profile = {
  memberships: [
    { organization: activeA },
    { organization: suspended },
    { organization: activeB }
  ]
};

const defaultScope = resolveActiveOrganization(profile);

if (defaultScope.activeOrganization?.id !== activeA.id) {
  throw new Error("Default scope should use the first active membership.");
}

if (defaultScope.activeMemberships.length !== 2) {
  throw new Error("Suspended organizations should not be active app memberships.");
}

const requestedScope = resolveActiveOrganization(profile, activeB.id);

if (requestedScope.activeOrganization?.id !== activeB.id) {
  throw new Error("Requested active membership should be selected.");
}

const emptyScope = resolveActiveOrganization({
  memberships: [{ organization: suspended }]
});

if (emptyScope.activeOrganization !== null || emptyScope.activeMemberships.length) {
  throw new Error("Profiles without active memberships should have no active scope.");
}

console.log("PHASE3_SCOPE_OK");
