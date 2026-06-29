import { NextResponse } from "next/server"
import { createSession } from "@/lib/auth"
import { verifyGoogleIdentityToken } from "@/lib/google-auth"
import { prisma } from "@/lib/prisma"
import { bad, EMAIL_RE, normalizeEmail, ok, readBody } from "@/app/api/_utils/api"
import { createDefaultTeamIfNeeded } from "@/app/api/_utils/default-team"

function nameFromBody(body: Record<string, unknown>, tokenName?: string) {
  if (typeof body.userName === "string" && body.userName.trim()) return body.userName.trim()
  if (typeof body.fullName === "string" && body.fullName.trim()) return body.fullName.trim()
  return tokenName?.trim() || undefined
}

export async function POST(req: Request) {
  try {
    const body = await readBody(req)
    const identityToken =
      typeof body.identityToken === "string"
        ? body.identityToken.trim()
        : typeof body.idToken === "string"
          ? body.idToken.trim()
          : ""
    if (!identityToken) return bad("缺少 Google identityToken")

    const googlePayload = await verifyGoogleIdentityToken({
      identityToken,
      nonce: typeof body.nonce === "string" ? body.nonce : undefined,
    })

    const googleUserID = googlePayload.sub
    const email = normalizeEmail(googlePayload.email)
    if (!email || !EMAIL_RE.test(email)) return bad("Google 返回的邮箱格式不正确")

    const userName = nameFromBody(body, googlePayload.name)
    const avatar = typeof body.avatar === "string" && body.avatar ? body.avatar : googlePayload.picture
    const appInstanceID = typeof body.appInstanceID === "string" ? body.appInstanceID : undefined

    let existing = await prisma.user.findFirst({ where: { googleUserID } as never })
    if (!existing) {
      existing = await prisma.user.findUnique({ where: { email } })
    }

    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            googleUserID,
            userName: existing.userName || userName || undefined,
            avatar: existing.avatar || avatar || undefined,
            appInstanceID,
          } as never,
        })
      : await prisma.user.create({
          data: {
            email,
            googleUserID,
            userName,
            avatar,
            appInstanceID,
          } as never,
        })

    const { token } = await createSession(user.id, appInstanceID)
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
    console.log("[app/user/login/google] error:", err)
    if (err instanceof Error) return bad(err.message)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
