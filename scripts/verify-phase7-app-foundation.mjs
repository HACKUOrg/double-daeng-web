import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

const port = process.env.PORT ?? "3000";
const baseUrl = `http://127.0.0.1:${port}`;
const requestTimeout = 90_000;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!supabaseUrl || !secretKey || !connectionString) {
  throw new Error(
    "Supabase URL, SUPABASE_SECRET_KEY, and DIRECT_URL/DATABASE_URL are required."
  );
}

const ids = {
  managerAuth: undefined,
  operationAuth: undefined,
  customerAuth: undefined,
  managerUser: randomUUID(),
  operationUser: randomUUID(),
  customerUser: randomUUID(),
  managerMembership: randomUUID(),
  operationMembership: randomUUID(),
  customerMembership: randomUUID(),
  organization: randomUUID(),
  outsideOrganization: randomUUID(),
  asset: randomUUID(),
  outsideAsset: randomUUID(),
  building: randomUUID(),
  floor: randomUUID(),
  vacantRoom: randomUUID(),
  occupiedRoom: randomUUID(),
  maintenanceRoom: randomUUID(),
  unavailableRoom: randomUUID()
};
const suffix = ids.organization.slice(0, 8);
const fixture = {
  organization: `Phase7 App Org ${suffix}`,
  outsideOrganization: `Phase7 Outside Org ${suffix}`,
  asset: `Phase7 Asset ${suffix}`,
  outsideAsset: `Phase7 Outside Asset ${suffix}`,
  managerEmail: `phase7-manager-${suffix}@example.test`,
  managerPassword: `Phase7Manager!${suffix}Aa`,
  managerDisplayName: `Phase7 Manager ${suffix}`,
  operationEmail: `phase7-operation-${suffix}@example.test`,
  operationPassword: `Phase7Operation!${suffix}Aa`,
  operationDisplayName: `Phase7 Operation ${suffix}`,
  customerEmail: `phase7-customer-${suffix}@example.test`,
  customerPassword: `Phase7Customer!${suffix}Aa`,
  customerDisplayName: `Phase7 Customer ${suffix}`
};

function getSetCookies(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const cookie = headers.get("set-cookie");
  return cookie ? [cookie] : [];
}

function cookieHeader(setCookies) {
  return setCookies.map((cookie) => cookie.split(";")[0]).join("; ");
}

function findServerActionId(html, marker) {
  const forms = html.match(/<form\b[\s\S]*?<\/form>/g) ?? [];
  const form = forms.find((candidate) => candidate.includes(marker));
  const actionId = form?.match(/name="(\$ACTION_ID_[^"]+)"/)?.[1];

  if (!actionId) {
    throw new Error(`Could not find a Server Action id for marker: ${marker}`);
  }

  return actionId;
}

function createAdmin() {
  return createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    }
  });
}

async function createAuthUser({ displayName, email, password, role }) {
  const { data, error } = await createAdmin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: {
      role,
      status: "ACTIVE"
    },
    user_metadata: {
      display_name: displayName
    }
  });

  if (error || !data.user?.id) {
    throw new Error(`Could not create ${role} auth user: ${error?.message}`);
  }

  return data.user.id;
}

