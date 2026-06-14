import { NextResponse } from "next/server"
import type { TeamRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { bad, jsonSafe, ok, roleToID, roleToName, requireUser } from "@/app/api/_utils/api"

type InviteWithTeam = {
  id: string
  groupID: string
  email: string
  role: TeamRole
  roleID: number
  uuID: string | null
  inviteCode: string | null
  expiresAt: Date | null
  createdAt: Date
  team: {
    groupName: string
    _count: { members: number }
    owner: {
      id: string
      userName: string | null
      shortName: string | null
      avatar: string | null
      email: string
    }
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)

    const now = new Date()
    const invites = (await prisma.teamEmailInvite.findMany({
      where: {
        email: user.email,
        inviteCode: { not: null },
        acceptedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        team: {
          deletedAt: null,
          members: {
            none: { userID: user.id },
          },
        },
      },
      include: {
        team: {
          include: {
            _count: { select: { members: true } },
            owner: { select: { id: true, userName: true, shortName: true, avatar: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    } as never)) as unknown as InviteWithTeam[]

    return ok({
      invites: jsonSafe(
        invites.map((invite) => ({
          inviteID: invite.id,
          groupID: invite.groupID,
          groupName: invite.team.groupName,
          inviteCode: invite.inviteCode,
          uuID: invite.uuID,
          inviteLinkWay: "EMAIL",
          role: roleToName(invite.role),
          roleID: roleToID(invite.role),
          email: invite.email,
          memberNum: invite.team._count.members,
          owner: invite.team.owner,
          expiresAt: invite.expiresAt,
          createdAt: invite.createdAt,
        })),
      ),
    })
  } catch (err) {
    console.log("[app/group/user/invite/list] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
