# Roadmap

The roadmap is intentionally phased so the team can ship safely without paying
for unnecessary complexity upfront.

## Phase 0: Project Foundation

Goal: create the clean base project.

Tasks:

- Create Next.js App Router project.
- Set up TypeScript.
- Set up Tailwind CSS.
- Set up shadcn/ui-style components.
- Set up Prisma.
- Set up Supabase project.
- Set up Supabase Auth.
- Set up Vercel.
- Set up GitHub repo.
- Set up local, preview, and production environment variables.

Expected result:

- Project runs locally.
- Project deploys to Vercel.
- App connects to Supabase PostgreSQL.

## Phase 1: Auth and User Foundation

Goal: login and role-aware access.

Tasks:

- Login/logout with Supabase Auth.
- Create `users` table.
- Map `auth_user_id` from Supabase Auth.
- Create role enum.
- Create status enum.
- Seed first `SA`.
- Add route protection.
- Redirect users based on role.

Expected result:

- `SA` can access `/admin`.
- Non-`SA` users cannot access `/admin`.
- Users without a valid app profile cannot access protected areas.

## Phase 2: Organization and Asset Foundation

Goal: `SA` can create the property structure.

Tasks:

- `SA` creates, edits, suspends, and deletes organizations. (done)
- `SA` creates, edits, suspends, and deletes assets/properties. (done)
- `SA` creates, edits, and deletes buildings. (done)
- `SA` creates, edits, and deletes floors. (done)
- `SA` creates, edits, and deletes rooms. (done)
- Add basic room statuses. (done)
- Validate parent-child organization relationships on the server before writes. (done)
- Write audit-log snapshots for Phase 2 mutations. (done)
- Verify RLS, admin Phase 2 rendering, audit logging, and cleanup scripts. (done)

Expected result:

- Organizations and assets exist.
- Rooms can be managed.
- System is ready for user assignment.
- Important Phase 2 changes are traceable before the full audit page exists.

## Phase 3: Membership and Organization Scope

Goal: support users in multiple organizations.

Tasks:

- Create `organization_memberships`. (done in schema)
- `SA` assigns existing users to multiple organizations. (done)
- Block memberships for suspended users and suspended organizations. (done)
- Manager and Operation see only their organizations. (done)
- Add Organization Switcher in `/app`. (done)
- Scope every query by active organization. (done)
- Verify membership on the server. (done)
- Write audit logs for assign/remove membership. (done)
- Add direct user creation for new profiles. (deferred to Phase 4)

Expected result:

- One Manager can manage many organizations.
- Data does not leak between organizations.
- `/app` has an active organization boundary before role-specific workflows are added.

## Phase 4: Direct User Management

Goal: create users without invitation flow.

Tasks:

- `SA` creates Manager, Operation, and Customer users. (done)
- Manager creates Operation and Customer users. (done)
- Operation creates Customer users. (done)
- Limit organization assignment by creator role and membership. (done)
- Suspend and activate users. (done)
- Add manual/admin password reset flow. (done)
- Audit create/update user actions. (done)
- Use Supabase Admin Auth only from server-side code. (done)
- Sync managed user role/status metadata to Supabase Auth. (done)
- Verify allowed and forbidden Phase 4 role/scope flows. (done)

Expected result:

- User management works without email invitations.
- Role hierarchy is enforced.
- Auth users, app profiles, memberships, and audit logs stay in sync.

## Phase 5: Fixed IAM / RBAC

Goal: protect actions by role and permission.

Tasks:

- Define permissions in code. (done)
- Check permission in server actions and route handlers. (done)
- Hide menus by role. (done)
- Block unauthorized server-side actions. (done)
- Add read-only `/admin/iam`. (done)
- Verify forbidden Phase 5 route and server-action flows. (done)

Expected result:

- Business rules are enforced on the server.
- UI reflects available permissions.

## Phase 6: Audit Log

Goal: make admin actions traceable.

Tasks:

- Phase 2 organization/asset/building/floor/room mutations write audit logs. (done)
- Log create/update/suspend user. (done)
- Log create/update organization. (done)
- Log assign/remove membership. (done)
- Log create/update room. (done)
- Log role/status changes. (done)
- Add audit log page for `SA`. (done)
- Add filters for action, entity, organization, actor, and search. (done)
- Verify audit page rendering and non-SA access blocking. (done)

Expected result:

- Important changes are traceable.
- Debugging and accountability are easier.

## Phase 7: User App Foundation

Goal: create the main app area for non-`SA` roles.

Tasks:

- `/app` dashboard. (done)
- Organization Switcher. (done)
- Manager dashboard. (done)
- Operation dashboard. (done)
- Customer dashboard. (done)
- Role-aware navigation. (done)
- Layout separated from `/admin`. (done)
- Verify app foundation, role dashboard visibility, and organization scope. (done)

Expected result:

- Manager, Operation, and Customer can use the app shell.
- `/app` shows role-specific dashboard content without leaking outside
  organization scope.

## Phase 8: Dorm / Condo Core Operations

Goal: build actual double-daeng-web product value.

Tasks:

- Customer/tenant profile. (done: create/list in `/app/operations`)
- Room assignment. (done: active move-in assignment)
- Move-in and move-out. (partial: move-in done, move-out flow pending)
- Contract. (done: contract record can be created during room assignment)
- Monthly invoice. (done: invoice creation and listing)
- Water/electric meter. (done: meter reading creation and listing)
- Payment status. (partial: invoice status set on creation; update flow pending)
- Maintenance request. (done: create/list/update status)
- File attachment. (partial: attachment metadata table exists; storage upload
  flow pending)
- Verify core operations role/scope/audit behavior. (done)

Expected result:

- The app has a usable operations foundation for dorm, apartment, and condo
  management.
- Remaining Phase 8 work focuses on move-out, payment updates, and file
  upload/download storage.

## Phase 9: Production Readiness

Goal: prepare for real users.

Tasks:

- Error monitoring, likely Sentry.
- Database backup policy.
- Supabase RLS review.
- Rate limiting.
- Input validation with Zod.
- Important database indexes.
- Email notification.
- Production environment variables.
- Logging and security checklist.

Expected result:

- MVP is safer to launch.
- Operational risk is reduced.
