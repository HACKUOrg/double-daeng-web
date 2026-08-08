const port = process.env.PORT ?? "3000";
const baseUrl = `http://127.0.0.1:${port}`;

const login = await fetch(`${baseUrl}/login`, { redirect: "manual" });
const loginHtml = await login.text();

if (!login.ok) {
  throw new Error(`/login returned ${login.status}`);
}

for (const expected of ["double-daeng-web", 'name="email"', 'name="password"']) {
  if (!loginHtml.includes(expected)) {
    throw new Error(`/login is missing ${expected}`);
  }
}

const admin = await fetch(`${baseUrl}/admin`, { redirect: "manual" });
const location = admin.headers.get("location") ?? "";

if (![303, 307, 308].includes(admin.status) || !location.includes("/login")) {
  throw new Error(`/admin did not redirect to login. status=${admin.status} location=${location}`);
}

console.log("AUTH_SMOKE_OK");
