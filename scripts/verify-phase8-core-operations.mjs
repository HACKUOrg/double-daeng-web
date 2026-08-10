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
  managerUser: randomUUID(),
  operationUser: randomUUID(),
  managerMembership: randomUUID(),
  operationMembership: randomUUID(),
  organization: randomUUID(),
  outsideOrganization: randomUUID(),
  asset: randomUUID(),
  outsideAsset: randomUUID(),
  building: randomUUID(),
  floor: randomUUID(),
  roomOne: randomUUID(),
  roomTwo: randomUUID()
};
const suffix = ids.organization.slice(0, 8);
const fixture = {
  organization: `Phase8 Operations Org ${suffix}`,
  outsideOrganization: `Phase8 Outside Org ${suffix}`,
  asset: `Phase8 Asset ${suffix}`,
  assetAbbreviation: `P8${suffix.slice(0, 4)}`.toUpperCase(),
  outsideAsset: `Phase8 Outside Asset ${suffix}`,
  outsideAssetAbbreviation: `O8${suffix.slice(0, 4)}`.toUpperCase(),
  managerEmail: `phase8-manager-${suffix}@example.test`,
  managerPassword: `Phase8Manager!${suffix}Aa`,
  managerDisplayName: `Phase8 Manager ${suffix}`,
  operationEmail: `phase8-operation-${suffix}@example.test`,
  operationPassword: `Phase8Operation!${suffix}Aa`,
  operationDisplayName: `Phase8 Operation ${suffix}`,
  residentPassword: `123456${suffix}`,
  residentCode: `P8${suffix.slice(0, 4)}801`.toUpperCase(),
  residentFullName: `Phase8 Resident ${suffix}`,
  contractNumber: `P8-C-${suffix}`,
  invoiceNumber: `P8-I-${suffix}`,
  maintenanceTitle: `Phase8 Leaky Faucet ${suffix}`
};
const createdAuthUserIds = [];

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
    throw new Error(`Could not create auth user ${email}: ${error?.message}`);
  }

  createdAuthUserIds.push(data.user.id);
  return data.user.id;
}

async function createFixture(client) {
  const [managerAuthId, operationAuthId] = await Promise.all([
    createAuthUser({
      displayName: fixture.managerDisplayName,
      email: fixture.managerEmail,
      password: fixture.managerPassword,
      role: "MANAGER"
    }),
    createAuthUser({
      displayName: fixture.operationDisplayName,
      email: fixture.operationEmail,
      password: fixture.operationPassword,
      role: "OPERATION"
    }),
  ]);

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
        ($5, $6, $7, $8, 'OPERATION', 'ACTIVE', now())
    `,
    [
      ids.managerUser,
      managerAuthId,
      fixture.managerEmail,
      fixture.managerDisplayName,
      ids.operationUser,
      operationAuthId,
      fixture.operationEmail,
      fixture.operationDisplayName
    ]
  );
  await client.query(
    `
      insert into public.organization_memberships (id, user_id, organization_id)
      values ($1, $2, $5), ($3, $4, $5)
    `,
    [
      ids.managerMembership,
      ids.managerUser,
      ids.operationMembership,
      ids.operationUser,
      ids.organization
    ]
  );
  await client.query(
    `
      insert into public.assets (id, organization_id, name, abbreviation, type, status, updated_at)
      values
        ($1, $2, $3, $4, 'DORMITORY', 'ACTIVE', now()),
        ($5, $6, $7, $8, 'DORMITORY', 'ACTIVE', now())
    `,
    [
      ids.asset,
      ids.organization,
      fixture.asset,
      fixture.assetAbbreviation,
      ids.outsideAsset,
      ids.outsideOrganization,
      fixture.outsideAsset,
      fixture.outsideAssetAbbreviation
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
      insert into public.rooms (id, floor_id, room_number, rent_amount, deposit_amount, status, updated_at)
      values
        ($1, $3, '801', 12000.00, 24000.00, 'VACANT', now()),
        ($2, $3, '802', 13000.00, 26000.00, 'VACANT', now())
    `,
    [ids.roomOne, ids.roomTwo, ids.floor]
  );
}

