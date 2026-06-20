import { NextResponse } from "next/server"
import { createSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { bad, ok, readBody, requireUser, roleToID, roleToName } from "@/app/api/_utils/api"

type TeamCodeInvite = {
  groupID: string
  role: "OWNER" | "ADMIN" | "MEMBER"
  roleID: number
  team: { groupID: string; groupName: string }
}

type TeamInviteCodeDelegate = {
  findFirst: (args: unknown) => Promise<TeamCodeInvite | null>
}

function teamInviteCode() {
  return (prisma as never as { teamInviteCode: TeamInviteCodeDelegate }).teamInviteCode
}

function normalizeTeamCode(value: unknown) {
  if (typeof value !== "string") return ""
  const code = value.trim()
  return /^\d{6}$/.test(code) ? code : ""
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)

    const body = await readBody(req)
    const teamCode = normalizeTeamCode(body.teamCode ?? body.code)
    if (!teamCode) return bad("请输入有效的团队码")

    const invite = await teamInviteCode().findFirst({
      where: {
        code: teamCode,
        disabledAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        team: { deletedAt: null },
      } as never,
      include: { team: { select: { groupID: true, groupName: true } } },
    })
    if (!invite) return bad("团队码不存在或已失效")

    await prisma.teamMember.upsert({
      where: { groupID_userID: { groupID: invite.groupID, userID: user.id } },
      update: {},
      create: { groupID: invite.groupID, userID: user.id, role: invite.role, roleID: invite.roleID },
    })

    const { token } = await createSession(
      user.id,
      typeof body.appInstanceID === "string" ? body.appInstanceID : undefined,
    )

    return ok({
      userID: user.id,
      userName: user.userName,
      avatar: user.avatar,
      shortName: user.shortName,
      token,
      email: user.email,
      groupID: invite.groupID,
      groupName: invite.team.groupName,
      role: roleToName(invite.role),
      roleID: roleToID(invite.role),
    })
  } catch (err) {
    console.log("[app/group/user/join/code] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