async function createFixture(client) {
  ids.managerAuth = await createAuthUser({
    displayName: fixture.managerDisplayName,
    email: fixture.managerEmail,
    password: fixture.managerPassword,
    role: "MANAGER"
  });
  ids.operationAuth = await createAuthUser({
    displayName: fixture.operationDisplayName,
    email: fixture.operationEmail,
    password: fixture.operationPassword,
    role: "OPERATION"
  });
  ids.customerAuth = await createAuthUser({
    displayName: fixture.customerDisplayName,
    email: fixture.customerEmail,
    password: fixture.customerPassword,
    role: "CUSTOMER"
  });

  await client.query(
    `
      insert into public.organizations (id, name, status, updated_at)
      values ($1, $2, 'ACTIVE', now()), ($3, $4, 'ACTIVE', now())
    `,
    [
      ids.organization,
      fixture.organization,
      ids.outsideOrganization,
      fixture.outsideOrganization
    ]
  );
  await client.query(
    `
      insert into public.users (id, auth_user_id, email, display_name, role, status, updated_at)
      values
        ($1, $2, $3, $4, 'MANAGER', 'ACTIVE', now()),
        ($5, $6, $7, $8, 'OPERATION', 'ACTIVE', now()),
        ($9, $10, $11, $12, 'CUSTOMER', 'ACTIVE', now())
    `,
    [
      ids.managerUser,
      ids.managerAuth,
      fixture.managerEmail,
      fixture.managerDisplayName,
      ids.operationUser,
      ids.operationAuth,
      fixture.operationEmail,
      fixture.operationDisplayName,
      ids.customerUser,
      ids.customerAuth,
      fixture.customerEmail,
      fixture.customerDisplayName
    ]
  );
  await client.query(
    `
      insert into public.organization_memberships (id, user_id, organization_id)
      values ($1, $2, $7), ($3, $4, $7), ($5, $6, $7)
    `,
    [
      ids.managerMembership,
      ids.managerUser,
      ids.operationMembership,
      ids.operationUser,
      ids.customerMembership,
      ids.customerUser,
      ids.organization
    ]
  );
  await client.query(
    `
      insert into public.assets (id, organization_id, name, type, status, updated_at)
      values
        ($1, $2, $3, 'DORMITORY', 'ACTIVE', now()),
        ($4, $5, $6, 'DORMITORY', 'ACTIVE', now())
    `,
    [
      ids.asset,
      ids.organization,
      fixture.asset,
      ids.outsideAsset,
      ids.outsideOrganization,
      fixture.outsideAsset
    ]
  );
  await client.query(
    `
      insert into public.buildings (id, asset_id, name, updated_at)
      values ($1, $2, 'Main Building', now())
    `,
    [ids.building, ids.asset]
  );
  await client.query(
    `
      insert into public.floors (id, building_id, name, number, updated_at)
      values ($1, $2, 'Floor 1', 1, now())
    `,
    [ids.floor, ids.building]
  );
  await client.query(
    `
      insert into public.rooms (id, floor_id, room_number, status, updated_at)
      values
        ($1, $5, '101', 'VACANT', now()),
        ($2, $5, '102', 'OCCUPIED', now()),
        ($3, $5, '103', 'MAINTENANCE', now()),
        ($4, $5, '104', 'UNAVAILABLE', now())
    `,
    [
      ids.vacantRoom,
      ids.occupiedRoom,
      ids.maintenanceRoom,
      ids.unavailableRoom,
      ids.floor
    ]
  );
}

async function cleanupFixture(client) {
  const admin = createAdmin();
  await client.query(
    "delete from public.rooms where id = any($1::uuid[])",
    [[ids.vacantRoom, ids.occupiedRoom, ids.maintenanceRoom, ids.unavailableRoom]]
  );
  await client.query("delete from public.floors where id = $1", [ids.floor]);
  await client.query("delete from public.buildings where id = $1", [ids.building]);
  await client.query("delete from public.assets where id in ($1, $2)", [
    ids.asset,
    ids.outsideAsset
  ]);
  await client.query(
    "delete from public.organization_memberships where id in ($1, $2, $3)",
    [ids.managerMembership, ids.operationMembership, ids.customerMembership]
  );
  await client.query("delete from public.users where id in ($1, $2, $3)", [
    ids.managerUser,
    ids.operationUser,
    ids.customerUser
  ]);
  await client.query("delete from public.organizations where id in ($1, $2)", [
    ids.organization,
    ids.outsideOrganization
  ]);

  for (const authUserId of [
    ids.managerAuth,
    ids.operationAuth,
    ids.customerAuth
  ]) {
    if (authUserId) {
      await admin.auth.admin.deleteUser(authUserId);
    }
  }
}

async function login(email, password) {
  const loginPage = await fetch(`${baseUrl}/login`, {
    signal: AbortSignal.timeout(requestTimeout)
  });
  const loginHtml = await loginPage.text();
  const actionId = findServerActionId(loginHtml, "password");
  const form = new FormData();
  form.set(actionId, "");
  form.set("email", email);
  form.set("password", password);

  const response = await fetch(`${baseUrl}/login`, {
    method: "POST",
    body: form,
    headers: {
      origin: baseUrl,
      referer: `${baseUrl}/login`
    },
    signal: AbortSignal.timeout(requestTimeout),
    redirect: "manual"
  });
  const cookies = getSetCookies(response.headers);

  if (!cookies.length) {
    throw new Error(`Login did not set cookies for ${email}. status=${response.status}`);
  }

  return cookieHeader(cookies);
}