async function cleanupFixture(client) {
  const residentAuthUsers = await client.query(
    "select auth_user_id from public.users where username = $1",
    [`${fixture.assetAbbreviation}801`]
  );
  await client.query("delete from public.audit_logs where organization_id = $1", [
    ids.organization
  ]);

  await client.query("delete from public.attachments where organization_id = $1", [
    ids.organization
  ]);
  await client.query(
    "delete from public.maintenance_requests where organization_id = $1",
    [ids.organization]
  );
  await client.query("delete from public.meter_readings where organization_id = $1", [
    ids.organization
  ]);
  await client.query("delete from public.invoices where organization_id = $1", [
    ids.organization
  ]);
  await client.query("delete from public.contracts where organization_id = $1", [
    ids.organization
  ]);
  await client.query("delete from public.room_assignments where organization_id = $1", [
    ids.organization
  ]);
  await client.query("delete from public.rooms where id in ($1, $2)", [
    ids.roomOne,
    ids.roomTwo
  ]);
  await client.query("delete from public.floors where id = $1", [ids.floor]);
  await client.query("delete from public.buildings where id = $1", [ids.building]);
  await client.query("delete from public.assets where id in ($1, $2)", [
    ids.asset,
    ids.outsideAsset
  ]);
  await client.query(
    "delete from public.organization_memberships where organization_id = $1",
    [ids.organization]
  );
  await client.query("delete from public.users where id in ($1, $2) or username = $3", [
    ids.managerUser,
    ids.operationUser,
    `${fixture.assetAbbreviation}801`
  ]);
  await client.query("delete from public.organizations where id in ($1, $2)", [
    ids.organization,
    ids.outsideOrganization
  ]);

  const admin = createAdmin();
  const authUserIds = [
    ...createdAuthUserIds,
    ...residentAuthUsers.rows.map((row) => row.auth_user_id)
  ];

  for (const authUserId of authUserIds) {
    await admin.auth.admin.deleteUser(authUserId);
  }
}

async function login(identifier, password) {
  const loginPage = await fetch(`${baseUrl}/login`, {
    signal: AbortSignal.timeout(requestTimeout)
  });
  const loginHtml = await loginPage.text();
  const actionId = findServerActionId(loginHtml, "password");
  const form = new FormData();
  form.set(actionId, "");
  form.set("identifier", identifier);
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
    throw new Error(
      `Login did not set cookies for ${identifier}. status=${response.status}`
    );
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

async function postAction(path, cookies, marker, fields) {
  const { html } = await fetchAuthed(path, cookies);
  const actionId = findServerActionId(html, marker);
  const form = new FormData();
  form.set(actionId, "");

  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    body: form,
    headers: {
      cookie: cookies,
      origin: baseUrl,
      referer: `${baseUrl}${path}`
    },
    signal: AbortSignal.timeout(requestTimeout),
    redirect: "manual"
  });

  if (![303, 307, 308].includes(response.status)) {
    throw new Error(`Server action ${marker} did not redirect. status=${response.status}`);
  }
}

async function getAssignmentId(client) {
  const result = await client.query(
    "select id from public.room_assignments where organization_id = $1 and resident_code = $2 and status = 'ACTIVE'",
    [ids.organization, fixture.residentCode]
  );
  const id = result.rows[0]?.id;

  if (!id) {
    throw new Error("Room assignment was not created.");
  }

  return id;
}

async function getMaintenanceRequestId(client) {
  const result = await client.query(
    "select id from public.maintenance_requests where organization_id = $1 and title = $2",
    [ids.organization, fixture.maintenanceTitle]
  );
  const id = result.rows[0]?.id;

  if (!id) {
    throw new Error("Maintenance request was not created.");
  }

  return id;
}

async function assertManagerPage(cookies) {
  const { response, html } = await fetchAuthed(
    `/app/operations?organizationId=${ids.organization}`,
    cookies
  );

  if (!response.ok) {
    throw new Error(`/app/operations returned ${response.status}`);
  }

  for (const expected of [
    "Core operations",
    "Move-in",
    "Monthly invoice",
    "Meter reading",
    "Maintenance",
    fixture.organization
  ]) {
    if (!html.includes(expected)) {
      throw new Error(`/app/operations manager page missing ${expected}`);
    }
  }

  if (html.includes(fixture.outsideOrganization) || html.includes(fixture.outsideAsset)) {
    throw new Error("/app/operations leaked outside organization data.");
  }
}

async function assertBlockedOutsideScope(cookies) {
  const { response } = await fetchAuthed(
    `/app/operations?organizationId=${ids.outsideOrganization}`,
    cookies,
    "manual"
  );
  const location = response.headers.get("location") ?? "";

  if (![303, 307, 308].includes(response.status) || !location.includes("organization-scope")) {
    throw new Error(
      `Outside organization was not blocked. status=${response.status} location=${location}`
    );
  }
}

