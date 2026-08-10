# Data Model

The MVP data model supports users, organizations, property structure, and audit
logging.

## Core Rules

- One user has exactly one role.
- One user can belong to many organizations.
- Organization access is controlled by `organization_memberships`.
- Organization-scoped records must be filtered by the active organization.

## Entity Overview

```text
users
  -> organization_memberships
  -> organizations
  -> assets
  -> buildings
  -> floors
  -> rooms
  -> room_assignments
  -> contracts
  -> invoices
  -> meter_readings
  -> maintenance_requests
  -> attachments

audit_logs
  -> users
  -> organizations
```

## Users

`users` stores application profiles linked to Supabase Auth.

| Field | Purpose |
| --- | --- |
| `id` | App user id. |
| `auth_user_id` | Supabase Auth user id. |
| `email` | Unique login email. |
| `username` | Optional unique room username for resident logins, such as `PT101`. |
| `display_name` | Name shown in the app. |
| `role` | One of `SA`, `MANAGER`, `OPERATION`, `RESIDENT`. |
| `status` | `ACTIVE` or `SUSPENDED`. |

## Organizations

`organizations` are the tenant boundary for the SaaS.

| Field | Purpose |
| --- | --- |
| `id` | Organization id. |
| `name` | Organization name. |
| `status` | `ACTIVE` or `SUSPENDED`. |

## Organization Memberships

`organization_memberships` grants users access to organizations.

| Field | Purpose |
| --- | --- |
| `user_id` | App user id. |
| `organization_id` | Organization id. |

The pair `(user_id, organization_id)` is unique.

Phase 3 and Phase 7 use this table as the active organization boundary for
`/app` dashboards and organization-scoped workflows.
Memberships for `SA` users are not required because `SA` works in `/admin`.

## Property Structure

The physical structure is modeled from broad to specific:

```text
Organization
  -> Asset
  -> Building
  -> Floor
  -> Room
```

`assets` represent dormitories, condos, apartments, or mixed property groups.
Each asset stores an `abbreviation` used to generate resident room usernames.

`rooms` start with these statuses:

- `VACANT`
- `OCCUPIED`
- `MAINTENANCE`
- `UNAVAILABLE`

Rooms store the default `rent_amount` and `deposit_amount`. Contract creation
copies these room amounts as the stay snapshot instead of asking staff to type
them again during move-in.

## Operations

Phase 8 adds the first operational records:

| Table | Purpose |
| --- | --- |
| `room_assignments` | Move-in/stay record between a resident and a room. Stores the system-generated room code, name, phone, emergency contact, ID/passport number, and the linked `RESIDENT` room login user. |
| `contracts` | Contract record for one room assignment. File upload is still pending. |
| `invoices` | Monthly or ad hoc invoice records with invoice status. |
| `meter_readings` | Water/electric room readings by date. |
| `maintenance_requests` | Maintenance tickets created by staff or residents. |
| `attachments` | Attachment metadata for future private Supabase Storage files. |

All Phase 8 tables include `organization_id` and must be queried through the
active organization scope. Direct client writes remain disabled; mutations go
through server actions and Prisma.

## Audit Logs

`audit_logs` records important changes. Phase 2 writes audit rows for
organization, asset, building, floor, and room mutations. Phase 3 writes
membership assignment/removal events. Phase 4 writes direct user-management
events. Phase 6 adds an `SA` audit-log page for viewing recent rows, filters,
and before/after snapshots. Phase 8 writes audit rows for room assignments,
room occupancy changes, invoices, meter readings, and maintenance requests.

| Field | Purpose |
| --- | --- |
| `actor_user_id` | User who performed the action. |
| `action` | Action name, such as `user.create`. |
| `entity_type` | Entity type, such as `user` or `room`. |
| `entity_id` | Changed entity id. |
| `organization_id` | Organization scope when applicable. |
| `before` | JSON snapshot before the change. |
| `after` | JSON snapshot after the change. |

## Indexing Notes

The current schema includes indexes for role, status, organization scope,
entity lookup, and audit timestamps. Add more indexes when real query patterns
appear during Phase 2 through Phase 8.
