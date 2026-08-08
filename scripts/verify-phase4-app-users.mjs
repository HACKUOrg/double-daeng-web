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
  throw new Error("Supabase URL, SUPABASE_SECRET_KEY, and DIRECT_URL/DATABASE_URL are required.");
}

const ids = {
  managerUser: randomUUID(),
  managerMembership: randomUUID(),
  organization: randomUUID(),
  outsideOrganization: randomUUID()
};
const suffix = ids.organization.slice(0, 8);
const fixture = {
  managerEmail: `phase4-manager-${suffix}@example.test`,
  managerPassword: `Phase4Manager!${suffix}Aa`,
  managerDisplayName: `Phase4 Manager ${suffix}`,
  operationEmail: `phase4-operation-${suffix}@example.test`,
  operationPassword: `Phase4Operation!${suffix}Aa`,
  operationDisplayName: `Phase4 Operation ${suffix}`,
  managerCustomerEmail: `phase4-manager-customer-${suffix}@example.test`,
  managerCustomerPassword: `Phase4ManagerCustomer!${suffix}Aa`,
  managerCustomerDisplayName: `Phase4 Manager Customer ${suffix}`,
  operationCustomerEmail: `phase4-operation-customer-${suffix}@example.test`,
  operationCustomerPassword: `Phase4OperationCustomer!${suffix}Aa`,
  operationCustomerDisplayName: `Phase4 Operation Customer ${suffix}`,
  forbiddenManagerEmail: `phase4-forbidden-manager-${suffix}@example.test`,
  forbiddenOutsideEmail: `phase4-forbidden-outside-${suffix}@example.test`,
  forbiddenOperationEmail: `phase4-forbidden-operation-${suffix}@example.test`,
  organization: `Phase4 App Users Org ${suffix}`,
  outsideOrganization: `Phase4 Outside Org ${suffix}`
};
const managedEmails = [
  fixture.operationEmail,
  fixture.managerCustomerEmail,
  fixture.operationCustomerEmail,
  fixture.forbiddenManagerEmail,
  fixture.forbiddenOutsideEmail,
  fixture.forbiddenOperationEmail
];

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

