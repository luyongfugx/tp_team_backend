import type { User } from "@prisma/client"
import { generateCode } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { EMAIL_RE, normalizeEmail } from "@/app/api/_utils/api"

const WEB_LOGIN_CODE_TTL_MS = Number(process.env.WEB_LOGIN_CODE_TTL_MS || 5 * 60 * 1000)

type WebLoginCodeRecord = {
  id: string
  userId: string
  code: string
  expiresAt: Date
  consumedAt: Date | null
  createdAt: Date
}

type WebLoginCodeDelegate = {
  create: (args: unknown) => Promise<WebLoginCodeRecord>
  findFirst: (args: unknown) => Promise<WebLoginCodeRecord | null>
  update: (args: unknown) => Promise<WebLoginCodeRecord>
  updateMany: (args: unknown) => Promise<{ count: number }>
}

function webLoginCode() {
  return (prisma as never as { webLoginCode: WebLoginCodeDelegate }).webLoginCode
}

export function normalizeWebLoginIdentifier(value: unknown) {
  if (typeof value !== "string") return ""
  return value.trim()
}

export function webLoginIdentifierForUser(user: Pick<User, "id" | "email" | "zaloUserID">) {
  return user.zaloUserID || user.email || user.id
}

export async function createWebLoginCode(userId: string) {
  await webLoginCode().updateMany({
    where: { userId, consumedAt: null },
    data: { consumedAt: new Date() },
  })

  const code = generateCode()
  const expiresAt = new Date(Date.now() + WEB_LOGIN_CODE_TTL_MS)
  const record = await webLoginCode().create({
    data: { userId, code, expiresAt },
  })
  return { code: record.code, expiresAt: record.expiresAt }
}

export async function findUserForWebLoginIdentifier(identifier: string) {
  const normalized = normalizeWebLoginIdentifier(identifier)
  if (!normalized) return null

  if (EMAIL_RE.test(normalized)) {
    return prisma.user.findUnique({ where: { email: normalizeEmail(normalized) } })
  }

  return prisma.user.findFirst({
    where: {
      deletedAt: null,
      OR: [{ zaloUserID: normalized }, { id: normalized }],
    } as never,
  })
}

export async function consumeWebLoginCode(userId: string, code: string) {
  const trimmedCode = code.trim()
  if (!/^\d{6}$/.test(trimmedCode)) return { ok: false as const, reason: "invalid" as const }

  const record = await webLoginCode().findFirst({
    where: { userId, code: trimmedCode, consumedAt: null },
    orderBy: { createdAt: "desc" },
  })
  if (!record) return { ok: false as const, reason: "missing" as const }
  if (record.expiresAt.getTime() < Date.now()) return { ok: false as const, reason: "expired" as const }

  await webLoginCode().update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  })
  return { ok: true as const }
}
