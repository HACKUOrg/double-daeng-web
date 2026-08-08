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

const suffix = randomUUID().slice(0, 8);
const organizationName = `Phase2 Audit Org ${suffix}`;

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

async function createOrganizationThroughServerAction(cookies) {
  const html = await fetchAuthed("/admin/organizations", cookies);
  const actionId = findServerActionId(html, "Sathorn Residence");
  const form = new FormData();
  form.set(actionId, "");
  form.set("name", organizationName);

  const response = await fetch(`${baseUrl}/admin/organizations`, {
    method: "POST",
    body: form,
    headers: {
      cookie: cookies,
      origin: baseUrl,
      referer: `${baseUrl}/admin/organizations`
    },
    signal: AbortSignal.timeout(requestTimeout),
    redirect: "manual"
  });

  if (![303, 307].includes(response.status)) {
    throw new Error(`Create organization Server Action returned ${response.status}`);
  }
}

async function verifyAuditLog(client) {
  const organizationResult = await client.query(
    "select id from public.organizations where name = $1",
    [organizationName]
  );
  const organizationId = organizationResult.rows[0]?.id;

  if (!organizationId) {
    throw new Error("The organization was not created through the Server Action.");
  }

  const auditResult = await client.query(
    `
      select action, entity_type, entity_id, organization_id, actor_user_id, after
      from public.audit_logs
      where entity_id = $1 and action = 'organization.create'
      order by created_at desc
      limit 1
    `,
    [organizationId]
  );
  const audit = auditResult.rows[0];

  if (!audit) {
    throw new Error("The organization.create audit log was not written.");
  }

  if (audit.entity_type !== "organization") {
    throw new Error(`Unexpected audit entity_type: ${audit.entity_type}`);
  }

  if (audit.organization_id !== organizationId) {
    throw new Error("The audit log organization_id does not match the created organization.");
  }

  if (!audit.actor_user_id) {
    throw new Error("The audit log is missing actor_user_id.");
  }

  if (audit.after?.name !== organizationName) {
    throw new Error("The audit log after snapshot does not include the organization name.");
  }

  return organizationId;
}

async function cleanup(client, organizationId) {
  const ids = organizationId
    ? [organizationId]
    : (
        await client.query(
          "select id from public.organizations where name = $1",
          [organizationName]
        )
      ).rows.map((row) => row.id);

  if (ids.length) {
    await client.query("delete from public.audit_logs where entity_id = any($1::uuid[])", [
      ids
    ]);
    await client.query("delete from public.organizations where id = any($1::uuid[])", [
      ids
    ]);
  }

  await client.query(
    "delete from public.organizations where name = $1",
    [organizationName]
  );
}

const client = new Client({ connectionString });

await client.connect();

let organizationId;

try {
  const cookies = await login();
  await createOrganizationThroughServerAction(cookies);
  organizationId = await verifyAuditLog(client);

  console.log("PHASE2_AUDIT_OK");
} finally {
  await cleanup(client, organizationId);
  await client.end();
}