async function createFixture(client) {
  const admin = createAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email: fixture.managerEmail,
    password: fixture.managerPassword,
    email_confirm: true,
    app_metadata: {
      role: "MANAGER",
      status: "ACTIVE"
    },
    user_metadata: {
      display_name: fixture.managerDisplayName
    }
  });
  const authUserId = data.user?.id;

  if (error || !authUserId) {
    throw new Error(`Could not create fixture manager: ${error?.message ?? "missing user"}`);
  }

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
      values ($1, $2, $3, $4, 'MANAGER', 'ACTIVE', now())
    `,
    [ids.managerUser, authUserId, fixture.managerEmail, fixture.managerDisplayName]
  );
  await client.query(
    `
      insert into public.organization_memberships (id, user_id, organization_id)
      values ($1, $2, $3)
    `,
    [ids.managerMembership, ids.managerUser, ids.organization]
  );

  return authUserId;
}

async function cleanupFixture(client, managerAuthUserId) {
  const admin = createAdmin();

  for (const email of managedEmails) {
    const userResult = await client.query(
      "select id, auth_user_id from public.users where email = $1",
      [email]
    );
    const user = userResult.rows[0];

    if (user) {
      await client.query(
        "delete from public.audit_logs where entity_id = $1 or after->>'email' = $2 or before->>'email' = $2",
        [user.id, email]
      );
      await client.query("delete from public.organization_memberships where user_id = $1", [
        user.id
      ]);
      await client.query("delete from public.users where id = $1", [user.id]);
      await admin.auth.admin.deleteUser(user.auth_user_id);
    }
  }

  await client.query("delete from public.organization_memberships where user_id = $1", [
    ids.managerUser
  ]);
  await client.query("delete from public.users where id = $1", [ids.managerUser]);
  await client.query("delete from public.organizations where id in ($1, $2)", [
    ids.organization,
    ids.outsideOrganization
  ]);

  if (managerAuthUserId) {
    await admin.auth.admin.deleteUser(managerAuthUserId);
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
    throw new Error(`Login did not set cookies. status=${response.status}`);
  }

  return cookieHeader(cookies);
}

async function fetchAuthed(path, cookies) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      cookie: cookies
    },
    signal: AbortSignal.timeout(requestTimeout)
  });
  const html = await response.text();

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }

  return html;
}

async function postUserForm({
  cookies,
  email,
  displayName,
  role,
  organizationId,
  password
}) {
  const path = `/app/users?organizationId=${ids.organization}`;
  const html = await fetchAuthed(path, cookies);

  if (!html.includes(fixture.organization)) {
    throw new Error("/app/users did not render the expected organization.");
  }

  const actionId = findServerActionId(html, 'name="email"');
  const form = new FormData();
  form.set(actionId, "");
  form.set("email", email);
  form.set("displayName", displayName);
  form.set("role", role);
  form.set("organizationIds", organizationId);
  form.set("password", password);

  return fetch(`${baseUrl}/app/users`, {
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
}

async function createExpectedUser(cookies, user) {
  const response = await postUserForm({
    cookies,
    organizationId: ids.organization,
    ...user
  });

  if (![303, 307].includes(response.status)) {
    throw new Error(`/app/users create returned ${response.status}`);
  }

  const location = response.headers.get("location") ?? "";

  if (!location.includes("created=user")) {
    throw new Error(`Expected successful create redirect, got: ${location}`);
  }
}

async function assertForbiddenUser(cookies, user, organizationId = ids.organization) {
  const response = await postUserForm({
    cookies,
    organizationId,
    ...user
  });

  if (![303, 307].includes(response.status)) {
    throw new Error(`/app/users forbidden create returned ${response.status}`);
  }

  const location = response.headers.get("location") ?? "";

  if (!location.includes("error=forbidden-user")) {
    throw new Error(`Expected forbidden redirect, got: ${location}`);
  }

  await assertNoUser(user.email);
}

async function assertNoUser(email) {
  const userResult = await client.query(
    "select id from public.users where email = $1",
    [email]
  );

  if (userResult.rowCount) {
    throw new Error(`Forbidden user was created: ${email}`);
  }
}

async function verifyManagedUser({ email, role, displayName }) {
  const userResult = await client.query(
    `
      select id, auth_user_id, role, status
      from public.users
      where email = $1
    `,
    [email]
  );
  const user = userResult.rows[0];

  if (!user || user.role !== role || user.status !== "ACTIVE") {
    throw new Error(`${email} has unexpected role/status.`);
  }

  const membership = await client.query(
    "select id from public.organization_memberships where user_id = $1 and organization_id = $2",
    [user.id, ids.organization]
  );

  if (!membership.rowCount) {
    throw new Error(`${email} membership is missing.`);
  }

  const audit = await client.query(
    "select id from public.audit_logs where entity_id = $1 and action = 'user.create'",
    [user.id]
  );

  if (!audit.rowCount) {
    throw new Error(`${email} audit log is missing.`);
  }

  const authUser = await createAdmin().auth.admin.getUserById(user.auth_user_id);

  if (
    authUser.error ||
    authUser.data.user?.app_metadata?.role !== role ||
    authUser.data.user?.app_metadata?.status !== "ACTIVE" ||
    authUser.data.user?.user_metadata?.display_name !== displayName
  ) {
    throw new Error(`${email} Supabase Auth metadata is not synced.`);
  }

  return {
    authUserId: user.auth_user_id,
    appUserId: user.id
  };
}

const client = new Client({ connectionString });

await client.connect();

let managerAuthUserId;

try {
  managerAuthUserId = await createFixture(client);
  const managerCookies = await login(
    fixture.managerEmail,
    fixture.managerPassword
  );

  await createExpectedUser(managerCookies, {
    email: fixture.operationEmail,
    displayName: fixture.operationDisplayName,
    role: "OPERATION",
    password: fixture.operationPassword
  });
  await verifyManagedUser({
    email: fixture.operationEmail,
    role: "OPERATION",
    displayName: fixture.operationDisplayName
  });

  await createExpectedUser(managerCookies, {
    email: fixture.managerCustomerEmail,
    displayName: fixture.managerCustomerDisplayName,
    role: "CUSTOMER",
    password: fixture.managerCustomerPassword
  });
  await verifyManagedUser({
    email: fixture.managerCustomerEmail,
    role: "CUSTOMER",
    displayName: fixture.managerCustomerDisplayName
  });

  await assertForbiddenUser(managerCookies, {
    email: fixture.forbiddenManagerEmail,
    displayName: "Forbidden Manager",
    role: "MANAGER",
    password: `Phase4Forbidden!${suffix}Aa`
  });
  await assertForbiddenUser(
    managerCookies,
    {
      email: fixture.forbiddenOutsideEmail,
      displayName: "Forbidden Outside",
      role: "CUSTOMER",
      password: `Phase4ForbiddenOutside!${suffix}Aa`
    },
    ids.outsideOrganization
  );

  const operationCookies = await login(
    fixture.operationEmail,
    fixture.operationPassword
  );
  await createExpectedUser(operationCookies, {
    email: fixture.operationCustomerEmail,
    displayName: fixture.operationCustomerDisplayName,
    role: "CUSTOMER",
    password: fixture.operationCustomerPassword
  });
  await verifyManagedUser({
    email: fixture.operationCustomerEmail,
    role: "CUSTOMER",
    displayName: fixture.operationCustomerDisplayName
  });

  await assertForbiddenUser(operationCookies, {
    email: fixture.forbiddenOperationEmail,
    displayName: "Forbidden Operation",
    role: "OPERATION",
    password: `Phase4ForbiddenOperation!${suffix}Aa`
  });

  console.log("PHASE4_APP_USERS_OK");
} finally {
  await cleanupFixture(client, managerAuthUserId);
  await client.end();
}
