import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

const port = process.env.PORT ?? "3000";
const baseUrl = `http://127.0.0.1:${port}`;
const requestTimeout = 90_000;
const email = process.env.SEED_SA_EMAIL;
const password = process.env.SEED_SA_PASSWORD;

if (!email) {
  throw new Error("SEED_SA_EMAIL is required for login verification.");
}

if (!password) {
  throw new Error("SEED_SA_PASSWORD is required for login verification.");
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

console.log("ADMIN_LOGIN_STEP=fetch_login_page");
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

console.log("ADMIN_LOGIN_STEP=post_login");
const loginResponse = await fetch(`${baseUrl}/login`, {
  method: "POST",
  body: form,
  headers: {
    origin: baseUrl,
    referer: `${baseUrl}/login`
  },
  signal: AbortSignal.timeout(requestTimeout),
  redirect: "manual"
});

const cookies = getSetCookies(loginResponse.headers);

if (!cookies.length) {
  const location = loginResponse.headers.get("location") ?? "";
  throw new Error(`Login did not set auth cookies. status=${loginResponse.status} location=${location}`);
}

console.log("ADMIN_LOGIN_STEP=fetch_admin");
const adminResponse = await fetch(`${baseUrl}/admin`, {
  headers: {
    cookie: cookieHeader(cookies)
  },
  signal: AbortSignal.timeout(requestTimeout),
  redirect: "manual"
});

const adminHtml = await adminResponse.text();

if (!adminResponse.ok || !adminHtml.includes("System Admin")) {
  throw new Error(`/admin was not accessible after login. status=${adminResponse.status}`);
}

console.log("ADMIN_LOGIN_OK");
