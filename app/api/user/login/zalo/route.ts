import { createSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { bad, badFor, ok, readBody, serverError } from "@/app/api/_utils/api"
import { createDefaultTeamIfNeeded } from "@/app/api/_utils/default-team"
import {
  assertZaloRedirectUri,
  exchangeZaloCodeForToken,
  fetchZaloProfile,
  zaloAvatar,
  zaloPlaceholderEmail,
} from "@/lib/zalo-auth"
import {
  fillMissingUserRegistrationMetadata,
  userRegistrationMetadataFromBody,
} from "@/lib/user-registration-metadata"

function readString(body: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = body[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return ""
}

export async function POST(req: Request) {
  try {
    const body = await readBody(req)
    const code = readString(body, ["code", "authorizationCode", "oauthCode"])
    const codeVerifier = readString(body, ["codeVerifier", "code_verifier"])
    const redirectUri = readString(body, ["redirectUri", "redirect_uri"]) || undefined
    if (!code) return badFor(req, "缺少 Zalo 授权 code")
    if (!codeVerifier) return badFor(req, "缺少 Zalo codeVerifier")
    assertZaloRedirectUri(redirectUri)

    const tokenResult = await exchangeZaloCodeForToken({ code, codeVerifier })
    const profile = await fetchZaloProfile(tokenResult.access_token as string)
    const zaloUserID = profile.id
    const email = zaloPlaceholderEmail(zaloUserID)
    const userName = typeof profile.name === "string" && profile.name.trim() ? profile.name.trim() : undefined
    const avatar = zaloAvatar(profile)
    const appInstanceID = typeof body.appInstanceID === "string" ? body.appInstanceID : undefined
    const registrationMetadata = userRegistrationMetadataFromBody(body)

    let existing = await prisma.user.findFirst({ where: { zaloUserID } as never })
    if (!existing) {
      existing = await prisma.user.findUnique({ where: { email } })
    }

    let user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            zaloUserID,
            userName: existing.userName || userName || undefined,
            avatar: existing.avatar || avatar || undefined,
            appInstanceID,
          } as never,
        })
      : await prisma.user.create({
          data: {
            email,
            zaloUserID,
            userName,
            avatar,
            appInstanceID,
            ...registrationMetadata,
          } as never,
        })
    user = await fillMissingUserRegistrationMetadata(user, body)

    const { token, expiresAt } = await createSession(user.id, appInstanceID)
    if (!existing) await createDefaultTeamIfNeeded(user)
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
      email: user.email,
      user: { id: user.id, email: user.email },
      isNewUser: !existing,
      groupID: firstTeam?.groupID,
      zaloUserID,
    })
  } catch (err) {
    console.log("[app/user/login/zalo] error:", err)
    if (err instanceof Error) return bad(err.message)
    return serverError(req)
  }
}
