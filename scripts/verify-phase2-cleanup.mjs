import { config as loadEnv } from "dotenv";
import { Client } from "pg";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DIRECT_URL or DATABASE_URL is required.");
}

const client = new Client({ connectionString });

await client.connect();

const result = await client.query(
  "select count(1)::int as leftover from public.organizations where name like $1",
  ["Phase2 Test Org %"]
);

await client.end();

if (result.rows[0].leftover !== 0) {
  throw new Error(`Found ${result.rows[0].leftover} leftover Phase 2 fixtures.`);
}

console.log("PHASE2_CLEANUP_OK");
