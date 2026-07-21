import { Prisma, PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaQueryLoggerAttached: boolean | undefined
}

const prismaLogOptions: Prisma.PrismaClientOptions["log"] = [
  { emit: "event", level: "query" },
  { emit: "stdout", level: "error" },
  { emit: "stdout", level: "warn" },
]

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: prismaLogOptions,
  })

if (!globalForPrisma.prismaQueryLoggerAttached) {
  ;(prisma as PrismaClient<{ log: [{ emit: "event"; level: "query" }] }>).$on("query", (event) => {
    console.log("[prisma:query]", {
      durationMs: event.duration,
      query: event.query,
      params: event.params,
    })
  })
  globalForPrisma.prismaQueryLoggerAttached = true
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
