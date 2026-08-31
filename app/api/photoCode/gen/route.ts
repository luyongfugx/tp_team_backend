import { randomInt, randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, ok, readBody, requireUser } from "@/app/api/_utils/api"

// O is the only round glyph in newly issued codes. Excluding 0 and Q makes
// OCR normalization deterministic: legacy-looking 0/Q readings map to O.
// Avoid glyph pairs that are unstable after JPEG compression/OCR.
// Canonical substitutions: 0/Q->O, 1->I, 2->Z, 5->S, 6->9, 8->B.
const PHOTO_CODE_ALPHABET = "3479ABCDEFGHIJKLMNOPRSTUVWXYZ"
const PHOTO_CODE_LENGTH = 12

type PhotoCodeCreateInput = {
  code: string
  batchID: string
  userID: string
  deviceID?: string
  expiresAt: Date
}

type PhotoCodePrismaDelegate = {
  photoCode: {
    createMany: (args: { data: PhotoCodeCreateInput[]; skipDuplicates: boolean }) => Promise<{ count: number }>
    findMany: (args: Record<string, unknown>) => Promise<Array<{ code: string }>>
  }
}

// The checked-in Prisma client may lag behind schema changes until postinstall
// runs. Deployment regenerates it; this narrow delegate keeps this route typed.
const photoCodePrisma = prisma as never as PhotoCodePrismaDelegate

function positiveInteger(value: unknown, fallback: number, maximum: number) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, maximum)
}

function configuredBatchSizes() {
  const maximum = positiveInteger(process.env.PHOTO_CODE_MAX_BATCH_SIZE, 100, 1000)
  const defaultCount = positiveInteger(process.env.PHOTO_CODE_DEFAULT_BATCH_SIZE, 10, maximum)
  return { maximum, defaultCount }
}

function configuredValidityMonths() {
  return positiveInteger(process.env.PHOTO_CODE_VALIDITY_MONTHS, 3, 120)
}

function expiresAfterMonths(createdAt: Date, months: number) {
  const expiresAt = new Date(createdAt)
  expiresAt.setUTCMonth(expiresAt.getUTCMonth() + months)
  return expiresAt
}

function generatePhotoCode() {
  let code = ""
  for (let index = 0; index < PHOTO_CODE_LENGTH; index += 1) {
    code += PHOTO_CODE_ALPHABET[randomInt(PHOTO_CODE_ALPHABET.length)]
  }
  return code
}

function requestedDeviceID(body: Record<string, unknown>, req: Request) {
  const value = body.device_id ?? body.deviceId ?? req.headers.get("device_id")
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 191) : undefined
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)

    const body = await readBody(req)
    const url = new URL(req.url)
    const { maximum, defaultCount } = configuredBatchSizes()
    const count = positiveInteger(body.count ?? url.searchParams.get("count"), defaultCount, maximum)
    const validityMonths = configuredValidityMonths()
    const createdAt = new Date()
    const expiresAt = expiresAfterMonths(createdAt, validityMonths)
    const batchID = randomUUID()
    const deviceID = requestedDeviceID(body, req)

    // A unique database constraint is the final collision guard. Generate in
    // small batches until the requested number has actually been inserted.
    let insertedCount = 0
    while (insertedCount < count) {
      const remaining = count - insertedCount
      const candidates = new Set<string>()
      while (candidates.size < remaining) candidates.add(generatePhotoCode())
      const inserted = await photoCodePrisma.photoCode.createMany({
        data: [...candidates].map((code) => ({
          code,
          batchID,
          userID: user.id,
          deviceID,
          expiresAt,
        })),
        skipDuplicates: true,
      })
      insertedCount += inserted.count
    }

    const records = await photoCodePrisma.photoCode.findMany({
      where: { batchID },
      select: { code: true },
      orderBy: { createdAt: "asc" },
      take: count,
    })
    const antiFakeCodes = records.map((record) => record.code)
    return ok({
      antiFakeCodes,
      count: antiFakeCodes.length,
      expiresAt: expiresAt.toISOString(),
      validityMonths,
    })
  } catch (err) {
    console.log("[app/photoCode/gen] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
