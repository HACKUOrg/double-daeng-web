# Product Scope

double-daeng-web is a multi-organization SaaS for dormitory, condo, and apartment
management.

## Goals

- Start lean because the team is new and should avoid high upfront cost.
- Provide a clean base for property, room, user, role, and audit management.
- Support many organizations from the beginning.
- Keep the MVP operationally useful before adding billing, contracts, and files.

## Target Users

- `SA`: system administrators who manage the platform.
- `MANAGER`: organization-level managers.
- `OPERATION`: staff who handle daily room, customer, and maintenance work.
- `RESIDENT`: room-based resident login for tenants with an active stay.

## MVP Scope

The first MVP should include:

1. `SA` login.
2. `SA` creates organizations.
3. `SA` creates assets, buildings, floors, and rooms.
4. `SA` creates Manager and Operation users.
5. One user can belong to multiple organizations.
6. Manager creates Operation users.
7. Reserve rooms, cancel reservations, and move in from vacant or reserved rooms.
8. Move-in creates a room login from asset abbreviation plus room number.
9. Fixed RBAC in code.
10. Audit log for important admin actions and room status workflow changes.
11. Organization Switcher for organization-scoped work.

## Out of Scope for MVP

- Invite user flow.
- Spring Boot backend.
- Editable permission matrix.
- Tenant-specific custom roles.
- Complex billing and accounting.
- Online payment integration.
- Contract and receipt file storage.
- Email notification workflows.
- Mobile app.

## Product Principles

- Every protected action must be checked on the server.
- Every organization-scoped query must include organization scope.
- UI menu visibility is helpful but never the only authorization layer.
- Room status changes must come from workflow actions, not direct field edits.
- Prefer simple fixed rules until real customer feedback proves a need for more.
