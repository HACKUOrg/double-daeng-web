# Supabase Operations

Supabase provides authentication, PostgreSQL, and later storage for double-daeng-web.

## Responsibilities

Supabase should provide:

- PostgreSQL database.
- Auth.
- Storage later for contracts, receipts, room photos, and maintenance
  attachments.

## Auth Setup

Create users in Supabase Auth first, then create the matching app profile in
`users` with:

```text
users.auth_user_id = Supabase Auth user id
```

For the first setup, seed the first `SA` by setting:

```text
SEED_SA_AUTH_USER_ID=
SEED_SA_EMAIL=
SEED_SA_DISPLAY_NAME=
```

Then run:

```bash
pnpm db:seed
```

## Database Connection

`DATABASE_URL` is used by Prisma.

Use the Supabase Postgres connection string appropriate for Prisma and the
target environment. For serverless deployments, prefer a pooled connection.

## RLS Strategy

The MVP enforces mutations and sensitive authorization in Next.js server code.
Supabase RLS is enabled on the public tables as defense in depth.

Current Data API posture:

- `anon` has no direct table access.
- `authenticated` has read-only access scoped by RLS.
- Server-side Prisma keeps write access through the database owner or a
  dedicated `prisma` database role when present.
- `_prisma_migrations` has RLS enabled and is not granted to `anon` or
  `authenticated`.

The initial RLS policies match:

- Authenticated user identity.
- App profile status.
- Role.
- Organization membership.
- Entity ownership where applicable.

Do not rely on `TO authenticated` alone. It checks authentication, not row-level
authorization.

Run these checks after changing database security:

```bash
node scripts/inspect-rls.mjs
node scripts/verify-rls.mjs
```

`verify-rls` requires the seeded SA email/password in local env because it signs
in through Supabase Auth to test authenticated RLS behavior.

## Environment Separation

Use separate Supabase configuration for:

- Local development.
- Preview deployments.
- Production.

Never point preview deployments at production data unless the team has a clear
approval process.

## Operational Checks

Before production:

- Confirm backup policy.
- Confirm RLS posture.
- Confirm API exposure settings.
- Confirm auth email settings.
- Confirm password reset policy.
- Confirm database connection pooling.
- Confirm service role keys are only used in secure server environments.

## References

- Supabase SSR package replaces the older auth helper packages.
- Supabase Auth and database behavior changes over time; check official docs
  and changelogs before making production security changes.
