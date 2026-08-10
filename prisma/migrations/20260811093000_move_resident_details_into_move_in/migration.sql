-- Collapse resident data into room_assignments. The product no longer keeps a
-- separate customer profile entity.

alter table "room_assignments"
  add column if not exists "resident_code" text,
  add column if not exists "resident_full_name" text,
  add column if not exists "resident_phone" text,
  add column if not exists "emergency_contact" text,
  add column if not exists "id_document_number" text;

update "room_assignments" ra
set
  "resident_code" = cp."customer_code",
  "resident_full_name" = cp."full_name",
  "resident_phone" = cp."phone",
  "emergency_contact" = cp."emergency_contact",
  "id_document_number" = coalesce(cp."id_document_number", 'MIGRATED-' || ra."id"::text)
from "customer_profiles" cp
where cp."id" = ra."customer_profile_id"
  and (
    ra."resident_code" is null
    or ra."resident_full_name" is null
    or ra."id_document_number" is null
  );

update "room_assignments"
set
  "resident_code" = coalesce("resident_code", 'MIGRATED-' || "id"::text),
  "resident_full_name" = coalesce("resident_full_name", 'Migrated resident'),
  "id_document_number" = coalesce("id_document_number", 'MIGRATED-' || "id"::text);

alter table "room_assignments"
  alter column "resident_code" set not null,
  alter column "resident_full_name" set not null,
  alter column "id_document_number" set not null;

create unique index if not exists "room_assignments_organization_id_resident_code_key"
  on "room_assignments"("organization_id", "resident_code");

alter table "invoices"
  drop constraint if exists "invoices_customer_profile_id_fkey";

update "invoices" i
set "room_assignment_id" = ra."id"
from "room_assignments" ra
where i."customer_profile_id" = ra."customer_profile_id"
  and i."room_assignment_id" is null;

drop index if exists "invoices_customer_profile_id_idx";

alter table "invoices"
  drop column if exists "customer_profile_id";

alter table "maintenance_requests"
  add column if not exists "room_assignment_id" uuid;

update "maintenance_requests" mr
set "room_assignment_id" = ra."id"
from "room_assignments" ra
where mr."customer_profile_id" = ra."customer_profile_id"
  and mr."room_assignment_id" is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'maintenance_requests_room_assignment_id_fkey'
  ) then
    alter table "maintenance_requests"
      add constraint "maintenance_requests_room_assignment_id_fkey"
      foreign key ("room_assignment_id") references "room_assignments"("id")
      on delete set null on update cascade;
  end if;
end $$;

create index if not exists "maintenance_requests_room_assignment_id_idx"
  on "maintenance_requests"("room_assignment_id");

alter table "maintenance_requests"
  drop constraint if exists "maintenance_requests_customer_profile_id_fkey";

drop index if exists "maintenance_requests_customer_profile_id_idx";

alter table "maintenance_requests"
  drop column if exists "customer_profile_id";

alter table "room_assignments"
  drop constraint if exists "room_assignments_customer_profile_id_fkey";

drop index if exists "room_assignments_customer_profile_id_status_idx";

alter table "room_assignments"
  drop column if exists "customer_profile_id";

drop table if exists "customer_profiles";
drop type if exists "CustomerProfileStatus";
