import { randomBytes, randomInt } from "crypto"
import { prisma } from "@/lib/prisma"

// token 有效期（毫秒）：默认 7 天
export const TOKEN_TTL_MS = Number(process.env.TOKEN_TTL_MS || 7 * 24 * 60 * 60 * 1000)
// 验证码有效期：5 分钟
export const CODE_TTL_MS = 5 * 60 * 1000
export const TEST_LOGIN_CODE = "88888"

export function isTestLoginCode(code: unknown) {
  return typeof code === "string" && code.trim() === TEST_LOGIN_CODE
}

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
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)
  await prisma.session.create({
    data: { token, userId, appInstanceID, expiresAt },
  })
  return { token, expiresAt }
}

// 校验 token 并刷新过期时间。有效则返回 user，无效返回 null
export async function verifyAndRefreshToken(token: string) {
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  })

  if (!session) return null

  // 已过期：删除并返回 null
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {})
    return null
  }

  // 刷新过期时间
  const newExpiresAt = new Date(Date.now() + TOKEN_TTL_MS)
  await prisma.session.update({
    where: { id: session.id },
    data: { expiresAt: newExpiresAt },
  })

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
