# Architecture

double-daeng-web uses a lean Next.js and Supabase architecture for the MVP.

## Stack

- Next.js App Router on Vercel.
- TypeScript.
- Supabase Auth for authentication.
- Supabase PostgreSQL for the database.
- Prisma ORM for schema, migrations, and database access.
- Tailwind CSS with shadcn/ui-style components.
- GitHub for source control and future CI.

## High-Level Flow

```text
Browser
  -> Next.js App Router
  -> Server Components / Server Actions / Route Handlers
  -> Prisma
  -> Supabase PostgreSQL

Supabase Auth
  -> session cookies
  -> users.auth_user_id
```

## Route Areas

```text
/login
  Public login page.

/admin
  SA only.
  Platform administration and system-level views.

/app
  Manager, Operation, and Customer.
  Organization-scoped application workspace.
```

## Server-Side Authorization Flow

Every protected server entrypoint should validate:

1. The user is authenticated through Supabase Auth.
2. A matching app profile exists in `users`.
3. The app profile status is `ACTIVE`.
4. The app role has the required fixed permission for the route or action.
5. For organization-scoped actions, the user is a member of the active organization.
6. The database query is scoped by the active organization.

## Next.js Patterns

- Keep data fetching in Server Components where possible.
- Use Server Actions for form submissions and mutations.
- Use Route Handlers for webhooks, public APIs, large uploads, or external callbacks.
- Keep `proxy.ts` light; use it for Supabase session refresh, not full authorization.
- Re-check authorization in Server Components, Server Actions, and Route Handlers.
- Prefer `requirePermission()` / `requireAnyPermission()` over ad hoc role
  checks for protected pages and mutations.
- Initialize database clients lazily through helper functions.

## Supabase Patterns

- Use `@supabase/ssr` for cookie-based server/browser clients.
- Use the Supabase publishable key on the client.
- Never expose service role keys to browser code.
- Map Supabase Auth users to app users through `users.auth_user_id`.
- Prefer app database records for authorization, not user-editable metadata.

## Prisma Patterns

- Keep the Prisma schema as the source of truth for database models.
- Use migrations for database changes.
- Use generated Prisma Client from `src/generated/prisma`.
- Use Supabase connection pooling for runtime database access.

## Future Backend Split

Spring Boot is intentionally not part of the MVP.

Consider a backend split only if later phases introduce heavy domain logic,
long-running workflows, integrations, or operational constraints that are hard
to maintain inside Next.js server code.
