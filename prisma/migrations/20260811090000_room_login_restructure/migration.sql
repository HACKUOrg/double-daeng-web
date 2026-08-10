-- Room-based resident login replaces the old CUSTOMER app role.
-- Some Supabase RLS policies reference users.role, so they must be recreated
-- around the enum swap. The guards also let a failed partial deploy retry.

drop policy if exists organizations_select_by_membership_or_sa on public.organizations;
drop policy if exists assets_select_by_membership_or_sa on public.assets;
drop policy if exists audit_logs_select_sa on public.audit_logs;
drop policy if exists customer_profiles_select_by_membership_or_sa on public.customer_profiles;
drop policy if exists room_assignments_select_by_membership_or_sa on public.room_assignments;
drop policy if exists contracts_select_by_membership_or_sa on public.contracts;
drop policy if exists invoices_select_by_membership_or_sa on public.invoices;
drop policy if exists meter_readings_select_by_membership_or_sa on public.meter_readings;
drop policy if exists maintenance_requests_select_by_membership_or_sa on public.maintenance_requests;
drop policy if exists attachments_select_by_membership_or_sa on public.attachments;

alter table "users"
  add column if not exists "username" text;

do $$
begin
  if exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'UserRole'
      and e.enumlabel = 'CUSTOMER'
  ) and not exists (
    select 1 from pg_type where typname = 'UserRole_old'
  ) then
    alter type "UserRole" rename to "UserRole_old";
  end if;

  if not exists (select 1 from pg_type where typname = 'UserRole') then
    create type "UserRole" as enum ('SA', 'MANAGER', 'OPERATION', 'RESIDENT');
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'role'
      and udt_name = 'UserRole_old'
  ) then
    alter table "users"
      alter column "role" type "UserRole"
      using (
        case
          when "role"::text = 'CUSTOMER' then 'RESIDENT'
          else "role"::text
        end
      )::"UserRole";
  end if;

  if exists (select 1 from pg_type where typname = 'UserRole_old')
    and not exists (
      select 1
      from pg_attribute a
      join pg_type t on t.oid = a.atttypid
      where t.typname = 'UserRole_old'
        and a.attisdropped = false
    ) then
    drop type "UserRole_old";
  end if;
end $$;

create unique index if not exists "users_username_key" on "users"("username");

alter table "assets"
  add column if not exists "abbreviation" text;

with numbered_assets as (
  select
    id,
    'AS' || row_number() over (order by created_at, id)::text as generated_abbreviation
  from "assets"
)
update "assets"
set "abbreviation" = numbered_assets.generated_abbreviation
from numbered_assets
where "assets"."id" = numbered_assets.id
  and "assets"."abbreviation" is null;

alter table "assets"
  alter column "abbreviation" set not null;

create unique index if not exists "assets_organization_id_abbreviation_key"
  on "assets"("organization_id", "abbreviation");

alter table "rooms"
  add column if not exists "rent_amount" decimal(12, 2) not null default 0,
  add column if not exists "deposit_amount" decimal(12, 2) not null default 0;

alter table "customer_profiles"
  add column if not exists "id_document_number" text;

alter table "room_assignments"
  add column if not exists "login_user_id" uuid;

update "room_assignments" ra
set "login_user_id" = cp."user_id"
from "customer_profiles" cp
where cp."id" = ra."customer_profile_id"
  and cp."user_id" is not null
  and ra."login_user_id" is null;

alter table "customer_profiles"
  drop constraint if exists "customer_profiles_user_id_fkey",
  drop column if exists "user_id";

create index if not exists "room_assignments_login_user_id_status_idx"
  on "room_assignments"("login_user_id", "status");

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'room_assignments_login_user_id_fkey'
  ) then
    alter table "room_assignments"
      add constraint "room_assignments_login_user_id_fkey"
      foreign key ("login_user_id") references "users"("id")
      on delete set null on update cascade;
  end if;
end $$;

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

do $$
declare
  table_name text;
  policy_name text;
  phase8_tables text[] := array[
    'customer_profiles',
    'room_assignments',
    'contracts',
    'invoices',
    'meter_readings',
    'maintenance_requests',
    'attachments'
  ];
begin
  foreach table_name in array phase8_tables loop
    if to_regclass('public.' || table_name) is not null then
      policy_name := table_name || '_select_by_membership_or_sa';
      execute format(
        'create policy %I on public.%I for select to authenticated using (
          exists (
            select 1
            from public.users u
            where u.auth_user_id = (select auth.uid())
              and u.status = ''ACTIVE''
              and u.role = ''SA''
          )
          or exists (
            select 1
            from public.organization_memberships om
            join public.users u on u.id = om.user_id
            where om.organization_id = %I.organization_id
              and u.auth_user_id = (select auth.uid())
              and u.status = ''ACTIVE''
          )
        )',
        policy_name,
        table_name,
        table_name
      );
    end if;
  end loop;
end $$;
