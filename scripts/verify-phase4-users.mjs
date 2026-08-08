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
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (
  !saEmail ||
  !saPassword ||
  !supabaseUrl ||
  !publishableKey ||
  !secretKey ||
  !connectionString
) {
  throw new Error("SEED_SA_EMAIL, SEED_SA_PASSWORD, Supabase URL/key, SUPABASE_SECRET_KEY, and DIRECT_URL/DATABASE_URL are required.");
}

const ids = {
  organization: randomUUID()
};
const suffix = ids.organization.slice(0, 8);
const fixture = {
  email: `phase4-user-${suffix}@example.test`,
  displayName: `Phase4 User ${suffix}`,
  updatedDisplayName: `Phase4 Updated ${suffix}`,
  organization: `Phase4 User Org ${suffix}`,
  password: `Phase4!${suffix}Aa`,
  activatedPassword: `Phase4Active!${suffix}Aa`,
  resetPassword: `Phase4Reset!${suffix}Aa`
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
      insert into public.organizations (id, name, status, updated_at)
      values ($1, $2, 'ACTIVE', now())
    `,
    [ids.organization, fixture.organization]
  );
}

async function cleanupFixture(client, authUserId, appUserId) {
  if (appUserId) {
    await client.query(
      "delete from public.audit_logs where entity_id = $1 or after->>'email' = $2 or before->>'email' = $2",
      [appUserId, fixture.email]
    );
    await client.query("delete from public.organization_memberships where user_id = $1", [
      appUserId
    ]);
    await client.query("delete from public.users where id = $1", [appUserId]);
  } else {
    await client.query("delete from public.users where email = $1", [
      fixture.email
    ]);
  }

  await client.query("delete from public.organizations where id = $1", [
    ids.organization
  ]);

  if (authUserId) {
    const admin = createClient(supabaseUrl, secretKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false
      }
    });
    await admin.auth.admin.deleteUser(authUserId);
  }
}

async function loginSA() {
  const loginPage = await fetch(`${baseUrl}/login`, {
    signal: AbortSignal.timeout(requestTimeout)
  });
  const loginHtml = await loginPage.text();
  const actionId = findServerActionId(loginHtml, "password");
  const form = new FormData();
  form.set(actionId, "");
  form.set("email", saEmail);
  form.set("password", saPassword);

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

async function createUser(cookies) {
  const html = await fetchAuthed("/admin/users", cookies);
  const actionId = findServerActionId(html, "manager@example.com");
  const form = new FormData();
  form.set(actionId, "");
  form.set("email", fixture.email);
  form.set("displayName", fixture.displayName);
  form.set("role", "OPERATION");
  form.set("organizationIds", ids.organization);
  form.set("password", fixture.password);

  await postAuthed("/admin/users", form, cookies, "/admin/users");
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

async function getAuthUser(authUserId) {
  const admin = createAdmin();
  const { data, error } = await admin.auth.admin.getUserById(authUserId);

  if (error || !data.user) {
    throw new Error(`Could not load auth user: ${error?.message ?? "missing user"}`);
  }

  return data.user;
}

async function assertAuthMetadata(authUserId, expected) {
  const authUser = await getAuthUser(authUserId);

  if (
    authUser.app_metadata?.role !== expected.role ||
    authUser.app_metadata?.status !== expected.status ||
    authUser.user_metadata?.display_name !== expected.displayName
  ) {
    throw new Error("Supabase Auth metadata was not synced with the app profile.");
  }
}

async function assertPasswordSignIn(password, shouldSucceed) {
  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false
    }
  });
  const { error } = await supabase.auth.signInWithPassword({
    email: fixture.email,
    password
  });

  if (shouldSucceed && error) {
    throw new Error(`Expected sign-in to succeed: ${error.message}`);
  }

  if (!shouldSucceed && !error) {
    await supabase.auth.signOut();
    throw new Error("Suspended user could still sign in.");
  }

  await supabase.auth.signOut();
}

async function verifyCreated(client) {
  const userResult = await client.query(
    `
      select id, auth_user_id, role, status
      from public.users
      where email = $1
    `,
    [fixture.email]
  );
  const user = userResult.rows[0];

  if (!user || user.role !== "OPERATION" || user.status !== "ACTIVE") {
    throw new Error("Managed user was not created with the expected role/status.");
  }

  const membership = await client.query(
    "select id from public.organization_memberships where user_id = $1 and organization_id = $2",
    [user.id, ids.organization]
  );

  if (!membership.rowCount) {
    throw new Error("Managed user membership was not created.");
  }

  const audit = await client.query(
    "select id from public.audit_logs where entity_id = $1 and action = 'user.create'",
    [user.id]
  );

  if (!audit.rowCount) {
    throw new Error("user.create audit log was not written.");
  }

  return {
    appUserId: user.id,
    authUserId: user.auth_user_id
  };
}

async function updateUser(cookies, appUserId) {
  await updateUserStatus(cookies, appUserId, "SUSPENDED");
}

async function updateUserStatus(cookies, appUserId, status) {
  const html = await fetchAuthed("/admin/users", cookies);
  const actionId = findServerActionId(html, `value="${appUserId}"`);
  const form = new FormData();
  form.set(actionId, "");
  form.set("userId", appUserId);
  form.set("displayName", fixture.updatedDisplayName);
  form.set("role", "CUSTOMER");
  form.set("status", status);
  form.set("organizationIds", ids.organization);

  await postAuthed("/admin/users", form, cookies, "/admin/users");
}

async function verifyUpdated(client, appUserId) {
  const userResult = await client.query(
    "select display_name, role, status from public.users where id = $1",
    [appUserId]
  );
  const user = userResult.rows[0];

  if (
    !user ||
    user.display_name !== fixture.updatedDisplayName ||
    user.role !== "CUSTOMER" ||
    user.status !== "SUSPENDED"
  ) {
    throw new Error("Managed user was not updated with the expected data.");
  }

  const audit = await client.query(
    "select id from public.audit_logs where entity_id = $1 and action = 'user.update'",
    [appUserId]
  );

  if (!audit.rowCount) {
    throw new Error("user.update audit log was not written.");
  }
}

async function resetPassword(cookies, appUserId) {
  const html = await fetchAuthed("/admin/users", cookies);
  const forms = html.match(/<form\b[\s\S]*?<\/form>/g) ?? [];
  const resetForm = forms.find(
    (form) => form.includes(`value="${appUserId}"`) && form.includes("Reset password")
  );
  const actionId = resetForm?.match(/name="(\$ACTION_ID_[^"]+)"/)?.[1];

  if (!actionId) {
    throw new Error("Could not find reset password Server Action id.");
  }

  const form = new FormData();
  form.set(actionId, "");
  form.set("userId", appUserId);
  form.set("password", fixture.resetPassword);

  await postAuthed("/admin/users", form, cookies, "/admin/users");
}

async function verifyPasswordReset(client, appUserId) {
  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false
    }
  });
  const { error } = await supabase.auth.signInWithPassword({
    email: fixture.email,
    password: fixture.resetPassword
  });

  if (error) {
    throw new Error(`Reset password did not work: ${error.message}`);
  }

  await supabase.auth.signOut();

  const audit = await client.query(
    "select id from public.audit_logs where entity_id = $1 and action = 'user.password_reset'",
    [appUserId]
  );

  if (!audit.rowCount) {
    throw new Error("user.password_reset audit log was not written.");
  }
}

const client = new Client({ connectionString });

await client.connect();

let appUserId;
let authUserId;

try {
  await createFixture(client);
  const cookies = await loginSA();
  await createUser(cookies);
  ({ appUserId, authUserId } = await verifyCreated(client));
  await assertAuthMetadata(authUserId, {
    displayName: fixture.displayName,
    role: "OPERATION",
    status: "ACTIVE"
  });
  await updateUser(cookies, appUserId);
  await verifyUpdated(client, appUserId);
  await assertAuthMetadata(authUserId, {
    displayName: fixture.updatedDisplayName,
    role: "CUSTOMER",
    status: "SUSPENDED"
  });
  await assertPasswordSignIn(fixture.password, false);
  await updateUserStatus(cookies, appUserId, "ACTIVE");
  await assertAuthMetadata(authUserId, {
    displayName: fixture.updatedDisplayName,
    role: "CUSTOMER",
    status: "ACTIVE"
  });
  await assertPasswordSignIn(fixture.password, true);
  await resetPassword(cookies, appUserId);
  await verifyPasswordReset(client, appUserId);

  console.log("PHASE4_USERS_OK");
} finally {
  await cleanupFixture(client, authUserId, appUserId);
  await client.end();
}
