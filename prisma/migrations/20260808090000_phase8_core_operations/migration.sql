-- CreateEnum
CREATE TYPE "CustomerProfileStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RoomAssignmentStatus" AS ENUM ('ACTIVE', 'MOVED_OUT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MeterType" AS ENUM ('WATER', 'ELECTRIC');

-- CreateEnum
CREATE TYPE "MaintenancePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED');

-- CreateTable
CREATE TABLE "customer_profiles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "customer_code" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "emergency_contact" TEXT,
    "status" "CustomerProfileStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_assignments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "customer_profile_id" UUID NOT NULL,
    "status" "RoomAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "move_in_date" DATE NOT NULL,
    "move_out_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "room_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "contract_number" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "rent_amount" DECIMAL(12,2) NOT NULL,
    "deposit_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "customer_profile_id" UUID NOT NULL,
    "room_assignment_id" UUID,
    "invoice_number" TEXT NOT NULL,
    "issue_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meter_readings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "meter_type" "MeterType" NOT NULL,
    "reading_date" DATE NOT NULL,
    "reading_value" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "meter_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "room_id" UUID,
    "customer_profile_id" UUID,
    "created_by_user_id" UUID,
    "assigned_to_user_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "MaintenancePriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "maintenance_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "uploaded_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_profiles_organization_id_status_idx" ON "customer_profiles"("organization_id", "status");

-- CreateIndex
CREATE INDEX "customer_profiles_user_id_idx" ON "customer_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_profiles_organization_id_customer_code_key" ON "customer_profiles"("organization_id", "customer_code");

-- CreateIndex
CREATE INDEX "room_assignments_organization_id_status_idx" ON "room_assignments"("organization_id", "status");

-- CreateIndex
CREATE INDEX "room_assignments_room_id_status_idx" ON "room_assignments"("room_id", "status");

-- CreateIndex
CREATE INDEX "room_assignments_customer_profile_id_status_idx" ON "room_assignments"("customer_profile_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_assignment_id_key" ON "contracts"("assignment_id");

-- CreateIndex
CREATE INDEX "contracts_organization_id_status_idx" ON "contracts"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_organization_id_contract_number_key" ON "contracts"("organization_id", "contract_number");

-- CreateIndex
CREATE INDEX "invoices_organization_id_status_idx" ON "invoices"("organization_id", "status");

-- CreateIndex
CREATE INDEX "invoices_customer_profile_id_idx" ON "invoices"("customer_profile_id");

-- CreateIndex
CREATE INDEX "invoices_room_assignment_id_idx" ON "invoices"("room_assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_organization_id_invoice_number_key" ON "invoices"("organization_id", "invoice_number");

-- CreateIndex
CREATE INDEX "meter_readings_organization_id_meter_type_reading_date_idx" ON "meter_readings"("organization_id", "meter_type", "reading_date");

-- CreateIndex
CREATE UNIQUE INDEX "meter_readings_room_id_meter_type_reading_date_key" ON "meter_readings"("room_id", "meter_type", "reading_date");

-- CreateIndex
CREATE INDEX "maintenance_requests_organization_id_status_idx" ON "maintenance_requests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "maintenance_requests_room_id_idx" ON "maintenance_requests"("room_id");

-- CreateIndex
CREATE INDEX "maintenance_requests_customer_profile_id_idx" ON "maintenance_requests"("customer_profile_id");

-- CreateIndex
CREATE INDEX "maintenance_requests_created_by_user_id_idx" ON "maintenance_requests"("created_by_user_id");

-- CreateIndex
CREATE INDEX "maintenance_requests_assigned_to_user_id_idx" ON "maintenance_requests"("assigned_to_user_id");

-- CreateIndex
CREATE INDEX "attachments_organization_id_entity_type_entity_id_idx" ON "attachments"("organization_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "attachments_uploaded_by_user_id_idx" ON "attachments"("uploaded_by_user_id");

-- AddForeignKey
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_assignments" ADD CONSTRAINT "room_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_assignments" ADD CONSTRAINT "room_assignments_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_assignments" ADD CONSTRAINT "room_assignments_customer_profile_id_fkey" FOREIGN KEY ("customer_profile_id") REFERENCES "customer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "room_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_profile_id_fkey" FOREIGN KEY ("customer_profile_id") REFERENCES "customer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_room_assignment_id_fkey" FOREIGN KEY ("room_assignment_id") REFERENCES "room_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_customer_profile_id_fkey" FOREIGN KEY ("customer_profile_id") REFERENCES "customer_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS and grants for Phase 8 tables. Mutations stay behind server-side Prisma.
alter table public.customer_profiles enable row level security;
alter table public.room_assignments enable row level security;
alter table public.contracts enable row level security;
alter table public.invoices enable row level security;
alter table public.meter_readings enable row level security;
alter table public.maintenance_requests enable row level security;
alter table public.attachments enable row level security;

revoke all on table
  public.customer_profiles,
  public.room_assignments,
  public.contracts,
  public.invoices,
  public.meter_readings,
  public.maintenance_requests,
  public.attachments
from anon, authenticated;

grant select on table
  public.customer_profiles,
  public.room_assignments,
  public.contracts,
  public.invoices,
  public.meter_readings,
  public.maintenance_requests,
  public.attachments
to authenticated;

grant all privileges on table
  public.customer_profiles,
  public.room_assignments,
  public.contracts,
  public.invoices,
  public.meter_readings,
  public.maintenance_requests,
  public.attachments
to service_role;

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
    policy_name := table_name || '_select_by_membership_or_sa';
    execute format('drop policy if exists %I on public.%I', policy_name, table_name);
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
  end loop;

  if exists (select 1 from pg_roles where rolname = 'prisma') then
    grant select, insert, update, delete on table
      public.customer_profiles,
      public.room_assignments,
      public.contracts,
      public.invoices,
      public.meter_readings,
      public.maintenance_requests,
      public.attachments
    to prisma;

    foreach table_name in array phase8_tables loop
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
