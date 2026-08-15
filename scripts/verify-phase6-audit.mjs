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
  organization: randomUUID(),
  auditOne: randomUUID(),
  auditTwo: randomUUID(),
  managerUser: randomUUID()
};
const suffix = ids.organization.slice(0, 8);
const fixture = {
  action: `phase6.audit_fixture.${suffix}`,
  secondaryAction: `phase6.audit_secondary.${suffix}`,
  entityType: "phase6_fixture",
  organization: `Phase6 Audit Org ${suffix}`,
  managerEmail: `phase6-manager-${suffix}@example.test`,
  managerPassword: `Phase6Manager!${suffix}Aa`,
  managerDisplayName: `Phase6 Manager ${suffix}`
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

async function createFixture(client) {
  const saResult = await client.query(
    "select id from public.users where email = $1 and role = 'SA' and status = 'ACTIVE'",
    [saEmail]
  );
  const saUser = saResult.rows[0];

  if (!saUser) {
    throw new Error("Seed SA app profile was not found.");
  }

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
  const managerAuthUserId = data.user?.id;

  if (error || !managerAuthUserId) {
    throw new Error(`Could not create fixture manager: ${error?.message ?? "missing user"}`);
  }

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
      values ($1, $2, $3, $4, 'MANAGER', 'ACTIVE', now())
    `,
    [
      ids.managerUser,
      managerAuthUserId,
      fixture.managerEmail,
      fixture.managerDisplayName
    ]
  );
  await client.query(
    `
      insert into public.audit_logs
        (id, actor_user_id, action, entity_type, entity_id, organization_id, before, after)
      values
        ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb),
        ($9, $2, $10, $4, $5, $6, null, $11::jsonb)
    `,
    [
      ids.auditOne,
      saUser.id,
      fixture.action,
      fixture.entityType,
      ids.organization,
      ids.organization,
      JSON.stringify({ name: "Before Audit Fixture" }),
      JSON.stringify({ name: fixture.organization, status: "ACTIVE" }),
      ids.auditTwo,
      fixture.secondaryAction,
      JSON.stringify({ name: "Secondary Fixture" })
    ]
  );

  return managerAuthUserId;
}

async function cleanupFixture(client, managerAuthUserId) {
  await client.query("delete from public.audit_logs where id in ($1, $2)", [
    ids.auditOne,
    ids.auditTwo
  ]);
  await client.query("delete from public.users where id = $1", [ids.managerUser]);
  await client.query("delete from public.organizations where id = $1", [
    ids.organization
  ]);

  if (managerAuthUserId) {
    await createAdmin().auth.admin.deleteUser(managerAuthUserId);
  }
}

async function assertAuditPage(cookies) {
  const response = await fetchAuthed("/admin/audit", cookies);
  const html = await response.text();

  if (!response.ok) {
    throw new Error(`/admin/audit returned ${response.status}`);
  }

  for (const expected of [
    "Audit log",
    fixture.action,
    fixture.secondaryAction,
    fixture.entityType,
    fixture.organization,
    "Before",
    "After"
  ]) {
    if (!html.includes(expected)) {
      throw new Error(`/admin/audit did not include expected text: ${expected}`);
    }
  }
}

async function assertFilteredAuditPage(cookies) {
  const params = new URLSearchParams({
    action: fixture.action,
    entityType: fixture.entityType,
    organizationId: ids.organization,
    q: fixture.action
  });
  const response = await fetchAuthed(`/admin/audit?${params}`, cookies);
  const html = await response.text();

  if (!response.ok) {
    throw new Error(`/admin/audit filtered returned ${response.status}`);
  }

  if (!html.includes(fixture.action)) {
    throw new Error("Filtered audit page did not include the selected action.");
  }

  const resultRows = html.split("Recent activity").at(-1) ?? html;
  if (resultRows.includes(fixture.secondaryAction)) {
    throw new Error("Filtered audit page included a non-matching action.");
  }
}

async function assertPaginationPage(cookies) {
  const response = await fetchAuthed("/admin/audit?page=1&limit=10", cookies);
  const html = await response.text();

  if (!response.ok) {
    throw new Error("/admin/audit pagination returned " + response.status);
  }

  for (const expected of [
    "Page 1 of",
    'name="page" value="1"',
    'name="limit" value="10"'
  ]) {
    if (!html.includes(expected)) {
      throw new Error("/admin/audit pagination did not include: " + expected);
    }
  }

  const secondPage = await fetchAuthed("/admin/audit?page=2&limit=10", cookies);
  if (!secondPage.ok) {
    throw new Error("/admin/audit second page returned " + secondPage.status);
  }
}

async function assertForbiddenAuditPage(cookies) {
  const response = await fetchAuthed("/admin/audit", cookies, "manual");
  const location = response.headers.get("location") ?? "";

  if (![303, 307, 308].includes(response.status) || !location.includes("/app")) {
    throw new Error(`Manager audit page was not blocked. status=${response.status} location=${location}`);
  }
}

const client = new Client({ connectionString });

await client.connect();

let managerAuthUserId;

try {
  managerAuthUserId = await createFixture(client);
  const [saCookies, managerCookies] = await Promise.all([
    login(saEmail, saPassword),
    login(fixture.managerEmail, fixture.managerPassword)
  ]);

  await assertAuditPage(saCookies);
  await assertFilteredAuditPage(saCookies);
  await assertPaginationPage(saCookies);
  await assertForbiddenAuditPage(managerCookies);

  console.log("PHASE6_AUDIT_OK");
} finally {
  await cleanupFixture(client, managerAuthUserId);
  await client.end();
}
