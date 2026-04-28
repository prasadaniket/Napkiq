import "dotenv/config";
import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Clearing customer data...");

  const [logs, reviews, visits, customers] = await prisma.$transaction([
    prisma.automationLog.deleteMany(),
    prisma.review.deleteMany(),
    prisma.customerVisit.deleteMany(),
    prisma.customer.deleteMany(),
  ]);

  console.log(`Deleted ${logs.count} automation logs`);
  console.log(`Deleted ${reviews.count} reviews`);
  console.log(`Deleted ${visits.count} visits`);
  console.log(`Deleted ${customers.count} customers`);
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
