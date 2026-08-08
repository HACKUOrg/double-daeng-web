# ADR 0002: Multi-Organization Memberships

## Status

Accepted.

## Context

double-daeng-web must support a user belonging to more than one organization while
still keeping one role per user.

Putting `organization_id` directly on `users` would make this difficult and
would force awkward future migrations.

## Decision

Use `organization_memberships` to represent organization access.

Rules:

- One user has exactly one role.
- One user can belong to many organizations.
- Organization-scoped queries must use the active organization.
- Membership must be checked on the server.

## Consequences

Positive:

- Managers can manage multiple organizations.
- The model fits SaaS tenant boundaries.
- Access control is explicit and queryable.

Tradeoffs:

- Every organization-scoped query must remember organization scope.
- UI needs an Organization Switcher.
- Server actions need membership checks in addition to role checks.

## Implementation Notes

The unique pair `(user_id, organization_id)` prevents duplicate memberships.
Future organization-scoped tables should include enough foreign keys or joins to
verify the active organization.
