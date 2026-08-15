import { readFile } from "node:fs/promises";

const files = {
  registry: "src/app/admin/users/page.tsx",
  form: "src/app/admin/users/_components/managed-user-form.tsx",
  ui: "src/app/admin/users/_components/user-ui.tsx",
  create: "src/app/admin/users/new/page.tsx",
  detail: "src/app/admin/users/[userId]/page.tsx",
  actions: "src/app/users/actions.ts",
  appUsers: "src/app/app/users/page.tsx"
};

const sources = Object.fromEntries(
  await Promise.all(
    Object.entries(files).map(async ([key, path]) => [key, await readFile(path, "utf8")])
  )
);

function assertIncludes(source, expected, label) {
  if (!source.includes(expected)) {
    throw new Error(`${label} is missing ${expected}`);
  }
}

function assertExcludes(source, unexpected, label) {
  if (source.includes(unexpected)) {
    throw new Error(`${label} still contains ${unexpected}`);
  }
}

for (const expected of [
  "User registry",
  "{managedUsers.length} users",
  "/admin/users/new",
  "href={`/admin/users/${user.id}`}",
  "hover:border-primary/40",
  "UserStatusPill"
]) {
  assertIncludes(sources.registry, expected, files.registry);
}

for (const unexpected of [
  "<form",
  "createManagedUser",
  "updateManagedUser",
  "resetManagedUserPassword",
  "organizationIds",
  "organizations"
]) {
  assertExcludes(sources.registry, unexpected, files.registry);
}

for (const expected of [
  "mode: \"create\" | \"edit\"",
  "name=\"email\"",
  "name=\"displayName\"",
  "name=\"role\"",
  "name=\"status\"",
  "name=\"password\"",
  "readOnly={isEdit}",
  "required={!isEdit}",
  "Leave blank to keep current",
  "Save changes",
  "Create user"
]) {
  assertIncludes(sources.form, expected, files.form);
}

assertExcludes(sources.form, "organizationIds", files.form);

for (const expected of [
  "ManagedUserForm",
  "createAdminManagedUser",
  "UserStatusBanner"
]) {
  assertIncludes(sources.create, expected, files.create);
}

for (const expected of [
  "ManagedUserForm",
  "updateAdminManagedUser",
  "Organization memberships",
  "/admin/memberships",
  "Read-only here"
]) {
  assertIncludes(sources.detail, expected, files.detail);
}

for (const expected of [
  "createAdminManagedUser",
  "updateAdminManagedUser",
  "requirePermission(\"users.manage.all\")",
  "organizationId: null",
  "status: \"ACTIVE\"",
  "memberships: {"
]) {
  assertIncludes(sources.actions, expected, files.actions);
}

const createAdminAction = sources.actions.slice(
  sources.actions.indexOf("export async function createAdminManagedUser"),
  sources.actions.indexOf("export async function updateAdminManagedUser")
);
const updateAdminAction = sources.actions.slice(
  sources.actions.indexOf("export async function updateAdminManagedUser"),
  sources.actions.indexOf("export async function createManagedUser")
);

for (const [source, label] of [
  [createAdminAction, "createAdminManagedUser"],
  [updateAdminAction, "updateAdminManagedUser"]
]) {
  assertExcludes(source, "organizationIds", label);
  assertExcludes(source, "organizationMembership", label);
}

for (const expected of [
  "organizationIds",
  "createManagedUser",
  "updateManagedUser",
  "users.manage.organization"
]) {
  assertIncludes(sources.appUsers, expected, files.appUsers);
}

console.log("ADMIN_USERS_UI_OK");
