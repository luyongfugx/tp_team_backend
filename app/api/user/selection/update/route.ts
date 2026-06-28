import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, ok, readBody, requireUser, roleToID, roleToName } from "@/app/api/_utils/api"
import type { TeamMember } from "@prisma/client"

type UpdatedSelection = {
  selectedGroupID: string | null
  selectedProjectID: number | null
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)

    const body = await readBody(req)
    const groupID = typeof body.groupID === "string"
      ? body.groupID
      : typeof body.selectedGroupID === "string"
        ? body.selectedGroupID
        : null
    const projectValue = body.projectID ?? body.selectedProjectID
    const projectID = projectValue == null ? null : Number(projectValue)

    let selectedMember: TeamMember | null = null
    if (groupID) {
      const member = await prisma.teamMember.findUnique({
        where: { groupID_userID: { groupID, userID: user.id } },
        include: { team: true },
      })
      if (!member || member.team.deletedAt) return bad("无团队访问权限", 403)
      selectedMember = member
    }

    if (projectID != null && (!Number.isFinite(projectID) || projectID < 0)) return bad("项目不正确")
    if (projectID && !groupID) return bad("请选择团队后再选择项目")

    if (groupID && projectID) {
      const project = await prisma.project.findFirst({
        where: { groupID, projectID, deletedAt: null },
      })
      if (!project) return bad("项目不存在")
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        selectedGroupID: groupID || null,
        selectedProjectID: projectID && projectID > 0 ? projectID : null,
      } as never,
      select: { selectedGroupID: true, selectedProjectID: true } as never,
    }) as UpdatedSelection

    return ok({
      selectedGroupID: updated.selectedGroupID,
      selectedProjectID: updated.selectedProjectID,
      role: selectedMember ? roleToName(selectedMember.role) : null,
      roleID: selectedMember ? roleToID(selectedMember.role) : null,
    })
  } catch (err) {
    console.log("[app/user/selection/update] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
