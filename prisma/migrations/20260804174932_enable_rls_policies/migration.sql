-- Enable RLS for all public tables created by the initial Prisma migration.
-- The MVP keeps mutations behind Next.js server code/Prisma; Data API access is
-- read-only and scoped to the authenticated user's app profile and memberships.

alter table public.users enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.assets enable row level security;
alter table public.buildings enable row level security;
alter table public.floors enable row level security;
alter table public.rooms enable row level security;
alter table public.audit_logs enable row level security;

revoke all on table
  public.users,
  public.organizations,
  public.organization_memberships,
  public.assets,
  public.buildings,
  public.floors,
  public.rooms,
  public.audit_logs
from anon, authenticated;

grant select on table
  public.users,
  public.organizations,
  public.organization_memberships,
  public.assets,
  public.buildings,
  public.floors,
  public.rooms,
  public.audit_logs
to authenticated;

grant all privileges on table
  public.users,
  public.organizations,
  public.organization_memberships,
  public.assets,
  public.buildings,
  public.floors,
  public.rooms,
  public.audit_logs
to service_role;

drop policy if exists users_select_own_profile on public.users;
create policy users_select_own_profile
on public.users
for select
to authenticated
using ((select auth.uid()) = auth_user_id);

drop policy if exists organization_memberships_select_own on public.organization_memberships;
create policy organization_memberships_select_own
on public.organization_memberships
for select
to authenticated
using (
  user_id in (
    select u.id
    from public.users u
    where u.auth_user_id = (select auth.uid())
      and u.status = 'ACTIVE'
  )
);

drop policy if exists organizations_select_by_membership_or_sa on public.organizations;
create policy organizations_select_by_membership_or_sa
on public.organizations
for select
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.auth_user_id = (select auth.uid())
      and u.status = 'ACTIVE'
      and u.role = 'SA'
  )
  or exists (
    select 1
    from public.organization_memberships om
    join public.users u on u.id = om.user_id
    where om.organization_id = organizations.id
      and u.auth_user_id = (select auth.uid())
      and u.status = 'ACTIVE'
  )
);

drop policy if exists assets_select_by_membership_or_sa on public.assets;
create policy assets_select_by_membership_or_sa
on public.assets
for select
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.auth_user_id = (select auth.uid())
      and u.status = 'ACTIVE'
      and u.role = 'SA'
  )
  or exists (
    select 1
    from public.organization_memberships om
    join public.users u on u.id = om.user_id
    where om.organization_id = assets.organization_id
      and u.auth_user_id = (select auth.uid())
      and u.status = 'ACTIVE'
  )
);

drop policy if exists buildings_select_by_membership_or_sa on public.buildings;
create policy buildings_select_by_membership_or_sa
on public.buildings
for select
to authenticated
using (
  exists (
    select 1
    from public.assets a
    where a.id = buildings.asset_id
  )
);

drop policy if exists floors_select_by_membership_or_sa on public.floors;
create policy floors_select_by_membership_or_sa
on public.floors
for select
to authenticated
using (
  exists (
    select 1
    from public.buildings b
    where b.id = floors.building_id
  )
);

drop policy if exists rooms_select_by_membership_or_sa on public.rooms;
create policy rooms_select_by_membership_or_sa
on public.rooms
for select
to authenticated
using (
  exists (
    select 1
    from public.floors f
    where f.id = rooms.floor_id
  )
);

drop policy if exists audit_logs_select_sa on public.audit_logs;
create policy audit_logs_select_sa
on public.audit_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.auth_user_id = (select auth.uid())
      and u.status = 'ACTIVE'
      and u.role = 'SA'
  )
);

-- If a dedicated Prisma database role exists, allow the server-side ORM to keep
-- enforcing authorization in application code without being blocked by RLS.
do $$
declare
  table_name text;
  policy_name text;
  server_tables text[] := array[
    'users',
    'organizations',
    'organization_memberships',
    'assets',
    'buildings',
    'floors',
    'rooms',
    'audit_logs'
  ];
begin
  if exists (select 1 from pg_roles where rolname = 'prisma') then
    grant select, insert, update, delete on table
      public._prisma_migrations,
      public.users,
      public.organizations,
      public.organization_memberships,
      public.assets,
      public.buildings,
      public.floors,
      public.rooms,
      public.audit_logs
    to prisma;

    foreach table_name in array server_tables loop
      policy_name := table_name || '_server_prisma_all';
      execute format('drop policy if exists %I on public.%I', policy_name, table_name);
      execute format(
        'create policy %I on public.%I for all to prisma using (true) with check (true)',
        policy_name,
        table_name
      );
    end loop;
  end if;
end $$;
