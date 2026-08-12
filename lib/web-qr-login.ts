import { createHash, randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"

export const WEB_QR_LOGIN_TTL_MS = Number(process.env.WEB_QR_LOGIN_TTL_MS || 5 * 60 * 1000)

type WebQrLoginRecord = {
  id: string
  scanToken: string
  browserSecretHash: string
  userId: string | null
  expiresAt: Date
  confirmedAt: Date | null
  consumedAt: Date | null
  webSessionToken: string | null
  createdAt: Date
}

type WebQrLoginDelegate = {
  create: (args: unknown) => Promise<WebQrLoginRecord>
  findFirst: (args: unknown) => Promise<WebQrLoginRecord | null>
  updateMany: (args: unknown) => Promise<{ count: number }>
}

export function webQrLoginDelegate(client: unknown = prisma) {
  return (client as { webQrLoginSession: WebQrLoginDelegate }).webQrLoginSession
}

function secretHash(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function randomToken() {
  return randomBytes(32).toString("base64url")
}

export function normalizeQrScanToken(value: unknown) {
  if (typeof value !== "string") return ""
  const input = value.trim()
  if (!input) return ""
  try {
    const url = new URL(input)
    return url.searchParams.get("token")?.trim() || ""
  } catch {
    return input
  }
}

export async function createWebQrLoginSession() {
  const scanToken = randomToken()
  const browserSecret = randomToken()
  const expiresAt = new Date(Date.now() + WEB_QR_LOGIN_TTL_MS)
  await webQrLoginDelegate().create({
    data: {
      scanToken,
      browserSecretHash: secretHash(browserSecret),
      expiresAt,
    },
  })
  return { scanToken, browserSecret, expiresAt }
}

export async function findWebQrLoginSession(scanToken: string, browserSecret: string) {
  if (!scanToken || !browserSecret) return null
  return webQrLoginDelegate().findFirst({
    where: { scanToken, browserSecretHash: secretHash(browserSecret) },
  })
}

export async function confirmWebQrLoginSession(scanToken: string, userId: string) {
  const existing = await webQrLoginDelegate().findFirst({ where: { scanToken } })
  if (!existing) return { ok: false as const, reason: "missing" as const }
  if (existing.expiresAt.getTime() <= Date.now()) return { ok: false as const, reason: "expired" as const }
  if (existing.consumedAt) return { ok: false as const, reason: "consumed" as const }
  if (existing.confirmedAt) {
    return existing.userId === userId
      ? { ok: true as const, alreadyConfirmed: true }
      : { ok: false as const, reason: "confirmed" as const }
  }

  const result = await webQrLoginDelegate().updateMany({
    where: {
      id: existing.id,
      userId: null,
      confirmedAt: null,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { userId, confirmedAt: new Date() },
  })
  return result.count === 1
    ? { ok: true as const, alreadyConfirmed: false }
    : { ok: false as const, reason: "conflict" as const }
}

export function qrBrowserSecretHash(browserSecret: string) {
  return secretHash(browserSecret)
}
