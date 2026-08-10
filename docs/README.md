# double-daeng-web Documentation

This folder is the working product and engineering handbook for double-daeng-web.
It captures the MVP plan, architecture decisions, current implementation rules,
and the next implementation phases.

## Read First

1. [Product Scope](product-scope.md)
2. [Architecture](architecture.md)
3. [Data Model](data-model.md)
4. [Auth and RBAC](auth-rbac.md)
5. [Roadmap](roadmap.md)

## Engineering Docs

- [Local Setup](setup-local.md)
- [Development Workflow](development-workflow.md)
- [Security Checklist](security-checklist.md)
- [Supabase Operations](supabase-operations.md)

## Architecture Decision Records

- [ADR 0001: Lean SaaS Stack](adr/0001-lean-saas-stack.md)
- [ADR 0002: Multi-Organization Memberships](adr/0002-multi-organization-memberships.md)
- [ADR 0003: Fixed RBAC and Direct User Creation](adr/0003-fixed-rbac-direct-user-creation.md)

## Current Implementation Status

Phase 0 through Phase 7 foundation work is in place. Phase 8 core operations
foundation is now in progress:

- Next.js App Router project structure exists.
- Supabase SSR clients are in place.
- Prisma schema has the MVP entities, operational entities, and enums.
- Login/logout server actions exist.
- `/admin` is reserved for `SA`.
- `/app` is reserved for `MANAGER`, `OPERATION`, and room-based `RESIDENT`
  logins.
- `/admin/iam` shows the fixed RBAC map.
- `/admin/organizations` manages the organization and property hierarchy.
- `/admin/memberships` assigns existing non-SA users to organizations.
- `/app` resolves active organization scope from memberships and shows
  role-specific Manager, Operation, and Resident dashboards.
- `/admin/users` and `/app/users` manage staff user creation and password
  resets without invitations; resident logins are created by move-in.
- `src/lib/rbac.ts` stores fixed permission ids and role mappings.
- Permission guards protect route layouts, pages, and key server actions.
- `/admin/audit` shows recent audit rows with filters and before/after
  snapshots.
- `/app/operations` supports Phase 8 reservations, move-ins, move-outs, active
  stays, contract records, invoices, meter readings, maintenance requests, and
  action-driven room status changes.

The database is not connected until `.env.local` is filled with a real Supabase
project and migrations are applied.
