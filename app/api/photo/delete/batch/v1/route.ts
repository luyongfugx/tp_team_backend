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
    if (!(await requireTeamManager(groupID, user.id))) return bad("无照片删除权限", 403)
    const result = await prisma.photo.updateMany({
      where: selectedPhotoWhere(body, groupID),
      data: { deletedAt: new Date() },
    })
    return ok({ deletedCount: result.count })
  } catch (err) {
    console.log("[app/photo/delete/batch/v1] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
