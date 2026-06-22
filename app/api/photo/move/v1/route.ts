import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, ok, readBody, requireTeamManager, requireUser } from "@/app/api/_utils/api"
import { selectedPhotoWhere } from "@/app/api/_utils/photo"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    const targetProjectID = Number(body.targetProjectID)
    if (!Number.isFinite(targetProjectID)) return bad()
    if (!(await requireTeamManager(groupID, user.id))) return bad("无照片移动权限", 403)
    if (targetProjectID <= 0) {
      const result = await prisma.photo.updateMany({
        where: selectedPhotoWhere(body, groupID),
        data: { projectID: null, projectName: null } as never,
      })
      return ok({ movedCount: result.count })
    }
    const target = await prisma.project.findFirst({ where: { groupID, projectID: targetProjectID, deletedAt: null } })
    if (!target) return bad("目标项目不存在")
    const result = await prisma.photo.updateMany({
      where: selectedPhotoWhere(body, groupID),
      data: { projectID: targetProjectID, projectName: target.projectName },
    })
    return ok({ movedCount: result.count })
  } catch (err) {
    console.log("[app/photo/move/v1] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
