import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { Client } from "pg";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

const port = process.env.PORT ?? "3000";
const baseUrl = `http://127.0.0.1:${port}`;
const requestTimeout = 90_000;
const email = process.env.SEED_SA_EMAIL;
const password = process.env.SEED_SA_PASSWORD;
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!email || !password || !connectionString) {
  throw new Error("SEED_SA_EMAIL, SEED_SA_PASSWORD, and DIRECT_URL/DATABASE_URL are required.");
}

const ids = {
  user: randomUUID(),
  authUser: randomUUID(),
  organization: randomUUID(),
  suspendedOrganization: randomUUID()
};
const suffix = ids.user.slice(0, 8);
const fixture = {
  email: `phase3-member-${suffix}@example.test`,
  displayName: `Phase3 Member ${suffix}`,
  organization: `Phase3 Membership Org ${suffix}`,
  suspendedOrganization: `Phase3 Suspended Org ${suffix}`
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

async function createFixture(client) {
  await client.query(
    `
      insert into public.users (id, auth_user_id, email, display_name, role, status, updated_at)
      values ($1, $2, $3, $4, 'MANAGER', 'ACTIVE', now())
    `,
    [ids.user, ids.authUser, fixture.email, fixture.displayName]
  );
  await client.query(
    `
      insert into public.organizations (id, name, status, updated_at)
      values ($1, $2, 'ACTIVE', now()), ($3, $4, 'SUSPENDED', now())
    `,
    [
      ids.organization,
      fixture.organization,
      ids.suspendedOrganization,
      fixture.suspendedOrganization
    ]
  );
}

async function cleanupFixture(client, membershipId) {
  await client.query(
    `
      delete from public.audit_logs
      where entity_id = $1::uuid
         or after->>'userEmail' = $2
         or before->>'userEmail' = $2
    `,
    [membershipId ?? "00000000-0000-0000-0000-000000000000", fixture.email]
  );
  await client.query(
    "delete from public.organization_memberships where user_id = $1 or organization_id = $2",
    [ids.user, ids.organization]
  );
  await client.query("delete from public.users where id = $1", [ids.user]);
  await client.query(
    "delete from public.organizations where id = any($1::uuid[])",
    [[ids.organization, ids.suspendedOrganization]]
  );
}

async function login() {
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
    throw new Error(`Login did not set auth cookies. status=${response.status}`);
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

async function postAuthed(path, form, cookies, refererPath) {
  const response = await fetch(`${baseUrl}${path}`, {
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

  if (![303, 307].includes(response.status)) {
    throw new Error(`${path} Server Action returned ${response.status}`);
  }

  return response;
}

async function assignMembership(cookies) {
  const html = await fetchAuthed("/admin/memberships", cookies);
  const actionId = findServerActionId(html, fixture.email);
  const form = new FormData();
  form.set(actionId, "");
  form.set("userId", ids.user);
  form.set("organizationId", ids.organization);

  await postAuthed("/admin/memberships", form, cookies, "/admin/memberships");
}

async function verifySuspendedOrganizationRejected(cookies, client) {
  const html = await fetchAuthed("/admin/memberships", cookies);
  const actionId = findServerActionId(html, fixture.email);
  const form = new FormData();
  form.set(actionId, "");
  form.set("userId", ids.user);
  form.set("organizationId", ids.suspendedOrganization);

  const response = await postAuthed(
    "/admin/memberships",
    form,
    cookies,
    "/admin/memberships"
  );
  const location = response.headers.get("location") ?? "";

  if (!location.includes("error=invalid-membership")) {
    throw new Error(`Suspended organization assignment did not redirect to an error. location=${location}`);
  }

  const result = await client.query(
    `
      select id
      from public.organization_memberships
      where user_id = $1 and organization_id = $2
    `,
    [ids.user, ids.suspendedOrganization]
  );

  if (result.rowCount) {
    throw new Error("A suspended organization was assigned as a membership.");
  }
}

async function verifyAssigned(client) {
  const result = await client.query(
    `
      select id
      from public.organization_memberships
      where user_id = $1 and organization_id = $2
    `,
    [ids.user, ids.organization]
  );
  const membershipId = result.rows[0]?.id;

  if (!membershipId) {
    throw new Error("The membership was not assigned.");
  }

  const audit = await client.query(
    `
      select id
      from public.audit_logs
      where entity_id = $1 and action = 'membership.assign'
      limit 1
    `,
    [membershipId]
  );

  if (!audit.rowCount) {
    throw new Error("The membership.assign audit log was not written.");
  }

  return membershipId;
}

async function removeMembership(cookies, membershipId) {
  const html = await fetchAuthed("/admin/memberships", cookies);

  if (!html.includes(fixture.email) || !html.includes(fixture.organization)) {
    throw new Error("The assigned membership did not render on /admin/memberships.");
  }

  const actionId = findServerActionId(html, `value="${membershipId}"`);
  const form = new FormData();
  form.set(actionId, "");
  form.set("membershipId", membershipId);

  await postAuthed("/admin/memberships", form, cookies, "/admin/memberships");
}

async function verifyRemoved(client, membershipId) {
  const membership = await client.query(
    "select id from public.organization_memberships where id = $1",
    [membershipId]
  );

  if (membership.rowCount) {
    throw new Error("The membership was not removed.");
  }

  const audit = await client.query(
    `
      select id
      from public.audit_logs
      where entity_id = $1 and action = 'membership.remove'
      limit 1
    `,
    [membershipId]
  );

  if (!audit.rowCount) {
    throw new Error("The membership.remove audit log was not written.");
  }
}

const client = new Client({ connectionString });

await client.connect();

let membershipId;

try {
  await createFixture(client);
  const cookies = await login();
  await verifySuspendedOrganizationRejected(cookies, client);
  await assignMembership(cookies);
  membershipId = await verifyAssigned(client);
  await removeMembership(cookies, membershipId);
  await verifyRemoved(client, membershipId);

  console.log("PHASE3_MEMBERSHIPS_OK");
} finally {
  await cleanupFixture(client, membershipId);
  await client.end();
}
