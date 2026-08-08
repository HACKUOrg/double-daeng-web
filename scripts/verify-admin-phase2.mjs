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
  organization: randomUUID(),
  asset: randomUUID(),
  building: randomUUID(),
  floor: randomUUID(),
  room: randomUUID()
};

const suffix = ids.organization.slice(0, 8);
const fixture = {
  organization: `Phase2 Test Org ${suffix}`,
  asset: `Phase2 Asset ${suffix}`,
  building: `Phase2 Building ${suffix}`,
  floor: `Phase2 Floor ${suffix}`,
  room: `P2-${suffix}`
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

async function createFixture(client) {
  await client.query(
    `
      insert into public.organizations (id, name, status, updated_at)
      values ($1, $2, 'ACTIVE', now())
    `,
    [ids.organization, fixture.organization]
  );
  await client.query(
    `
      insert into public.assets (id, organization_id, name, type, status, updated_at)
      values ($1, $2, $3, 'DORMITORY', 'ACTIVE', now())
    `,
    [ids.asset, ids.organization, fixture.asset]
  );
  await client.query(
    `
      insert into public.buildings (id, asset_id, name, updated_at)
      values ($1, $2, $3, now())
    `,
    [ids.building, ids.asset, fixture.building]
  );
  await client.query(
    `
      insert into public.floors (id, building_id, name, number, updated_at)
      values ($1, $2, $3, 1, now())
    `,
    [ids.floor, ids.building, fixture.floor]
  );
  await client.query(
    `
      insert into public.rooms (id, floor_id, room_number, status, updated_at)
      values ($1, $2, $3, 'VACANT', now())
    `,
    [ids.room, ids.floor, fixture.room]
  );
}

async function cleanupFixture(client) {
  await client.query("delete from public.organizations where id = $1", [
    ids.organization
  ]);
}

async function login() {
  const loginPage = await fetch(`${baseUrl}/login`, {
    signal: AbortSignal.timeout(requestTimeout)
  });
  const loginHtml = await loginPage.text();
  const actionId = loginHtml.match(/name="(\$ACTION_ID_[^"]+)"/)?.[1];

  if (!actionId) {
    throw new Error("Could not find the login Server Action id.");
  }

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

const client = new Client({ connectionString });

await client.connect();

try {
  await createFixture(client);
  const cookies = await login();
  const listHtml = await fetchAuthed("/admin/organizations", cookies);
  const detailHtml = await fetchAuthed(
    `/admin/organizations/${ids.organization}`,
    cookies
  );

  for (const expected of [fixture.organization, "Organization registry"]) {
    if (!listHtml.includes(expected)) {
      throw new Error(`/admin/organizations is missing ${expected}`);
    }
  }

  for (const expected of [
    fixture.organization,
    fixture.asset,
    fixture.building,
    fixture.floor,
    fixture.room,
    "Create asset"
  ]) {
    if (!detailHtml.includes(expected)) {
      throw new Error(`/admin/organizations/[id] is missing ${expected}`);
    }
  }

  console.log("ADMIN_PHASE2_OK");
} finally {
  await cleanupFixture(client);
  await client.end();
}
