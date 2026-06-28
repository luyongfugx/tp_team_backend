import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, ok, requireUser, roleToID, roleToName } from "@/app/api/_utils/api"

type UserSelection = {
  selectedGroupID: string | null
  selectedProjectID: number | null
}

async function getUserSelection(userID: string) {
  return prisma.user.findUnique({
    where: { id: userID },
    select: { selectedGroupID: true, selectedProjectID: true } as never,
  }) as Promise<UserSelection | null>
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)

    const selection = await getUserSelection(user.id)
    const selectedGroupID = selection?.selectedGroupID ?? null
    const selectedProjectID = selection?.selectedProjectID ?? null

    const member = selectedGroupID
      ? await prisma.teamMember.findUnique({
          where: { groupID_userID: { groupID: selectedGroupID, userID: user.id } },
          include: { team: true },
        })
      : null
    const team = member && member.team.deletedAt == null ? member.team : null
    const project = team && selectedProjectID
      ? await prisma.project.findFirst({
          where: { groupID: team.groupID, projectID: selectedProjectID, deletedAt: null },
        })
      : null
    const role = member && team ? roleToName(member.role) : null
    const roleID = member && team ? roleToID(member.role) : null

    return ok({
      selectedGroupID: team?.groupID ?? null,
      selectedProjectID: project?.projectID ?? null,
      role,
      roleID,
      selectedTeam: team
        ? {
            groupID: team.groupID,
            groupName: team.groupName,
            role,
            roleID,
          }
        : null,
      selectedProject: project
        ? {
            projectID: project.projectID,
            projectName: project.projectName,
          }
        : null,
    })
  } catch (err) {
    console.log("[app/user/selection/query] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
