import { createSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { badFor, EMAIL_RE, normalizeEmail, ok, readBody, serverError } from "@/app/api/_utils/api"
import { createDefaultTeamIfNeeded } from "@/app/api/_utils/default-team"

const LOCAL_TEST_CODE = "888888"

function canUseLocalTestCode(req: Request) {
  if (process.env.NODE_ENV === "production") return false
  const hostname = new URL(req.url).hostname
  return process.env.NODE_ENV === "development" || hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
}

export async function POST(req: Request) {
  try {
    const body = await readBody(req)
    const email = normalizeEmail(body.email)
    const loginType = Number(body.loginType ?? 0)
    if (!email || !EMAIL_RE.test(email)) return badFor(req, "请输入有效的邮箱地址")

    if (loginType === 0 || loginType === 3) {
      const veriCode = typeof body.veriCode === "string" ? body.veriCode.trim() : ""
      const useLocalTestCode = veriCode === LOCAL_TEST_CODE && canUseLocalTestCode(req)
      if (!useLocalTestCode) {
        const record = await prisma.verificationCode.findFirst({
          where: { email, consumed: false },
          orderBy: { createdAt: "desc" },
        })
        if (!record) return badFor(req, "验证码不存在，请重新获取")
        if (record.expiresAt.getTime() < Date.now()) return badFor(req, "验证码已过期，请重新获取")
        if (record.code !== veriCode) return badFor(req, "验证码错误")
        await prisma.verificationCode.update({ where: { id: record.id }, data: { consumed: true } })
      }
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        userName: typeof body.userName === "string" ? body.userName : undefined,
        avatar: typeof body.avatar === "string" ? body.avatar : undefined,
        appInstanceID: typeof body.appInstanceID === "string" ? body.appInstanceID : undefined,
      },
      create: {
        email,
        userName: typeof body.userName === "string" ? body.userName : undefined,
        avatar: typeof body.avatar === "string" ? body.avatar : undefined,
        appInstanceID: typeof body.appInstanceID === "string" ? body.appInstanceID : undefined,
      },
    })

    const { token } = await createSession(
      user.id,
      typeof body.appInstanceID === "string" ? body.appInstanceID : undefined,
    )
    if (!existing) await createDefaultTeamIfNeeded(user)
    const ownerTeamCount = await prisma.team.count({
      where: { ownerID: user.id, deletedAt: null },
    })
    const firstTeam = await prisma.teamMember.findFirst({
      where: { userID: user.id },
      orderBy: { joinedAt: "asc" },
    })

    return ok({
      userID: user.id,
      userName: user.userName,
      avatar: user.avatar,
      shortName: user.shortName,
      ownerTeamCount,
      token,
      email: user.email,
      isNewUser: !existing,
      groupID: firstTeam?.groupID,
    })
  } catch (err) {
    console.log("[app/user/login/vericode] error:", err)
    return serverError(req)
  }
}
