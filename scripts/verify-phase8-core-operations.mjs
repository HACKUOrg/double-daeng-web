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
  roomTwo: randomUUID(),
  roomThree: randomUUID(),
  roomFour: randomUUID()
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
  reservationPassword: `987654${suffix}`,
  reservationName: `Reserved Resident ${suffix}`,
  contractNumber: `P8-C-${suffix}`,
  reservationContractNumber: `P8-RC-${suffix}`,
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
        ($2, $3, '802', 13000.00, 26000.00, 'VACANT', now()),
        ($4, $3, '803', 14000.00, 28000.00, 'VACANT', now()),
        ($5, $3, '804', 15000.00, 30000.00, 'VACANT', now())
    `,
    [ids.roomOne, ids.roomTwo, ids.floor, ids.roomThree, ids.roomFour]
  );
}

async function cleanupFixture(client) {
  const residentAuthUsers = await client.query(
    "select auth_user_id from public.users where username = any($1::text[])",
    [[`${fixture.assetAbbreviation}801`, `${fixture.assetAbbreviation}803`]]
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
  await client.query("delete from public.room_reservations where organization_id = $1", [
    ids.organization
  ]);
  await client.query("delete from public.rooms where id = any($1::uuid[])", [
    [ids.roomOne, ids.roomTwo, ids.roomThree, ids.roomFour]
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
  await client.query(
    "delete from public.users where id in ($1, $2) or username = any($3::text[])",
    [
      ids.managerUser,
      ids.operationUser,
      [`${fixture.assetAbbreviation}801`, `${fixture.assetAbbreviation}803`]
    ]
  );
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

async function getReservationId(client, roomId, status = "ACTIVE") {
  const result = await client.query(
    "select id from public.room_reservations where organization_id = $1 and room_id = $2 and status = $3",
    [ids.organization, roomId, status]
  );
  const id = result.rows[0]?.id;

  if (!id) {
    throw new Error(`Room reservation with status ${status} was not found.`);
  }

  return id;
}

async function assertRoomStatus(client, roomId, status) {
  const result = await client.query("select status from public.rooms where id = $1", [
    roomId
  ]);

  if (result.rows[0]?.status !== status) {
    throw new Error(`Expected room ${roomId} status ${status}, got ${result.rows[0]?.status}`);
  }
}

async function assertRoomLoginSuspended(client, username) {
  const result = await client.query(
    "select status from public.users where username = $1",
    [username]
  );

  if (result.rows[0]?.status !== "SUSPENDED") {
    throw new Error(`Expected room login ${username} to be suspended.`);
  }
}

async function assertManagerPage(cookies) {
  const pages = [
    {
      path: `/app/rooms?organizationId=${ids.organization}`,
      expected: ["Room overview", "801", "802", fixture.asset]
    },
    {
      path: `/app/operations/move-in?organizationId=${ids.organization}`,
      expected: ["Move-in", "New resident stay", "Assign room"]
    },
    {
      path: `/app/operations/reserve-room?organizationId=${ids.organization}`,
      expected: ["Reserve room", "New reservation", "Active reservations"]
    },
    {
      path: `/app/operations/monthly-invoice?organizationId=${ids.organization}`,
      expected: ["Monthly invoice", "Create invoice", "Recent invoices"]
    },
    {
      path: `/app/operations/mark-unavailable?organizationId=${ids.organization}`,
      expected: ["Mark unavailable", "Take room out of service"]
    }
  ];

  for (const page of pages) {
    const { response, html } = await fetchAuthed(page.path, cookies);

    if (!response.ok) {
      throw new Error(`${page.path} returned ${response.status}`);
    }

    for (const expected of page.expected) {
      if (!html.includes(expected)) {
        throw new Error(`${page.path} missing ${expected}`);
      }
    }

    if (html.includes(fixture.outsideOrganization) || html.includes(fixture.outsideAsset)) {
      throw new Error(`${page.path} leaked outside organization data.`);
    }
  }
}

async function assertBlockedOutsideScope(cookies) {
  const { response } = await fetchAuthed(
    `/app/rooms?organizationId=${ids.outsideOrganization}`,
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
  const [rooms, roomDetail, invoices, meters, maintenance] = await Promise.all([
    fetchAuthed(`/app/rooms?organizationId=${ids.organization}`, managerCookies),
    fetchAuthed(
      `/app/rooms/${ids.roomOne}?organizationId=${ids.organization}`,
      managerCookies
    ),
    fetchAuthed(
      `/app/operations/monthly-invoice?organizationId=${ids.organization}`,
      managerCookies
    ),
    fetchAuthed(
      `/app/operations/meter-reading?organizationId=${ids.organization}`,
      managerCookies
    ),
    fetchAuthed(
      `/app/operations/maintenance?organizationId=${ids.organization}`,
      managerCookies
    )
  ]);
  const managerHtml = [
    rooms.html,
    roomDetail.html,
    invoices.html,
    meters.html,
    maintenance.html
  ].join("\n");

  for (const expected of [
    "Room overview",
    `Room 801`,
    fixture.residentFullName,
    fixture.contractNumber,
    fixture.invoiceNumber,
    fixture.maintenanceTitle,
    "Resolved",
    "Water 123.45"
  ]) {
    if (!managerHtml.includes(expected)) {
      throw new Error(`Manager final page missing ${expected}`);
    }
  }

  const [residentMaintenance, residentRooms, residentMoveIn] = await Promise.all([
    fetchAuthed(
      `/app/operations/maintenance?organizationId=${ids.organization}`,
      residentCookies
    ),
    fetchAuthed(`/app/rooms?organizationId=${ids.organization}`, residentCookies),
    fetchAuthed(
      `/app/operations/move-in?organizationId=${ids.organization}`,
      residentCookies
    )
  ]);
  const residentHtml = [residentMaintenance.html, residentRooms.html].join("\n");

  for (const expected of [
    "My active stay",
    fixture.residentFullName,
    "Room overview",
    fixture.maintenanceTitle
  ]) {
    if (!residentHtml.includes(expected)) {
      throw new Error(`Resident final page missing ${expected}`);
    }
  }

  if (
    residentHtml.includes("Monthly invoice") ||
    residentMoveIn.html.includes("Assign room")
  ) {
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
        (select count(*) from public.room_reservations where organization_id = $1 and status = 'CANCELLED') as cancelled_reservations,
        (select count(*) from public.room_reservations where organization_id = $1 and status = 'CONVERTED') as converted_reservations,
        (select count(*) from public.rooms where id = $3 and status = 'UNAVAILABLE') as unavailable_rooms,
        (select count(*) from public.users where username = $2 and role = 'RESIDENT') as resident_users,
        (select count(*) from public.audit_logs where organization_id = $1 and action in (
          'room_reservation.create',
          'room_reservation.cancel',
          'room_reservation.convert',
          'room_assignment.create',
          'invoice.create',
          'meter_reading.create',
          'maintenance_request.create',
          'maintenance_request.update'
        )) as audits
    `,
    [ids.organization, `${fixture.assetAbbreviation}801`, ids.roomFour]
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
  const moveInPath = `/app/operations/move-in?organizationId=${ids.organization}`;
  const moveOutPath = `/app/operations/move-out?organizationId=${ids.organization}`;
  const reservePath = `/app/operations/reserve-room?organizationId=${ids.organization}`;
  const invoicePath = `/app/operations/monthly-invoice?organizationId=${ids.organization}`;
  const meterPath = `/app/operations/meter-reading?organizationId=${ids.organization}`;
  const unavailablePath = `/app/operations/mark-unavailable?organizationId=${ids.organization}`;
  const maintenancePath = `/app/operations/maintenance?organizationId=${ids.organization}`;

  await assertManagerPage(managerCookies);
  await assertBlockedOutsideScope(managerCookies);

  await postAction(reservePath, managerCookies, 'name="reservedDate"', {
    organizationId: ids.organization,
    roomId: ids.roomTwo,
    reserverName: `Cancel Reservation ${suffix}`,
    reserverPhone: "0899999999",
    reservedDate: "2026-08-08",
    expectedMoveInDate: "2026-09-01",
    note: "Cancel verification"
  });
  const cancelledReservationId = await getReservationId(client, ids.roomTwo);
  await assertRoomStatus(client, ids.roomTwo, "RESERVED");

  await postAction(reservePath, managerCookies, "Cancel reservation", {
    organizationId: ids.organization,
    reservationId: cancelledReservationId
  });
  await assertRoomStatus(client, ids.roomTwo, "VACANT");

  await postAction(reservePath, managerCookies, 'name="reservedDate"', {
    organizationId: ids.organization,
    roomId: ids.roomThree,
    reserverName: fixture.reservationName,
    reserverPhone: "0877777777",
    reservedDate: "2026-08-08",
    expectedMoveInDate: "2026-09-08",
    note: "Convert verification"
  });
  const convertedReservationId = await getReservationId(client, ids.roomThree);
  await assertRoomStatus(client, ids.roomThree, "RESERVED");

  await postAction(reservePath, managerCookies, convertedReservationId, {
    organizationId: ids.organization,
    reservationId: convertedReservationId,
    roomId: ids.roomThree,
    moveInDate: "2026-08-09",
    idDocumentNumber: fixture.reservationPassword,
    emergencyContact: "Reserved Emergency",
    contractNumber: fixture.reservationContractNumber
  });
  await assertRoomStatus(client, ids.roomThree, "OCCUPIED");

  await postAction(unavailablePath, managerCookies, "Mark unavailable", {
    organizationId: ids.organization,
    roomId: ids.roomFour
  });
  await assertRoomStatus(client, ids.roomFour, "UNAVAILABLE");

  await postAction(moveInPath, managerCookies, 'name="moveInDate"', {
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

  await postAction(invoicePath, managerCookies, 'name="invoiceNumber"', {
    organizationId: ids.organization,
    roomAssignmentId: assignmentId,
    invoiceNumber: fixture.invoiceNumber,
    issueDate: "2026-08-08",
    dueDate: "2026-09-08",
    totalAmount: "12500.00",
    status: "ISSUED"
  });

  await postAction(meterPath, operationCookies, 'name="readingValue"', {
    organizationId: ids.organization,
    roomId: ids.roomOne,
    meterType: "WATER",
    readingDate: "2026-08-08",
    readingValue: "123.45",
    note: "Phase 8 verify"
  });

  await postAction(maintenancePath, residentCookies, 'Send request', {
    organizationId: ids.organization,
    roomId: ids.roomOne,
    title: fixture.maintenanceTitle,
    description: "Water is leaking under the sink.",
    priority: "HIGH"
  });
  const maintenanceRequestId = await getMaintenanceRequestId(client);
  await assertRoomStatus(client, ids.roomOne, "MAINTENANCE");

  await postAction(maintenancePath, operationCookies, maintenanceRequestId, {
    organizationId: ids.organization,
    requestId: maintenanceRequestId,
    status: "RESOLVED",
    assignedToUserId: ids.operationUser
  });
  await assertRoomStatus(client, ids.roomOne, "OCCUPIED");

  await assertFinalPages({ managerCookies, residentCookies });
  await assertDatabaseState(client);

  await postAction(moveOutPath, managerCookies, "Move out", {
    organizationId: ids.organization,
    assignmentId,
    moveOutDate: "2026-10-08"
  });
  await assertRoomStatus(client, ids.roomOne, "VACANT");
  await assertRoomLoginSuspended(client, `${fixture.assetAbbreviation}801`);

  console.log("PHASE8_CORE_OPERATIONS_OK");
} finally {
  await cleanupFixture(client);
  await client.end();
}
