import { prisma } from "@/lib/prisma"

export type AccountDeletionRequestRecord = {
  id: string
  email: string
  status: string
  locale: string | null
  ip: string | null
  userAgent: string | null
  createdAt: Date
  updatedAt: Date
}

type AccountDeletionRequestDelegate = {
  create: (args: unknown) => Promise<AccountDeletionRequestRecord>
  count: (args: unknown) => Promise<number>
  findMany: (args: unknown) => Promise<AccountDeletionRequestRecord[]>
}

export function accountDeletionRequest() {
  return (prisma as never as { accountDeletionRequest: AccountDeletionRequestDelegate }).accountDeletionRequest
}

export function accountDeletionPayload(item: AccountDeletionRequestRecord) {
  return {
    id: item.id,
    email: item.email,
    status: item.status,
    locale: item.locale,
    ip: item.ip,
    userAgent: item.userAgent,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

export function clientIP(req: Request) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null
  )
}
