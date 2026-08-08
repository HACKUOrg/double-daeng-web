import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const seedAuthUserId = process.env.SEED_SA_AUTH_USER_ID;
const seedEmail = process.env.SEED_SA_EMAIL;
const seedDisplayName = process.env.SEED_SA_DISPLAY_NAME ?? "System Admin";
const placeholderAuthUserId = "00000000-0000-0000-0000-000000000000";
const placeholderEmail = "admin@example.com";

if (!databaseUrl) {
  throw new Error("DIRECT_URL or DATABASE_URL is required to seed double-daeng-web.");
}

if (!seedAuthUserId || !seedEmail) {
  throw new Error("SEED_SA_AUTH_USER_ID and SEED_SA_EMAIL are required.");
}

if (seedAuthUserId === placeholderAuthUserId || seedEmail === placeholderEmail) {
  throw new Error("Replace SEED_SA_AUTH_USER_ID and SEED_SA_EMAIL with the real Supabase Auth user before seeding.");
}

const saAuthUserId = seedAuthUserId;
const saEmail = seedEmail;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl })
});

async function main() {
  await prisma.$transaction(async (tx) => {
    const existingByAuthUserId = await tx.user.findUnique({
      where: { authUserId: saAuthUserId }
    });

    if (existingByAuthUserId) {
      await tx.user.update({
        where: { authUserId: saAuthUserId },
        data: {
          email: saEmail,
          displayName: seedDisplayName,
          role: "SA",
          status: "ACTIVE"
        }
      });
      return;
    }

    const existingByEmail = await tx.user.findUnique({
      where: { email: saEmail }
    });

    if (existingByEmail) {
      await tx.user.update({
        where: { email: saEmail },
        data: {
          authUserId: saAuthUserId,
          displayName: seedDisplayName,
          role: "SA",
          status: "ACTIVE"
        }
      });
      return;
    }

    await tx.user.create({
      data: {
        authUserId: saAuthUserId,
        email: saEmail,
        displayName: seedDisplayName,
        role: "SA",
        status: "ACTIVE"
      }
    });
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
