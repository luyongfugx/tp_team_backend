import { createSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { bad, badFor, ok, readBody, serverError } from "@/app/api/_utils/api"
import { createDefaultTeamIfNeeded } from "@/app/api/_utils/default-team"
import { localeFromRequest } from "@/lib/i18n"
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
    const locale = localeFromRequest(req, body)
    // Temporary Zalo compatibility path:
    // Zalo blocks server-side token/profile requests from the Singapore server,
    // so for now we trust the Zalo profile returned by the native app SDK.
    const zaloUserID = readString(body, ["zaloUserID", "zaloUserId", "zalo_user_id", "zaloID", "id", "userID"])
    if (!zaloUserID) return badFor(req, "缺少 Zalo 用户 ID")
    const userName = readString(body, ["userName", "name", "zaloName"]) || undefined
    const avatar = readString(body, ["avatar", "picture", "pictureUrl", "avatarUrl", "zaloAvatar"]) || undefined
    const appInstanceID = typeof body.appInstanceID === "string" ? body.appInstanceID : undefined
    const registrationMetadata = userRegistrationMetadataFromBody(body)

    let existing = await prisma.user.findFirst({ where: { zaloUserID } as never })

    let user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            email: null,
            zaloUserID,
            userName: existing.userName || userName || undefined,
            avatar: existing.avatar || avatar || undefined,
            appInstanceID,
          } as never,
        })
      : await prisma.user.create({
          data: {
            email: null,
            zaloUserID,
            userName,
            avatar,
            appInstanceID,
            ...registrationMetadata,
          } as never,
        })
    user = await fillMissingUserRegistrationMetadata(user, body)

    const { token, expiresAt } = await createSession(user.id, appInstanceID)
    if (!existing) await createDefaultTeamIfNeeded(user, locale)
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
      email: "",
      user: { id: user.id, email: "" },
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
