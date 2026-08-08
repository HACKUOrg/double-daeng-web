import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

const port = process.env.PORT ?? "3000";
const baseUrl = `http://127.0.0.1:${port}`;
const requestTimeout = 90_000;
const saEmail = process.env.SEED_SA_EMAIL;
const saPassword = process.env.SEED_SA_PASSWORD;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!saEmail || !saPassword || !supabaseUrl || !secretKey || !connectionString) {
  throw new Error("SEED_SA_EMAIL, SEED_SA_PASSWORD, Supabase URL, SUPABASE_SECRET_KEY, and DIRECT_URL/DATABASE_URL are required.");
}

const ids = {
  managerUser: randomUUID(),
  managerMembership: randomUUID(),
  customerUser: randomUUID(),
  customerMembership: randomUUID(),
  organization: randomUUID()
};
const suffix = ids.organization.slice(0, 8);
const fixture = {
  organization: `Phase5 RBAC Org ${suffix}`,
  forbiddenOrganization: `Phase5 Forbidden Org ${suffix}`,
  managerEmail: `phase5-manager-${suffix}@example.test`,
  managerPassword: `Phase5Manager!${suffix}Aa`,
  managerDisplayName: `Phase5 Manager ${suffix}`,
  customerEmail: `phase5-customer-${suffix}@example.test`,
  customerPassword: `Phase5Customer!${suffix}Aa`,
  customerDisplayName: `Phase5 Customer ${suffix}`,
  forbiddenCustomerEmail: `phase5-forbidden-customer-${suffix}@example.test`
};

function createAdmin() {
  return createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    }
  });
}

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

async function createAuthUser({ email, password, role, displayName }) {
  const admin = createAdmin();
  const { data, error } = await admin.auth.admin.createUser({
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
  const authUserId = data.user?.id;

  if (error || !authUserId) {
    throw new Error(`Could not create auth user ${email}: ${error?.message ?? "missing user"}`);
  }

  return authUserId;
}

async function createFixture(client) {
  const [managerAuthUserId, customerAuthUserId] = await Promise.all([
    createAuthUser({
      email: fixture.managerEmail,
      password: fixture.managerPassword,
      role: "MANAGER",
      displayName: fixture.managerDisplayName
    }),
    createAuthUser({
      email: fixture.customerEmail,
      password: fixture.customerPassword,
      role: "CUSTOMER",
      displayName: fixture.customerDisplayName
    })
  ]);

  await client.query(
    `
      insert into public.organizations (id, name, status, updated_at)
      values ($1, $2, 'ACTIVE', now())
    `,
    [ids.organization, fixture.organization]
  );
  await client.query(
    `
      insert into public.users (id, auth_user_id, email, display_name, role, status, updated_at)
      values
        ($1, $2, $3, $4, 'MANAGER', 'ACTIVE', now()),
        ($5, $6, $7, $8, 'CUSTOMER', 'ACTIVE', now())
    `,
    [
      ids.managerUser,
      managerAuthUserId,
      fixture.managerEmail,
      fixture.managerDisplayName,
      ids.customerUser,
      customerAuthUserId,
      fixture.customerEmail,
      fixture.customerDisplayName
    ]
  );
  await client.query(
    `
      insert into public.organization_memberships (id, user_id, organization_id)
      values ($1, $2, $3), ($4, $5, $3)
    `,
    [
      ids.managerMembership,
      ids.managerUser,
      ids.organization,
      ids.customerMembership,
      ids.customerUser
    ]
  );

  return {
    managerAuthUserId,
    customerAuthUserId
  };
}

async function cleanupFixture(client, authUserIds) {
  await client.query(
    "delete from public.audit_logs where after->>'email' = $1 or before->>'email' = $1 or after->>'name' = $2",
    [fixture.forbiddenCustomerEmail, fixture.forbiddenOrganization]
  );
  await client.query("delete from public.organization_memberships where user_id in ($1, $2)", [
    ids.managerUser,
    ids.customerUser
  ]);
  await client.query("delete from public.users where id in ($1, $2) or email = $3", [
    ids.managerUser,
    ids.customerUser,
    fixture.forbiddenCustomerEmail
  ]);
  await client.query("delete from public.organizations where id = $1 or name = $2", [
    ids.organization,
    fixture.forbiddenOrganization
  ]);

  const admin = createAdmin();

  for (const authUserId of authUserIds.filter(Boolean)) {
    await admin.auth.admin.deleteUser(authUserId);
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
  return fetch(`${baseUrl}${path}`, {
    headers: {
      cookie: cookies
    },
    signal: AbortSignal.timeout(requestTimeout),
    redirect
  });
}

async function assertRedirect(path, cookies, expectedLocation) {
  const response = await fetchAuthed(path, cookies, "manual");
  const location = response.headers.get("location") ?? "";

  if (![303, 307, 308].includes(response.status) || !location.includes(expectedLocation)) {
    throw new Error(`${path} expected redirect to ${expectedLocation}, got status=${response.status} location=${location}`);
  }
}

async function postAuthed(path, form, cookies, refererPath) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    body: form,
    headers: {
      cookie: cookies,
      origin: baseUrl,
      referer: `${baseUrl}${refererPath}`
    },
    signal: AbortSignal.timeout(requestTimeout),
    redirect: "manual"
  });
}

