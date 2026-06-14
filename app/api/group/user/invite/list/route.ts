import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, jsonSafe, ok, roleToID, roleToName, requireUser } from "@/app/api/_utils/api"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)

    const now = new Date()
    const invites = await prisma.teamEmailInvite.findMany({
      where: {
        email: user.email,
        uuID: { not: null },
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
    })

    return ok({
      invites: jsonSafe(
        invites.map((invite) => ({
          inviteID: invite.id,
          groupID: invite.groupID,
          groupName: invite.team.groupName,
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