async function fetchAuthed(path, cookies, redirect = "follow") {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      cookie: cookies
    },
    signal: AbortSignal.timeout(requestTimeout),
    redirect
  });
  const html = redirect === "follow" ? await response.text() : "";

  return { response, html };
}

async function assertDashboard({
  cookies,
  forbiddenUsersLink,
  roleTitle,
  roleTools
}) {
  const { response, html } = await fetchAuthed(
    `/app?organizationId=${ids.organization}`,
    cookies
  );

  if (!response.ok) {
    throw new Error(`/app returned ${response.status}`);
  }

  for (const expected of [
    roleTitle,
    fixture.organization,
    "Dashboard",
    "Active organization",
    "Assets",
    "Buildings",
    "Floors",
    "Rooms"
  ]) {
    if (!html.includes(expected)) {
      throw new Error(`/app dashboard missing ${expected}`);
    }
  }

  if (!forbiddenUsersLink) {
    for (const expected of ["Vacant", "Occupied"]) {
      if (!html.includes(expected)) {
        throw new Error(`/app staff dashboard missing ${expected}`);
      }
    }
  }

  for (const expected of roleTools) {
    if (!html.includes(expected)) {
      throw new Error(`/app role dashboard missing ${expected}`);
    }
  }

  if (html.includes(fixture.outsideOrganization) || html.includes(fixture.outsideAsset)) {
    throw new Error("/app leaked data from an organization outside membership scope.");
  }

  const hasUsersLink = html.includes(">Users<") || html.includes("/app/users");
  if (forbiddenUsersLink && hasUsersLink) {
    throw new Error("Customer dashboard exposed organization user management.");
  }
  if (!forbiddenUsersLink && !hasUsersLink) {
    throw new Error("Staff dashboard did not expose organization user management.");
  }
}

async function assertBlockedScope(cookies) {
  const { response } = await fetchAuthed(
    `/app?organizationId=${ids.outsideOrganization}`,
    cookies,
    "manual"
  );
  const location = response.headers.get("location") ?? "";

  if (![303, 307, 308].includes(response.status) || !location.includes("organization-scope")) {
    throw new Error(
      `Blocked organization did not redirect safely. status=${response.status} location=${location}`
    );
  }
}

async function assertUsersRouteBlockedForCustomer(cookies) {
  const { response } = await fetchAuthed(
    `/app/users?organizationId=${ids.organization}`,
    cookies,
    "manual"
  );
  const location = response.headers.get("location") ?? "";

  if (![303, 307, 308].includes(response.status) || !location.includes("/app")) {
    throw new Error(
      `Customer /app/users was not blocked. status=${response.status} location=${location}`
    );
  }
}

const client = new Client({ connectionString });

await client.connect();

try {
  await createFixture(client);
  const [managerCookies, operationCookies, customerCookies] = await Promise.all([
    login(fixture.managerEmail, fixture.managerPassword),
    login(fixture.operationEmail, fixture.operationPassword),
    login(fixture.customerEmail, fixture.customerPassword)
  ]);

  await assertDashboard({
    cookies: managerCookies,
    forbiddenUsersLink: false,
    roleTitle: "Manager dashboard",
    roleTools: ["Team coverage", "Room readiness", "Phase 8 runway"]
  });
  await assertDashboard({
    cookies: operationCookies,
    forbiddenUsersLink: false,
    roleTitle: "Operation dashboard",
    roleTools: ["Daily operations", "Service scope", "Phase 8 runway"]
  });
  await assertDashboard({
    cookies: customerCookies,
    forbiddenUsersLink: true,
    roleTitle: "Customer dashboard",
    roleTools: ["My organization", "Customer services", "Own data permission ready"]
  });

  await assertBlockedScope(managerCookies);
  await assertBlockedScope(operationCookies);
  await assertBlockedScope(customerCookies);
  await assertUsersRouteBlockedForCustomer(customerCookies);

  console.log("PHASE7_APP_FOUNDATION_OK");
} finally {
  await cleanupFixture(client);
  await client.end();
}
