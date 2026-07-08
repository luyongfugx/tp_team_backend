import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, canManage, ok, readBody, requireTeamMember, requireUser } from "@/app/api/_utils/api"
import { detachPhotosFromFeeds } from "@/app/api/_utils/feed"
import { batchPhotoWhereForUser, isForbiddenPersonalPhotoScene, selectedPhotoWhere } from "@/app/api/_utils/photo"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    const member = await requireTeamMember(groupID, user.id)
    if (!member) return bad("无团队访问权限", 403)
    if (isForbiddenPersonalPhotoScene(body, user.id)) return bad("个人详情只支持删除自己的照片", 403)
    const isManager = canManage(member)
    const baseWhere = selectedPhotoWhere(body, groupID)
    if (!isManager) {
      const forbiddenCount = await prisma.photo.count({
        where: { AND: [baseWhere, { userID: { not: user.id } }] },
      })
      if (forbiddenCount > 0) return bad("无照片删除权限", 403)
    }
    const deleteWhere = batchPhotoWhereForUser(body, groupID, user.id, isManager)
    const photos = await prisma.photo.findMany({
      where: deleteWhere,
      select: { photoID: true },
    })
    const photoIDs = photos.map((photo) => photo.photoID)
    const result = await prisma.photo.updateMany({
      where: deleteWhere,
      data: { deletedAt: new Date() },
    })
    await detachPhotosFromFeeds(groupID, photoIDs)
    return ok({ deletedCount: result.count })
  } catch (err) {
    console.log("[app/photo/delete/batch/v1] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