async function assertForbiddenOrganizationAction(saCookies, managerCookies) {
  const response = await fetchAuthed("/admin/organizations", saCookies);
  const html = await response.text();
  const actionId = findServerActionId(html, "Sathorn Residence");
  const form = new FormData();
  form.set(actionId, "");
  form.set("name", fixture.forbiddenOrganization);

  const actionResponse = await postAuthed(
    "/admin/organizations",
    form,
    managerCookies,
    "/admin/organizations"
  );
  const location = actionResponse.headers.get("location") ?? "";

  if (![303, 307].includes(actionResponse.status) || !location.includes("/app")) {
    throw new Error(`Manager organization action was not blocked. status=${actionResponse.status} location=${location}`);
  }

  const created = await client.query(
    "select id from public.organizations where name = $1",
    [fixture.forbiddenOrganization]
  );

  if (created.rowCount) {
    throw new Error("Forbidden organization action created a row.");
  }
}

async function assertForbiddenUserAction(managerCookies, customerCookies) {
  const response = await fetchAuthed(
    `/app/users?organizationId=${ids.organization}`,
    managerCookies
  );
  const html = await response.text();
  const actionId = findServerActionId(html, 'name="email"');
  const form = new FormData();
  form.set(actionId, "");
  form.set("email", fixture.forbiddenCustomerEmail);
  form.set("displayName", "Forbidden Customer");
  form.set("role", "CUSTOMER");
  form.set("organizationIds", ids.organization);
  form.set("password", `Phase5Forbidden!${suffix}Aa`);

  const actionResponse = await postAuthed(
    "/app/users",
    form,
    customerCookies,
    `/app/users?organizationId=${ids.organization}`
  );
  const location = actionResponse.headers.get("location") ?? "";

  if (![303, 307].includes(actionResponse.status) || !location.includes("/app")) {
    throw new Error(`Customer user-management action was not blocked. status=${actionResponse.status} location=${location}`);
  }

  const created = await client.query("select id from public.users where email = $1", [
    fixture.forbiddenCustomerEmail
  ]);

  if (created.rowCount) {
    throw new Error("Forbidden customer user-management action created a row.");
  }
}

const client = new Client({ connectionString });

await client.connect();

let authUserIds = [];

try {
  const { managerAuthUserId, customerAuthUserId } = await createFixture(client);
  authUserIds = [managerAuthUserId, customerAuthUserId];

  const [saCookies, managerCookies, customerCookies] = await Promise.all([
    login(saEmail, saPassword),
    login(fixture.managerEmail, fixture.managerPassword),
    login(fixture.customerEmail, fixture.customerPassword)
  ]);

  const iamResponse = await fetchAuthed("/admin/iam", saCookies);
  const iamHtml = await iamResponse.text();

  if (!iamResponse.ok || !iamHtml.includes("users.manage.all")) {
    throw new Error("/admin/iam did not render the fixed permission map.");
  }

  await assertRedirect("/admin", managerCookies, "/app");
  await assertRedirect("/admin/iam", customerCookies, "/app");
  await assertRedirect("/app/users", customerCookies, "/app");
  await assertForbiddenOrganizationAction(saCookies, managerCookies);
  await assertForbiddenUserAction(managerCookies, customerCookies);

  console.log("PHASE5_RBAC_OK");
} finally {
  await cleanupFixture(client, authUserIds);
  await client.end();
}
