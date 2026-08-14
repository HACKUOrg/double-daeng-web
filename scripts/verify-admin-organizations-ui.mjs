import { readFile } from "node:fs/promises";

const files = {
  actions: "src/app/admin/organizations/actions.ts",
  editor:
    "src/app/admin/organizations/_components/organization-structure-editor.tsx",
  detail: "src/app/admin/organizations/[organizationId]/page.tsx",
  list: "src/app/admin/organizations/page.tsx",
  newPage: "src/app/admin/organizations/new/page.tsx"
};

async function read(path) {
  return readFile(path, "utf8");
}

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

const [actions, editor, detail, list, newPage] = await Promise.all([
  read(files.actions),
  read(files.editor),
  read(files.detail),
  read(files.list),
  read(files.newPage)
]);

for (const expected of [
  "Organization registry",
  "{organizations.length} Organizations",
  "/admin/organizations/new",
  "hover:border-primary/40",
  "href={`/admin/organizations/${organization.id}`}"
]) {
  assertIncludes(list, expected, files.list);
}

for (const unexpected of [
  "Create organization",
  "updateOrganization",
  "deleteOrganization",
  "statusOptions",
  "label=\"Active\""
]) {
  assertExcludes(list, unexpected, files.list);
}

for (const expected of [
  "OrganizationStructureEditor",
  "organizationToStructureDraft"
]) {
  assertIncludes(detail, expected, files.detail);
}

for (const expected of [
  "OrganizationStructureEditor",
  "createEmptyOrganizationDraft"
]) {
  assertIncludes(newPage, expected, files.newPage);
}

for (const expected of [
  "Unsaved changes",
  "Save changes",
  "Cancel",
  "Delete organization",
  "DeleteMenu",
  "ConfirmationDialog",
  "showModal()",
  "<dialog",
  "Duplicate",
  "duplicateAsset",
  "duplicateBuilding",
  "duplicateFloor",
  "duplicateRoom",
  "Remove from draft",
  'aria-haspopup="menu"',
  "No assets yet",
  "Create asset",
  "Add building",
  "Add floor",
  "Add room",
  "delete-organization-form"
]) {
  assertIncludes(editor, expected, files.editor);
}

for (const unexpected of [
  "action={updateAsset}",
  "action={updateBuilding}",
  "action={updateFloor}",
  "action={updateRoom}",
  "action={createAsset}",
  "action={createBuilding}",
  "action={createFloor}",
  "action={createRoom}",
  "Delete asset",
  "Delete building",
  "Delete floor",
  "Delete room",
  "window.confirm"
]) {
  assertExcludes(editor, unexpected, files.editor);
}

for (const expected of [
  "saveOrganizationStructureDraft",
  "structureDraftSchema",
  "validateDraftUniqueness",
  "prisma.$transaction",
  "room.delete",
  "floor.delete",
  "building.delete",
  "asset.delete",
  "organization.create"
]) {
  assertIncludes(actions, expected, files.actions);
}

console.log("ADMIN_ORGANIZATIONS_UI_OK");
