# Development Workflow

This workflow keeps the MVP small, reviewable, and safe to deploy.

## Branch Flow

1. Create a feature branch.
2. Keep changes scoped to one feature or fix.
3. Run local verification.
4. Open a pull request.
5. Deploy preview on Vercel.
6. Merge after review.

## Local Verification

Run before pushing:

```bash
pnpm prisma:generate
pnpm typecheck
pnpm lint
pnpm build
```

For Phase 2 admin and database safety work, also run:

```bash
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

The Phase 4 user-management verifiers cover both happy paths and forbidden
role/scope attempts. They require `SUPABASE_SECRET_KEY` or
`SUPABASE_SERVICE_ROLE_KEY` because they create and clean up Supabase Auth test
users through the server-only Admin API.

The Phase 5 RBAC verifier checks permission-based route redirects and forbidden
Server Action submissions. It also requires the server-only Supabase admin key
to create and clean up temporary Auth users.

The Phase 6 audit verifier checks the `SA` audit page, filters, before/after
snapshot rendering, and non-SA access blocking.

The Phase 7 app foundation verifier predates the resident-login restructure and
needs a rewrite before it can validate the current Manager, Operation, and
Resident dashboard model.

The Phase 8 core operations verifier checks operational table writes, server
actions, role-specific `/app/operations` views, organization scope blocking,
and audit rows for reservation, move-in, move-out, stay, invoice, meter, room
status, and maintenance workflows.

When a dedicated non-SA Supabase Auth test user is available, set
`PHASE3_APP_EMAIL` and `PHASE3_APP_PASSWORD`, then run:

```bash
pnpm verify:phase3-app-scope
```

If a dedicated test user is not available, set
`PHASE3_ALLOW_SEED_SA_ROLE_FLIP=1`. The verifier will temporarily change the
seed SA app profile to `MANAGER`, test `/app`, and restore the profile in
cleanup.

## Feature Implementation Order

For each feature:

1. Update or confirm the data model.
2. Add server-side authorization checks.
3. Add server action or route handler.
4. Add UI.
5. Add audit logging for important mutations.
6. Verify with the expected role matrix.

## Server Action Checklist

- Validate inputs with a schema.
- Load the current profile on the server.
- Check permissions with `requirePermission()` or `requireAnyPermission()`.
- Check organization membership when scoped.
- Scope database writes and reads by organization.
- Re-load parent records on the server before nested writes.
- For `/app`, resolve active organization from membership before querying data.
- For user management, sync app profile role/status changes to Supabase Auth
  metadata and keep admin credentials server-only.
- Return useful errors without leaking sensitive data.
- Revalidate affected paths after mutation.
- Write audit logs for important changes.

## UI Checklist

- Hide navigation items a role cannot use.
- Keep dashboards dense and operational.
- Use shadcn/ui-style primitives before custom controls.
- Keep text short and scannable.
- Do not rely on hidden UI for authorization.

## Migration Checklist

- Confirm whether the change is backward compatible.
- Review generated SQL.
- Consider indexes for new query patterns.
- Check whether data backfill is required.
- Run migrations in a non-production environment first.
- Commit migration files, including RLS and grant changes. Do not ignore
  `prisma/migrations`.

## Definition of Done

A feature is done when:

- The route or action is protected on the server.
- Queries are scoped correctly.
- Empty, loading, and error states are acceptable for MVP.
- Verification commands pass.
- Documentation is updated when behavior or architecture changes.
