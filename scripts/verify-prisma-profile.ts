import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const authUserId = process.env.SEED_SA_AUTH_USER_ID;

if (!connectionString || !authUserId) {
  throw new Error("DIRECT_URL/DATABASE_URL and SEED_SA_AUTH_USER_ID are required.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString })
});

async function main() {
  const profile = await prisma.user.findUnique({
    where: { authUserId },
    include: {
      memberships: {
        include: {
          organization: true
        }
      }
    }
  });

  if (!profile || profile.role !== "SA" || profile.status !== "ACTIVE") {
    throw new Error("Prisma did not load the active SA profile.");
  }

  console.log("PRISMA_PROFILE_OK");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  }
);
