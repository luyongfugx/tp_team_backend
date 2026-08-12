import { createSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { badFor, ok, readBody, serverError } from "@/app/api/_utils/api"
import {
  consumeWebLoginCode,
  findUserForWebLoginIdentifier,
  normalizeWebLoginIdentifier,
} from "@/lib/web-login-code"
import { fillMissingUserRegistrationMetadata } from "@/lib/user-registration-metadata"

function readIdentifier(body: Record<string, unknown>) {
  return normalizeWebLoginIdentifier(
    body.identifier ||
      body.account ||
      body.email ||
      body.zaloUserID ||
      body.zaloUserId ||
      body.zalo_user_id ||
      body.userID ||
      body.userId,
  )
}

export async function POST(req: Request) {
  try {
    const body = await readBody(req)
    const identifier = readIdentifier(body)
    const code = typeof body.code === "string" ? body.code.trim() : ""
    if (!identifier || !/^\d{6}$/.test(code)) return badFor(req, "参数不正确")

    let user = await findUserForWebLoginIdentifier(identifier)
    if (!user || user.deletedAt) return badFor(req, "验证码不存在，请重新获取")

    const result = await consumeWebLoginCode(user.id, code)
    if (!result.ok) {
      if (result.reason === "expired") return badFor(req, "验证码已过期，请重新获取")
      return badFor(req, "验证码错误")
    }

    user = await fillMissingUserRegistrationMetadata(user, body)
    const appInstanceID = typeof body.appInstanceID === "string" ? body.appInstanceID : undefined
    const { token, expiresAt } = await createSession(user.id, appInstanceID)
    const ownerTeamCount = await prisma.team.count({
      where: { ownerID: user.id, deletedAt: null },
    })
    const firstTeam = await prisma.teamMember.findFirst({
      where: { userID: user.id },
      orderBy: { joinedAt: "asc" },
    })

    return ok({
      success: true,
      userID: user.id,
      userName: user.userName,
      avatar: user.avatar,
      shortName: user.shortName,
      ownerTeamCount,
      token,
      expiresAt: expiresAt.toISOString(),
      email: user.email || "",
      user: { id: user.id, email: user.email || "" },
      isNewUser: false,
      groupID: firstTeam?.groupID,
      zaloUserID: user.zaloUserID || "",
    })
  } catch (err) {
    console.log("[app/user/login/web-code] error:", err)
    return serverError(req)
  }
}
