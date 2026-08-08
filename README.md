# double-daeng-web

Lean MVP foundation for dormitory, condo, and apartment management.

## Documentation

Start here:

- [Documentation Index](docs/README.md)
- [Product Scope](docs/product-scope.md)
- [Architecture](docs/architecture.md)
- [Data Model](docs/data-model.md)
- [Auth and RBAC](docs/auth-rbac.md)
- [Local Setup](docs/setup-local.md)
- [Development Workflow](docs/development-workflow.md)
- [Roadmap](docs/roadmap.md)
- [Security Checklist](docs/security-checklist.md)

## Stack

- Next.js App Router + TypeScript
- Supabase Auth + Supabase PostgreSQL
- Prisma ORM
- Tailwind CSS + shadcn/ui-style components
- Vercel-ready project structure

## Local Setup

1. Copy `.env.example` to `.env.local`.
2. Fill in:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`
3. Create the first SA user in Supabase Auth.
4. Set the seed variables in `.env.local` to that Auth user's id, email, and
   password for local verification.
5. Run:

```bash
pnpm install
pnpm prisma:generate
pnpm prisma:migrate --name init
pnpm db:seed
pnpm dev
```

## MVP Rules Captured

- `SA` uses `/admin`.
- `MANAGER`, `OPERATION`, and `CUSTOMER` use `/app`.
- One user has exactly one role.
- One user can belong to many organizations through `organization_memberships`.
- Invite flow is intentionally out of MVP; direct user creation is handled by
  `/admin/users` and `/app/users`.
- Server-side checks must validate authentication, role, membership, and organization scope.

## Current Phase

Phase 0 through Phase 7 foundation work is in place. Phase 8 core operations
foundation is now in progress:

- Prisma schema for users, organizations, memberships, assets, buildings,
  floors, rooms, audit logs, customer profiles, room assignments, contracts,
  invoices, meter readings, maintenance requests, and attachment metadata.
- Supabase SSR clients and session proxy.
- Login/logout server actions.
- Role-aware landing redirect.
- SA-only `/admin`.
- App shell for Manager, Operation, and Customer.
- Read-only `/admin/iam` permission map.
- `/admin/organizations` for creating, updating, suspending, and deleting organizations.
- Organization detail pages for managing assets, buildings, floors, rooms, and room statuses.
- Phase 2 server actions validate organization relationships on the server before writes.
- Phase 2 mutations write audit-log snapshots for organizations, assets, buildings, floors, and rooms.
- `/admin/memberships` for assigning existing non-SA user profiles to organizations.
- `/app` resolves an active organization from the user's memberships and shows
  role-specific Manager, Operation, and Customer dashboards scoped to that
  organization.
- `/admin/users` for direct user creation, updates, suspension, membership assignment, and password reset.
- `/app/users` for Manager and Operation user management inside active organization scope.
- Phase 4 user-management actions sync role/status metadata to Supabase Auth
  and verify forbidden role/scope attempts server-side.
- Fixed permission ids live in `src/lib/rbac.ts`.
- Route layouts, pages, and key server actions use permission guards.
- `/admin/iam` shows permission ids and descriptions.
- `/admin/audit` shows recent audit rows with filters and snapshots.
- `/app/operations` provides Phase 8 core workflows for customer profiles,
  room assignment, contract creation, monthly invoices, meter readings, and
  maintenance requests.
- Remaining Phase 8 follow-up work includes explicit move-out flow, payment
  status update flow, and real file upload/download storage.

Useful local checks:

```bash
pnpm typecheck
pnpm lint
pnpm verify:rls
pnpm verify:admin-phase2
pnpm verify:phase2-audit
pnpm verify:phase2-cleanup
pnpm verify:phase3-memberships
pnpm verify:phase3-scope
pnpm verify:phase4-users
pnpm verify:phase4-app-users
pnpm verify:phase5-rbac
pnpm verify:phase6-audit
pnpm verify:phase7-app-foundation
pnpm verify:phase8-core-operations
```

For a full non-SA `/app` login scope check, create a dedicated Supabase Auth
test user without an app profile, set `PHASE3_APP_EMAIL` and
`PHASE3_APP_PASSWORD`, then run:

```bash
pnpm verify:phase3-app-scope
```

If a dedicated test user is not available, set
`PHASE3_ALLOW_SEED_SA_ROLE_FLIP=1` to let the verifier temporarily change the
seed SA app profile to `MANAGER`, run the `/app` scope check, and restore the
profile in cleanup.

## Architecture Decision Records

- [ADR 0001: Lean SaaS Stack](docs/adr/0001-lean-saas-stack.md)
- [ADR 0002: Multi-Organization Memberships](docs/adr/0002-multi-organization-memberships.md)
- [ADR 0003: Fixed RBAC and Direct User Creation](docs/adr/0003-fixed-rbac-direct-user-creation.md)
