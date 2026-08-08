# Auth and RBAC

double-daeng-web uses Supabase Auth for authentication and fixed RBAC in code for
authorization.

## Roles

| Role | Route Area | Description |
| --- | --- | --- |
| `SA` | `/admin` | Platform system administrator. |
| `MANAGER` | `/app` | Organization manager. |
| `OPERATION` | `/app` | Daily operations staff. |
| `CUSTOMER` | `/app` | Resident or tenant. |

## Role Rules

- One user has exactly one role.
- Users with no app profile cannot access protected routes.
- Suspended users cannot access protected routes.
- `SA` users go to `/admin`.
- Non-`SA` users go to `/app`.

## Permissions

| Role | Permissions |
| --- | --- |
| `SA` | `admin.access`, `iam.view`, `audit.view`, `organizations.manage`, `memberships.manage`, `users.manage.all`, `assets.manage`, `rooms.manage` |
| `MANAGER` | `app.access`, `users.manage.organization`, `assets.manage`, `rooms.manage`, `customers.manage` |
| `OPERATION` | `app.access`, `users.manage.organization`, `customers.manage`, `room_status.update`, `maintenance.manage` |
| `CUSTOMER` | `app.access`, `own_data.view`, `maintenance.create` |

## User Creation Rules

| Actor | Can Create | Organization Assignment Scope |
| --- | --- | --- |
| `SA` | `MANAGER`, `OPERATION`, `CUSTOMER` | Any organization. |
| `MANAGER` | `OPERATION`, `CUSTOMER` | Organizations where the Manager is a member. |
| `OPERATION` | `CUSTOMER` | Organizations where the Operation user is a member. |
| `CUSTOMER` | None | None. |

## Membership Rules

- Memberships are stored in `organization_memberships`.
- A user can have memberships in many organizations.
- `SA` can assign active non-SA users to active organizations.
- `SA` does not need memberships for `/admin` access.
- `/app` only uses active organizations from the current user's memberships.
- Manager and Operation can assign users only within their own memberships.
- Manager and Operation can update a managed user only when all of that user's
  memberships are inside the actor's active organization scope.
- Customer self-assignment is not allowed.

## Required Server Checks

Each protected server function should follow this pattern:

```text
1. Require authenticated Supabase user.
2. Load app profile by users.auth_user_id.
3. Require profile.status = ACTIVE.
4. Require permission with `requirePermission()` or `requireAnyPermission()`.
5. For organization-scoped work, require organization membership.
6. Scope every query by organization id.
7. Write audit log for important changes.
```

## Current Implementation

- `src/lib/auth/session.ts` loads the current app profile.
- `src/lib/auth/organization-scope.ts` resolves active `/app` organization
  scope from memberships.
- `/app` uses the resolved organization scope for role-specific Manager,
  Operation, and Customer dashboard data.
- `requirePermission()` and `requireAnyPermission()` protect route layouts,
  pages, and server actions.
- `src/lib/rbac.ts` stores roles, labels, permission ids, permission labels,
  and creation hierarchy.
- `/admin/iam` displays the fixed permission ids and descriptions.
- `/admin/audit` displays recent audit rows for users with `audit.view`.
- `/admin/memberships` assigns existing non-SA profiles to organizations.
- `/admin/users` creates and manages non-SA users directly.
- `/app/users` lets Manager and Operation manage users inside active
  organization scope.
- `/app/operations` lets Manager and Operation manage operational records
  inside active organization scope; Customer can view linked records and create
  maintenance requests.
- Managed user role/status changes are synced to Supabase Auth app metadata;
  app authorization still loads the canonical profile from the database.
- `pnpm verify:phase5-rbac` verifies permission-based route redirects and
  forbidden server-action submissions.
- `pnpm verify:phase7-app-foundation` verifies role-specific `/app`
  dashboards, app navigation, customer access blocking, and organization scope.
- `pnpm verify:phase3-app-scope` verifies `/app` non-SA scope when a dedicated
  Supabase Auth test user is available.

## Future Considerations

Only add editable permissions after the MVP proves that customers need tenant
specific role customization. Until then, fixed RBAC keeps implementation and
support costs lower.
