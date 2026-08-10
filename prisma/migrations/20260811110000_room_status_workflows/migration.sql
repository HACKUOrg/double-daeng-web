-- Add action-driven room statuses and room reservation records.

alter type "RoomStatus" add value if not exists 'RESERVED';

create type "ReservationStatus" as enum ('ACTIVE', 'CANCELLED', 'CONVERTED');

create table "room_reservations" (
  "id" uuid not null,
  "organization_id" uuid not null,
  "room_id" uuid not null,
  "reserved_by_user_id" uuid,
  "reserver_name" text not null,
  "reserver_phone" text,
  "reserved_date" date not null default current_date,
  "expected_move_in_date" date,
  "note" text,
  "status" "ReservationStatus" not null default 'ACTIVE',
  "created_at" timestamptz(6) not null default current_timestamp,
  "updated_at" timestamptz(6) not null,

  constraint "room_reservations_pkey" primary key ("id")
);

alter table "maintenance_requests"
  add column "previous_room_status" "RoomStatus";

create index "room_reservations_organization_id_status_idx"
  on "room_reservations"("organization_id", "status");

create index "room_reservations_room_id_status_idx"
  on "room_reservations"("room_id", "status");

create index "room_reservations_reserved_by_user_id_idx"
  on "room_reservations"("reserved_by_user_id");

create unique index "room_reservations_active_room_key"
  on "room_reservations"("room_id")
  where "status" = 'ACTIVE';

alter table "room_reservations"
  add constraint "room_reservations_organization_id_fkey"
  foreign key ("organization_id") references "organizations"("id")
  on delete cascade on update cascade;

alter table "room_reservations"
  add constraint "room_reservations_room_id_fkey"
  foreign key ("room_id") references "rooms"("id")
  on delete cascade on update cascade;

alter table "room_reservations"
  add constraint "room_reservations_reserved_by_user_id_fkey"
  foreign key ("reserved_by_user_id") references "users"("id")
  on delete set null on update cascade;

alter table public.room_reservations enable row level security;

revoke all on table public.room_reservations from anon, authenticated;
grant select on table public.room_reservations to authenticated;
grant all privileges on table public.room_reservations to service_role;

create policy room_reservations_select_by_membership_or_sa
on public.room_reservations
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
    where om.organization_id = room_reservations.organization_id
      and u.auth_user_id = (select auth.uid())
      and u.status = 'ACTIVE'
  )
);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'prisma') then
    grant select, insert, update, delete on table public.room_reservations to prisma;

    drop policy if exists room_reservations_server_prisma_all on public.room_reservations;
    create policy room_reservations_server_prisma_all
    on public.room_reservations
    for all
    to prisma
    using (true)
    with check (true);
  end if;
end $$;
