import { config as loadEnv } from "dotenv";
import { Client } from "pg";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

const tables = [
  "_prisma_migrations",
  "assets",
  "audit_logs",
  "buildings",
  "floors",
  "organization_memberships",
  "organizations",
  "room_reservations",
  "room_assignments",
  "contracts",
  "invoices",
  "meter_readings",
  "maintenance_requests",
  "attachments",
  "rooms",
  "users"
];

const client = new Client({ connectionString: process.env.DIRECT_URL });

await client.connect();

const tableStatus = await client.query(
  `
    select
      c.relname as table_name,
      pg_get_userbyid(c.relowner) as owner,
      c.relrowsecurity as rls_enabled,
      c.relforcerowsecurity as rls_forced
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relname = any($1::text[])
    order by c.relname
  `,
  [tables]
);

const grants = await client.query(
  `
    select
      table_name,
      grantee,
      string_agg(privilege_type, ',' order by privilege_type) as privileges
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = any($1::text[])
      and grantee in ('anon', 'authenticated', 'service_role')
    group by table_name, grantee
    order by table_name, grantee
  `,
  [tables]
);

const policies = await client.query(
  `
    select
      tablename as table_name,
      policyname as policy_name,
      roles,
      cmd,
      qual,
      with_check
    from pg_policies
    where schemaname = 'public'
      and tablename = any($1::text[])
    order by tablename, policyname
  `,
  [tables]
);

console.log("TABLE_STATUS");
console.table(tableStatus.rows);
console.log("GRANTS");
console.table(grants.rows);
console.log("POLICIES");
console.table(policies.rows);

await client.end();
