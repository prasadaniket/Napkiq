import { prisma } from '../lib/prisma'

async function main() {
  console.log('Wiping transactional data to start fresh (0s)...')

  // Delete all records in transactional tables
  // Order matters due to foreign key constraints (child first, parent last)
  const autoLogs = await prisma.automationLog.deleteMany()
  console.log(`Deleted ${autoLogs.count} AutomationLogs.`)

  const reviews = await prisma.review.deleteMany()
  console.log(`Deleted ${reviews.count} Reviews.`)

  const visits = await prisma.customerVisit.deleteMany()
  console.log(`Deleted ${visits.count} CustomerVisits.`)

  const customers = await prisma.customer.deleteMany()
  console.log(`Deleted ${customers.count} Customers.`)

  console.log('Database successfully reset to 0s for transactional data!')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
