import { NextResponse } from "next/server"
import { createSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { verifyAppleIdentityToken } from "@/lib/apple-auth"
import { bad, EMAIL_RE, normalizeEmail, ok, readBody } from "@/app/api/_utils/api"

function nameFromBody(body: Record<string, unknown>) {
  if (typeof body.userName === "string" && body.userName.trim()) return body.userName.trim()
  const fullName = body.fullName
  if (!fullName || typeof fullName !== "object") return undefined

  const name = fullName as { givenName?: unknown; familyName?: unknown; nickname?: unknown }
  return [name.familyName, name.givenName]
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .join("")
    || (typeof name.nickname === "string" && name.nickname.trim() ? name.nickname.trim() : undefined)
}

export async function POST(req: Request) {
  try {
    const body = await readBody(req)
    const identityToken = typeof body.identityToken === "string" ? body.identityToken.trim() : ""
    if (!identityToken) return bad("缺少 Apple identityToken")
    const applePayload = await verifyAppleIdentityToken({
      identityToken,
      nonce: typeof body.nonce === "string" ? body.nonce : undefined,
      rawNonce: typeof body.rawNonce === "string" ? body.rawNonce : undefined,
    })

    const appleUserID = applePayload.sub
    const tokenEmail = normalizeEmail(applePayload.email)
    const bodyEmail = normalizeEmail(body.email)
    const email = tokenEmail || bodyEmail
    const userName = nameFromBody(body)
    const avatar = typeof body.avatar === "string" ? body.avatar : undefined
    const appInstanceID = typeof body.appInstanceID === "string" ? body.appInstanceID : undefined

    let existing = await prisma.user.findFirst({ where: { appleUserID } as never })
    if (!existing && email) {
      if (!EMAIL_RE.test(email)) return bad("Apple 返回的邮箱格式不正确")
      existing = await prisma.user.findUnique({ where: { email } })
    }
    if (!existing && !email) return bad("首次 Apple 登录需要授权邮箱")

    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            appleUserID,
            userName: existing.userName || userName || undefined,
            avatar: existing.avatar || avatar || undefined,
            appInstanceID,
          } as never,
        })
      : await prisma.user.create({
          data: {
            email,
            appleUserID,
            userName,
            avatar,
            appInstanceID,
          } as never,
        })

    const { token } = await createSession(user.id, appInstanceID)
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
    console.log("[app/user/login/apple] error:", err)
    if (err instanceof Error) return bad(err.message)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
