import { readFile } from "node:fs/promises";

const pagePath = "src/app/admin/audit/page.tsx";
const filterPath = "src/app/admin/audit/audit-filter-panel.tsx";
const rowPath = "src/app/admin/audit/audit-log-row-accordion.tsx";

const [page, filter, row] = await Promise.all([
  readFile(pagePath, "utf8"),
  readFile(filterPath, "utf8"),
  readFile(rowPath, "utf8")
]);

for (const unexpected of ["function Metric", "<Metric"]) {
  if (page.includes(unexpected)) {
    throw new Error(`Audit page still contains ${unexpected}.`);
  }
}

for (const expected of [
  "page?: string",
  "limit?: string",
  "prisma.auditLog.count",
  "skip:",
  "take: params.limit",
  "createdAt: \"desc\"",
  "id: \"desc\"",
  "Recent activity",
  "AuditFilterPanel",
  "AuditPagination",
  "Rows per page",
  "hrefForLimit",
  "Showing {firstItem}–{lastItem} of {totalCount}"
]) {
  if (!page.includes(expected)) {
    throw new Error(`Audit page is missing expected implementation: ${expected}`);
  }
}

for (const expected of [
  "\"use client\"",
  "aria-expanded={isOpen}",
  "grid-rows-[0fr]",
  "grid-rows-[1fr]",
  "aria-hidden={!isOpen}",
  "inert={!isOpen}",
  "name=\"page\"",
  "name=\"limit\"",
  "initialOpen"
]) {
  if (!filter.includes(expected)) {
    throw new Error(`Audit filter panel is missing expected implementation: ${expected}`);
  }
}

for (const expected of [
  "\"use client\"",
  "useState(false)",
  "aria-expanded={isOpen}",
  "grid-rows-[0fr]",
  "grid-rows-[1fr]",
  "aria-hidden={!isOpen}",
  "inert={!isOpen}",
  "Before",
  "After"
]) {
  if (!row.includes(expected)) {
    throw new Error(`Audit row accordion is missing expected implementation: ${expected}`);
  }
}

console.log("ADMIN_AUDIT_UI_OK");
