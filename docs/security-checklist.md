# Security Checklist

Security must be handled in code, database access, deployment settings, and
operations.

## Authentication

- Use Supabase Auth for login and session management.
- Do not trust user-editable metadata for authorization decisions.
- Require an app `users` record for every authenticated user.
- Block users with `status = SUSPENDED`.
- Sync managed user role/status changes to Supabase Auth app metadata, while
  keeping the database profile as the authorization source of truth.
- Keep session refresh in `proxy.ts`, but do not rely on proxy as the only
  authorization layer.

## Authorization

- Check role on the server.
- Check permission ids on the server with `requirePermission()` or
  `requireAnyPermission()` for protected actions and pages.
- Check organization membership on the server.
- Scope organization data by active organization id.
- Re-load parent resources on the server before nested writes; do not trust hidden
  form `organizationId` values for scoping.
- Resolve `/app` active organization from the current user's memberships, not
  from a raw query parameter alone.
- Do not create memberships for suspended users or suspended organizations.
- Manager and Operation user-management actions must not affect users with
  memberships outside the actor's active organization scope.
- If using `PHASE3_ALLOW_SEED_SA_ROLE_FLIP=1`, confirm the verifier restores
  the seed SA profile after `/app` scope testing.
- Keep UI visibility and server authorization separate.
- Treat hidden navigation as convenience only; Server Actions must still reject
  unauthorized submissions.
- Audit sensitive mutations.
- Keep audit-log viewing behind `audit.view`; do not expose audit snapshots to
  non-SA app users.

## Environment Variables

- Never expose service role keys in `NEXT_PUBLIC_` variables.
- Keep `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` server-only.
- Keep `.env.local` out of git.
- Rotate secrets after accidental exposure.
- Use different Supabase projects or databases for local, preview, and
  production environments.

## Database

- Review migrations before applying them.
- Add indexes for organization-scoped query patterns.
- Keep RLS enabled on all public tables.
- Keep `anon` table grants revoked unless a public read use case is explicitly
  reviewed.
- Keep authenticated Data API writes disabled until direct client mutations have
  purpose-built policies.
- Verify RLS with `node scripts/inspect-rls.mjs` and
  `node scripts/verify-rls.mjs` after security migrations.
- Verify Phase 2 server-action audit logging with
  `pnpm verify:phase2-audit`.
- Verify the audit page and filters with `pnpm verify:phase6-audit`.
- Verify non-SA app dashboards, role navigation, and organization scope with
  `pnpm verify:phase7-app-foundation`.
- Verify Phase 8 operations, role scope, and audit rows with
  `pnpm verify:phase8-core-operations`.
- Avoid `SECURITY DEFINER` functions unless absolutely required and reviewed.
- Use security-invoker views if views are added.

## Supabase Storage

Storage is out of MVP, but when added:

- Use private buckets by default.
- Authorize upload/download by user role and organization membership.
- Treat contracts, receipts, room photos, and maintenance attachments as
  sensitive tenant data.
- Grant storage upsert permissions carefully.

## Next.js

- Keep dependencies patched.
- Revalidate authorization in Server Components, Server Actions, and Route
  Handlers.
- Do not hardcode secrets in server actions.
- Validate all user input.
- Use Supabase Admin Auth only in server actions or server-only utilities.
- Avoid returning raw internal errors to users.

## Production Readiness

- Add error monitoring.
- Add rate limiting to sensitive actions.
- Configure database backups.
- Add production logging.
- Document incident response.
- Run a security review before onboarding real tenants.
