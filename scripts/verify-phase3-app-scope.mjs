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
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const allowSeedSaRoleFlip = process.env.PHASE3_ALLOW_SEED_SA_ROLE_FLIP === "1";
const appEmail = process.env.PHASE3_APP_EMAIL ?? (allowSeedSaRoleFlip ? process.env.SEED_SA_EMAIL : undefined);
const appPassword = process.env.PHASE3_APP_PASSWORD ?? (allowSeedSaRoleFlip ? process.env.SEED_SA_PASSWORD : undefined);
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!supabaseUrl || !publishableKey || !connectionString) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, and DIRECT_URL/DATABASE_URL are required.");
}

if (!appEmail || !appPassword) {
  throw new Error("PHASE3_APP_EMAIL and PHASE3_APP_PASSWORD are required for /app E2E scope verification. Alternatively set PHASE3_ALLOW_SEED_SA_ROLE_FLIP=1 to use the seed SA account temporarily.");
}

const ids = {
  user: randomUUID(),
  membership: randomUUID(),
  allowedOrganization: randomUUID(),
  blockedOrganization: randomUUID(),
  asset: randomUUID()
};
const suffix = ids.user.slice(0, 8);
const fixture = {
  displayName: `Phase3 App User ${suffix}`,
  allowedOrganization: `Phase3 Allowed Org ${suffix}`,
  blockedOrganization: `Phase3 Blocked Org ${suffix}`,
  asset: `Phase3 Scoped Asset ${suffix}`
};

let fixtureUserId = ids.user;
let createdFixtureUser = false;
let backupProfile;

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

async function getAuthUserId() {
  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false }
  });
  const { data, error } = await supabase.auth.signInWithPassword({
    email: appEmail,
    password: appPassword
  });

  if (error || !data.user?.id) {
    throw new Error(`PHASE3_APP_EMAIL login failed: ${error?.message ?? "missing user"}`);
  }

  await supabase.auth.signOut();
  return data.user.id;
}

async function createFixture(client, authUserId) {
  const existing = await client.query(
    `
      select id, auth_user_id, email, display_name, role, status
      from public.users
      where auth_user_id = $1 or email = $2
    `,
    [authUserId, appEmail]
  );

  if (existing.rowCount && !allowSeedSaRoleFlip) {
    throw new Error("Use a dedicated PHASE3_APP_EMAIL without an existing app profile.");
  }

  if (allowSeedSaRoleFlip) {
    const existingProfile = existing.rows[0];

    if (!existingProfile || existingProfile.role !== "SA") {
      throw new Error("PHASE3_ALLOW_SEED_SA_ROLE_FLIP requires the selected auth user to have an SA app profile.");
    }

    backupProfile = existingProfile;
    fixtureUserId = existingProfile.id;

    await client.query(
      `
        update public.users
        set role = 'MANAGER',
            status = 'ACTIVE',
            display_name = $2,
            updated_at = now()
        where id = $1
      `,
      [fixtureUserId, fixture.displayName]
    );
  } else {
    await client.query(
      `
        insert into public.users (id, auth_user_id, email, display_name, role, status, updated_at)
        values ($1, $2, $3, $4, 'MANAGER', 'ACTIVE', now())
      `,
      [ids.user, authUserId, appEmail, fixture.displayName]
    );
    createdFixtureUser = true;
  }

  await client.query(
    `
      insert into public.organizations (id, name, status, updated_at)
      values ($1, $2, 'ACTIVE', now()), ($3, $4, 'ACTIVE', now())
    `,
    [
      ids.allowedOrganization,
      fixture.allowedOrganization,
      ids.blockedOrganization,
      fixture.blockedOrganization
    ]
  );
  await client.query(
    `
      insert into public.assets (id, organization_id, name, type, status, updated_at)
      values ($1, $2, $3, 'DORMITORY', 'ACTIVE', now())
    `,
    [ids.asset, ids.allowedOrganization, fixture.asset]
  );
  await client.query(
    `
      insert into public.organization_memberships (id, user_id, organization_id)
      values ($1, $2, $3)
    `,
    [ids.membership, fixtureUserId, ids.allowedOrganization]
  );
}

async function cleanupFixture(client) {
  await client.query(
    `
      delete from public.organization_memberships
      where user_id = $1
        and organization_id = any($2::uuid[])
    `,
    [fixtureUserId, [ids.allowedOrganization, ids.blockedOrganization]]
  );
  await client.query("delete from public.assets where id = $1", [ids.asset]);
  await client.query(
    "delete from public.organizations where id = any($1::uuid[])",
    [[ids.allowedOrganization, ids.blockedOrganization]]
  );
  if (createdFixtureUser) {
    await client.query("delete from public.users where id = $1", [fixtureUserId]);
  }

  if (backupProfile) {
    await client.query(
      `
        update public.users
        set auth_user_id = $2,
            email = $3,
            display_name = $4,
            role = $5,
            status = $6,
            updated_at = now()
        where id = $1
      `,
      [
        backupProfile.id,
        backupProfile.auth_user_id,
        backupProfile.email,
        backupProfile.display_name,
        backupProfile.role,
        backupProfile.status
      ]
    );

    const restored = await client.query(
      "select role, status from public.users where id = $1",
      [backupProfile.id]
    );
    const restoredProfile = restored.rows[0];

    if (
      restoredProfile?.role !== backupProfile.role ||
      restoredProfile?.status !== backupProfile.status
    ) {
      throw new Error("Failed to restore the seed SA app profile after Phase 3 /app scope verification.");
    }
  }
}

async function loginThroughApp() {
  const loginPage = await fetch(`${baseUrl}/login`, {
    signal: AbortSignal.timeout(requestTimeout)
  });
  const loginHtml = await loginPage.text();
  const actionId = findServerActionId(loginHtml, "password");
  const form = new FormData();
  form.set(actionId, "");
  form.set("email", appEmail);
  form.set("password", appPassword);

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

async function verifyAllowedScope(cookies) {
  const response = await fetch(
    `${baseUrl}/app?organizationId=${ids.allowedOrganization}`,
    {
      headers: { cookie: cookies },
      signal: AbortSignal.timeout(requestTimeout)
    }
  );
  const html = await response.text();

  if (!response.ok) {
    throw new Error(`/app allowed scope returned ${response.status}`);
  }

  for (const expected of [fixture.allowedOrganization, "Assets", "1"]) {
    if (!html.includes(expected)) {
      throw new Error(`/app allowed scope is missing ${expected}`);
    }
  }

  if (html.includes(fixture.blockedOrganization)) {
    throw new Error("/app leaked an organization outside the user's membership.");
  }
}

async function verifyBlockedScope(cookies) {
  const response = await fetch(
    `${baseUrl}/app?organizationId=${ids.blockedOrganization}`,
    {
      headers: { cookie: cookies },
      signal: AbortSignal.timeout(requestTimeout),
      redirect: "manual"
    }
  );
  const location = response.headers.get("location") ?? "";

  if (![303, 307].includes(response.status) || !location.includes("organization-scope")) {
    throw new Error(`Blocked scope did not redirect safely. status=${response.status} location=${location}`);
  }
}

const client = new Client({ connectionString });

await client.connect();

try {
  const authUserId = await getAuthUserId();
  await createFixture(client, authUserId);
  const cookies = await loginThroughApp();
  await verifyAllowedScope(cookies);
  await verifyBlockedScope(cookies);

  console.log("PHASE3_APP_SCOPE_OK");
} finally {
  await cleanupFixture(client);
  await client.end();
}
