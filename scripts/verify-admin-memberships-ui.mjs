import { readFile } from "node:fs/promises";

const pagePath = "src/app/admin/memberships/page.tsx";
const assignmentPath = "src/app/admin/memberships/_components/membership-assignment-form.tsx";
const removeDialogPath = "src/app/admin/memberships/_components/membership-remove-dialog.tsx";
const organizationEditorPath = "src/app/admin/organizations/_components/organization-structure-editor.tsx";
const stylesPath = "src/app/globals.css";
const page = await readFile(pagePath, "utf8");
const assignment = await readFile(assignmentPath, "utf8");
const removeDialog = await readFile(removeDialogPath, "utf8");
const organizationEditor = await readFile(organizationEditorPath, "utf8");
const styles = await readFile(stylesPath, "utf8");

function assertIncludes(expected) {
  if (!page.includes(expected)) {
    throw new Error(`${pagePath} is missing ${expected}`);
  }
}

function assertExcludes(unexpected) {
  if (page.includes(unexpected)) {
    throw new Error(`${pagePath} still contains ${unexpected}`);
  }
}

for (const expected of [
  "Assigned memberships",
  "{memberships.length} memberships",
  "groupMembershipsByUser",
  "MembershipAssignmentForm",
  "MembershipGroupAccordion",
  "removeOrganizationMembership"
]) {
  assertIncludes(expected);
}

for (const unexpected of [
  "<Metric",
  "function Metric",
  "value={users.length}",
  "value={memberships.length}"
]) {
  assertExcludes(unexpected);
}

for (const expected of [
  '"use client"',
  "assignedOrganizationIds",
  "availableOrganizations",
  "organization.status === \"ACTIVE\"",
  "disabled={availableOrganizations.length === 0}"
]) {
  if (!assignment.includes(expected)) {
    throw new Error(`${assignmentPath} is missing ${expected}`);
  }
}

for (const expected of [
  '"use client"',
  "<dialog",
  "showModal()",
  "data-dialog-cancel",
  "Remove membership",
  "event.target === event.currentTarget",
  "event.currentTarget.close()"
]) {
  if (!removeDialog.includes(expected)) {
    throw new Error(`${removeDialogPath} is missing ${expected}`);
  }
}

for (const expected of [
  "event.target === event.currentTarget",
  "event.currentTarget.close()"
]) {
  if (!organizationEditor.includes(expected)) {
    throw new Error(`${organizationEditorPath} is missing ${expected}`);
  }
}

for (const expected of [
  '"use client"',
  "<button",
  "group.memberships.map",
  "useState(false)",
  "aria-expanded={isOpen}",
  "grid-rows-[0fr]",
  "grid-rows-[1fr]",
  "aria-hidden={!isOpen}",
  "inert={!isOpen}"
]) {
  const groupPath = "src/app/admin/memberships/_components/membership-group-accordion.tsx";
  const group = await readFile(groupPath, "utf8");
  if (!group.includes(expected)) {
    throw new Error(`${groupPath} is missing ${expected}`);
  }
}

for (const unexpected of ["<details", "<summary", "ResizeObserver", "scrollHeight"]) {
  const groupPath = "src/app/admin/memberships/_components/membership-group-accordion.tsx";
  const group = await readFile(groupPath, "utf8");
  if (group.includes(unexpected)) {
    throw new Error(`${groupPath} still contains ${unexpected}`);
  }
}

for (const expected of [
  "organization-confirm-dialog",
  "prefers-reduced-motion"
]) {
  if (!styles.includes(expected)) {
    throw new Error(`${stylesPath} is missing ${expected}`);
  }
}

console.log("ADMIN_MEMBERSHIPS_UI_OK");
