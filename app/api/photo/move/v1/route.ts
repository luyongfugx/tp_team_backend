import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, canManage, ok, readBody, requireTeamMember, requireUser } from "@/app/api/_utils/api"
import { batchPhotoWhereForUser, isForbiddenPersonalPhotoScene, selectedPhotoWhere } from "@/app/api/_utils/photo"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    const targetProjectID = Number(body.targetProjectID)
    if (!Number.isFinite(targetProjectID)) return bad()
    const member = await requireTeamMember(groupID, user.id)
    if (!member) return bad("无团队访问权限", 403)
    if (isForbiddenPersonalPhotoScene(body, user.id)) return bad("个人详情只支持操作自己的照片", 403)
    const isManager = canManage(member)
    const baseWhere = selectedPhotoWhere(body, groupID)
    if (!isManager) {
      const forbiddenCount = await prisma.photo.count({
        where: { AND: [baseWhere, { userID: { not: user.id } }] },
      })
      if (forbiddenCount > 0) return bad("无照片移动权限", 403)
    }
    const moveWhere = batchPhotoWhereForUser(body, groupID, user.id, isManager)
    if (targetProjectID <= 0) {
      const result = await prisma.photo.updateMany({
        where: moveWhere,
        data: { projectID: null, projectName: null } as never,
      })
      return ok({ movedCount: result.count })
    }
    const target = await prisma.project.findFirst({ where: { groupID, projectID: targetProjectID, deletedAt: null } })
    if (!target) return bad("目标项目不存在")
    const result = await prisma.photo.updateMany({
      where: moveWhere,
      data: { projectID: targetProjectID, projectName: target.projectName },
    })
    return ok({ movedCount: result.count })
  } catch (err) {
    console.log("[app/photo/move/v1] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
