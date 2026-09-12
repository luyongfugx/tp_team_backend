import { randomBytes, randomInt } from "crypto"
import { prisma } from "@/lib/prisma"

// 会话不按时间失效；保留日期字段以兼容已有数据库和客户端协议。
// 该值仅为长期会话标记，鉴权仍以数据库中的会话是否存在为准。
export const SESSION_EXPIRES_AT = "9999-12-31T23:59:59.999Z"
// 验证码有效期：5 分钟
export const CODE_TTL_MS = 5 * 60 * 1000

// 生成 6 位数字验证码
export function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0")
}

export async function getOrCreateVerificationCode(email: string) {
  const now = new Date()
  const existing = await prisma.verificationCode.findFirst({
    where: {
      email,
      consumed: false,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  })
  if (existing) {
    return { code: existing.code, expiresAt: existing.expiresAt, reused: true }
  }

  await prisma.verificationCode.updateMany({
    where: { email, consumed: false },
    data: { consumed: true },
  })

  const code = generateCode()
  const expiresAt = new Date(Date.now() + CODE_TTL_MS)
  await prisma.verificationCode.create({
    data: { email, code, expiresAt },
  })
  return { code, expiresAt, reused: false }
}

// 生成随机 token
export function generateToken(): string {
  return randomBytes(32).toString("hex")
}

// 创建会话
export async function createSession(userId: string, appInstanceID?: string) {
  const token = generateToken()
  const expiresAt = new Date(SESSION_EXPIRES_AT)
  await prisma.session.create({
    data: { token, userId, appInstanceID, expiresAt },
  })
  return { token, expiresAt }
}

// 校验 token，并将现存旧会话升级为长期会话（包括原到期时间已过的会话）。
export async function verifyAndRefreshToken(token: string) {
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  })

  if (!session || session.user.deletedAt) return null

  const newExpiresAt = new Date(SESSION_EXPIRES_AT)
  if (session.expiresAt.getTime() !== newExpiresAt.getTime()) {
    // 使用 updateMany，避免并发退出删除会话后抛错；绝不重建已撤销的会话。
    const updated = await prisma.session.updateMany({
      where: { id: session.id },
      data: { expiresAt: newExpiresAt },
    })
    if (updated.count === 0) return null
  }

  return { user: session.user, expiresAt: newExpiresAt }
}

// 从请求头中提取 Bearer token
export function getTokenFromRequest(req: Request): string | null {
  const auth = req.headers.get("authorization")
  if (!auth) return null
  const [scheme, value] = auth.split(" ")
  if (scheme?.toLowerCase() !== "bearer" || !value) return null
  return value
}

// 统一的鉴权辅助：返回 user 或 null
export async function authenticate(req: Request) {
  const token = getTokenFromRequest(req)
  if (!token) return null
  return verifyAndRefreshToken(token)
}
