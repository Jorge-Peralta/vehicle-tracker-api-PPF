/**
 * Seeds the database with sample vehicles, drivers, and movements.
 * Destructive: it wipes all existing data first, so only run it against a development database.
 *
 * Usage: npx prisma db seed
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, type MovementType } from '../src/generated/prisma/client.js'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is not set')
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

const HOUR_IN_MS = 60 * 60 * 1000

const vehicles = [
  { brand: 'Toyota', model: 'Hilux', plate: 'HAA1234', year: 2021 },
  { brand: 'Nissan', model: 'Frontier', plate: 'HBC5678', year: 2019 },
  { brand: 'Isuzu', model: 'D-Max', plate: 'HCD9012', year: 2022 },
  { brand: 'Mitsubishi', model: 'L200', plate: 'HDE3456', year: 2018 },
  { brand: 'Hyundai', model: 'H-1', plate: 'HEF7890', year: null },
  // Soft-deleted vehicle: keeps its history but is hidden from lists by default.
  { brand: 'Kia', model: 'K2700', plate: 'HFG2468', year: 2015, isActive: false },
]

// The only way drivers are created: registering a movement requires an existing driver.
// Identity numbers follow the Honduran format: department and municipality (4 digits),
// birth year (4), and a sequence number (5), stored without dashes.
const drivers = [
  { fullName: 'Carlos Mejía', identityNumber: '0801198512345' },
  { fullName: 'Ana Martínez', identityNumber: '0501199203456' },
  { fullName: 'José Rodríguez', identityNumber: '1804197800789' },
  { fullName: 'María López', identityNumber: '0101200101234' },
]

/**
 * Builds an alternating ENTRY/EXIT history for one vehicle, ending a few hours ago,
 * with strictly increasing dates and mileage so it satisfies the business rules.
 */
function buildHistory(options: {
  vehicleId: number
  driverIds: number[]
  count: number
  startMileage: number
  firstType: MovementType
}) {
  const { vehicleId, driverIds, count, startMileage, firstType } = options
  const now = Date.now()
  let mileage = startMileage

  return Array.from({ length: count }, (_, index) => {
    const isFirstType = index % 2 === 0
    const type: MovementType = isFirstType ? firstType : firstType === 'ENTRY' ? 'EXIT' : 'ENTRY'
    // One movement every ~9 hours, oldest first, the last one 3 hours ago.
    const occurredAt = new Date(now - ((count - 1 - index) * 9 + 3) * HOUR_IN_MS)
    mileage += index === 0 ? 0 : 15 + ((vehicleId * 7 + index * 13) % 120)

    return {
      vehicleId,
      driverId: driverIds[(vehicleId + index) % driverIds.length]!,
      type,
      occurredAt,
      mileage,
    }
  })
}

async function main() {
  await prisma.movement.deleteMany()
  await prisma.driver.deleteMany()
  await prisma.vehicle.deleteMany()

  const createdVehicles = await prisma.vehicle.createManyAndReturn({ data: vehicles })
  const createdDrivers = await prisma.driver.createManyAndReturn({ data: drivers })
  const driverIds = createdDrivers.map((driver) => driver.id)

  // The last vehicle (HEF7890) is left without movements so it can be hard-deleted in the UI.
  const vehiclesWithHistory = createdVehicles.filter((vehicle) => vehicle.plate !== 'HEF7890')
  const movements = vehiclesWithHistory.flatMap((vehicle, index) =>
    buildHistory({
      vehicleId: vehicle.id,
      driverIds,
      count: 6 + index * 2,
      startMileage: 10_000 + index * 25_000,
      firstType: index % 2 === 0 ? 'ENTRY' : 'EXIT',
    }),
  )
  await prisma.movement.createMany({ data: movements })

  console.log(
    `Seeded ${createdVehicles.length} vehicles, ${createdDrivers.length} drivers, ${movements.length} movements.`,
  )
}

try {
  await main()
} finally {
  await prisma.$disconnect()
}
