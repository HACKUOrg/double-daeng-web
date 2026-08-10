import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const email = process.env.SEED_SA_EMAIL;
const password = process.env.SEED_SA_PASSWORD;

if (!supabaseUrl || !publishableKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required.");
}

if (!email || !password) {
  throw new Error("SEED_SA_EMAIL and SEED_SA_PASSWORD are required.");
}

const anon = createClient(supabaseUrl, publishableKey, {
  auth: { persistSession: false }
});

const anonUsers = await anon.from("users").select("id").limit(1);

if (!anonUsers.error) {
  throw new Error("Anon unexpectedly read public.users.");
}

for (const table of [
  "room_assignments",
  "contracts",
  "invoices",
  "meter_readings",
  "maintenance_requests",
  "attachments"
]) {
  const anonRead = await anon.from(table).select("id").limit(1);

  if (!anonRead.error) {
    throw new Error(`Anon unexpectedly read public.${table}.`);
  }
}

const authenticated = createClient(supabaseUrl, publishableKey, {
  auth: { persistSession: false }
});

const { error: loginError } = await authenticated.auth.signInWithPassword({
  email,
  password
});

if (loginError) {
  throw new Error(`Supabase Auth login failed: ${loginError.message}`);
}

const ownProfile = await authenticated
  .from("users")
  .select("email, role, status")
  .eq("email", email);

if (ownProfile.error) {
  throw new Error(`Authenticated profile select failed: ${ownProfile.error.message}`);
}

if (ownProfile.data.length !== 1 || ownProfile.data[0].role !== "SA" || ownProfile.data[0].status !== "ACTIVE") {
  throw new Error("Authenticated profile select did not return the active SA profile.");
}

const insertAttempt = await authenticated.from("users").insert({
  auth_user_id: "00000000-0000-0000-0000-000000000001",
  email: "rls-insert-test@example.com",
  display_name: "RLS Insert Test",
  role: "RESIDENT",
  status: "ACTIVE"
});

if (!insertAttempt.error) {
  throw new Error("Authenticated role unexpectedly inserted public.users.");
}

const phase8InsertAttempt = await authenticated.from("room_assignments").insert({
  organization_id: "00000000-0000-0000-0000-000000000001",
  room_id: "00000000-0000-0000-0000-000000000001",
  resident_code: "rls-insert-test",
  resident_full_name: "RLS Insert Test",
  id_document_number: "rls-passport",
  move_in_date: "2026-08-11"
});

if (!phase8InsertAttempt.error) {
  throw new Error("Authenticated role unexpectedly inserted public.room_assignments.");
}

await authenticated.auth.signOut();

console.log("RLS_VERIFY_OK");