async function assertFinalPages({ managerCookies, residentCookies }) {
  const manager = await fetchAuthed(
    `/app/operations?organizationId=${ids.organization}`,
    managerCookies
  );

  for (const expected of [
    fixture.residentFullName,
    fixture.contractNumber,
    fixture.invoiceNumber,
    fixture.maintenanceTitle,
    "RESOLVED",
    "Water 123.45"
  ]) {
    if (!manager.html.includes(expected)) {
      throw new Error(`Manager final page missing ${expected}`);
    }
  }

  const resident = await fetchAuthed(
    `/app/operations?organizationId=${ids.organization}`,
    residentCookies
  );

  for (const expected of [
    "My active stay",
    fixture.residentFullName,
    fixture.invoiceNumber,
    fixture.maintenanceTitle
  ]) {
    if (!resident.html.includes(expected)) {
      throw new Error(`Resident final page missing ${expected}`);
    }
  }

  if (resident.html.includes("Move-in") || resident.html.includes("Monthly invoice")) {
    throw new Error("Resident page exposed staff operation forms.");
  }
}

async function assertDatabaseState(client) {
  const result = await client.query(
    `
      select
        (select count(*) from public.room_assignments where organization_id = $1 and status = 'ACTIVE') as active_stays,
        (select count(*) from public.contracts where organization_id = $1) as contracts,
        (select count(*) from public.invoices where organization_id = $1) as invoices,
        (select count(*) from public.meter_readings where organization_id = $1) as meter_readings,
        (select count(*) from public.maintenance_requests where organization_id = $1 and status = 'RESOLVED') as resolved_maintenance,
        (select count(*) from public.users where username = $2 and role = 'RESIDENT') as resident_users,
        (select count(*) from public.audit_logs where organization_id = $1 and action in (
          'room_assignment.create',
          'invoice.create',
          'meter_reading.create',
          'maintenance_request.create',
          'maintenance_request.update'
        )) as audits
    `,
    [ids.organization, `${fixture.assetAbbreviation}801`]
  );
  const row = result.rows[0];

  for (const [key, value] of Object.entries(row)) {
    if (Number(value) < 1) {
      throw new Error(`Expected Phase 8 DB count for ${key}, got ${value}`);
    }
  }
}

const client = new Client({ connectionString });

await client.connect();

try {
  await createFixture(client);
  const [managerCookies, operationCookies] = await Promise.all([
    login(fixture.managerEmail, fixture.managerPassword),
    login(fixture.operationEmail, fixture.operationPassword)
  ]);
  const operationsPath = `/app/operations?organizationId=${ids.organization}`;

  await assertManagerPage(managerCookies);
  await assertBlockedOutsideScope(managerCookies);

  await postAction(operationsPath, managerCookies, 'name="moveInDate"', {
    organizationId: ids.organization,
    roomId: ids.roomOne,
    residentFullName: fixture.residentFullName,
    residentPhone: "0812345678",
    emergencyContact: "Emergency Contact",
    moveInDate: "2026-08-08",
    idDocumentNumber: fixture.residentPassword,
    contractNumber: fixture.contractNumber
  });
  const assignmentId = await getAssignmentId(client);
  const residentCookies = await login(
    `${fixture.assetAbbreviation}801`,
    fixture.residentPassword
  );

  await postAction(operationsPath, managerCookies, 'name="invoiceNumber"', {
    organizationId: ids.organization,
    roomAssignmentId: assignmentId,
    invoiceNumber: fixture.invoiceNumber,
    issueDate: "2026-08-08",
    dueDate: "2026-09-08",
    totalAmount: "12500.00",
    status: "ISSUED"
  });

  await postAction(operationsPath, operationCookies, 'name="readingValue"', {
    organizationId: ids.organization,
    roomId: ids.roomOne,
    meterType: "WATER",
    readingDate: "2026-08-08",
    readingValue: "123.45",
    note: "Phase 8 verify"
  });

  await postAction(operationsPath, residentCookies, 'Send request', {
    organizationId: ids.organization,
    roomId: ids.roomOne,
    title: fixture.maintenanceTitle,
    description: "Water is leaking under the sink.",
    priority: "HIGH"
  });
  const maintenanceRequestId = await getMaintenanceRequestId(client);

  await postAction(operationsPath, operationCookies, maintenanceRequestId, {
    organizationId: ids.organization,
    requestId: maintenanceRequestId,
    status: "RESOLVED",
    assignedToUserId: ids.operationUser
  });

  await assertFinalPages({ managerCookies, residentCookies });
  await assertDatabaseState(client);

  console.log("PHASE8_CORE_OPERATIONS_OK");
} finally {
  await cleanupFixture(client);
  await client.end();
}
