# Local Setup

This guide prepares a local developer environment for double-daeng-web.

## Requirements

- Node.js compatible with Next.js 16.
- `pnpm`.
- A Supabase project.
- A Supabase database connection string.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```text
DATABASE_URL=
DIRECT_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
SEED_SA_AUTH_USER_ID=
SEED_SA_EMAIL=
SEED_SA_DISPLAY_NAME=
SEED_SA_PASSWORD=
```

Use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for browser-safe Supabase access.
Use `SUPABASE_SECRET_KEY` only on the server for Supabase Auth Admin actions.
For older projects, `SUPABASE_SERVICE_ROLE_KEY` can be used as a fallback.
Never put service role keys in `NEXT_PUBLIC_` variables.
Use `DIRECT_URL` for Prisma migrations and verifier scripts when available;
runtime code can use `DATABASE_URL`.

## Install Dependencies

```bash
pnpm install
```

This project pins package versions and commits the lockfile for repeatable
installs.

## Generate Prisma Client

```bash
pnpm prisma:generate
```

The generated client is written to `src/generated/prisma`.

## Create and Apply Migrations

After the Supabase database is configured:

```bash
pnpm prisma:migrate --name init
```

Review generated SQL before applying it to shared environments.
Keep generated migration files committed. They contain the schema history and
the RLS/grant posture required by Supabase.

## Seed First System Admin

Create the first user in Supabase Auth first. Then set:

```text
SEED_SA_AUTH_USER_ID=
SEED_SA_EMAIL=
SEED_SA_DISPLAY_NAME=
SEED_SA_PASSWORD=
```

Run:

```bash
pnpm db:seed
```

## Run Locally

```bash
pnpm dev
```

Open:

```text
http://127.0.0.1:3000
```

## Verify

Run:

```bash
pnpm prisma:generate
pnpm typecheck
pnpm lint
pnpm build
```

All four should pass before merging a feature branch.

After Phase 2 and later security work, also run the phase-specific verifier
commands listed in [Development Workflow](development-workflow.md).
