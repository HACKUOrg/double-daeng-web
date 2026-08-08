# ADR 0003: Fixed RBAC and Direct User Creation

## Status

Accepted.

## Context

The MVP needs role-aware access but does not need tenant-specific permission
customization yet. The team also wants to avoid building an invite flow at the
start.

## Decision

Use fixed RBAC in code and direct user creation.

Roles:

- `SA`
- `MANAGER`
- `OPERATION`
- `CUSTOMER`

Creation rules:

- `SA` can create Manager, Operation, and Customer users.
- Manager can create Operation and Customer users.
- Operation can create Customer users.
- Customer cannot create users.

Organization assignment rules:

- `SA` can assign users to any organization.
- Manager can assign users only to organizations where the Manager is a member.
- Operation can assign users only to organizations where the Operation user is
  a member.

## Consequences

Positive:

- Faster MVP delivery.
- Smaller UX and email-delivery surface.
- Authorization rules are easy to read and test.

Tradeoffs:

- Admins must manually coordinate user credentials or password resets.
- Invite-based onboarding will need to be added later if customers expect it.
- Fixed roles may eventually be too rigid for larger customers.

## Future Review

Add invite flow and editable permissions only after MVP usage proves the need.
