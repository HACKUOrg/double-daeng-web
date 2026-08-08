# ADR 0001: Lean SaaS Stack

## Status

Accepted.

## Context

double-daeng-web is starting with a new team. The project needs a stack that is
fast to build, affordable to operate, easy to deploy, and still capable of
supporting a real multi-organization SaaS.

## Decision

Use:

- Next.js + TypeScript.
- Supabase.
- PostgreSQL.
- Prisma.
- Tailwind CSS + shadcn/ui-style components.
- Vercel.
- GitHub.

Do not use Spring Boot in the MVP.

## Consequences

Positive:

- Lower upfront cost.
- Faster iteration.
- Smaller operational surface.
- Good fit for Vercel preview deployments.
- Supabase handles Auth and PostgreSQL early.

Tradeoffs:

- Domain logic can become crowded if the app grows without boundaries.
- Serverless database connections must be handled carefully.
- Heavy workflows may eventually need a separate backend.

## Future Review

Reconsider a backend split in Phase 3 or later only if domain logic, long-running
jobs, integrations, or operational requirements become too heavy for the MVP
architecture.
