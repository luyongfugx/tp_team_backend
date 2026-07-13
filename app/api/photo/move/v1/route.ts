import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, canManage, ok, readBody, requireTeamMember, requireUser } from "@/app/api/_utils/api"
import { createPhotoFeedForMovedPhotos, detachPhotosFromFeeds } from "@/app/api/_utils/feed"
import { batchPhotoWhereForUser, isForbiddenPersonalPhotoScene, selectedPhotoWhere } from "@/app/api/_utils/photo"

function groupPhotosByUser(photos: Array<{ photoID: string; userID: string; timestamp: bigint }>) {
  const grouped = new Map<string, Array<{ photoID: string; timestamp: bigint }>>()
  for (const photo of photos) {
    const list = grouped.get(photo.userID) ?? []
    list.push({ photoID: photo.photoID, timestamp: photo.timestamp })
    grouped.set(photo.userID, list)
  }
  return grouped
}

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
    const photos = await prisma.photo.findMany({
      where: moveWhere,
      select: { photoID: true, userID: true, timestamp: true },
      orderBy: { timestamp: "asc" },
    })
    const photoIDs = photos.map((photo) => photo.photoID)
    const createdFeedIDs: string[] = []
    if (targetProjectID <= 0) {
      const result = await prisma.photo.updateMany({
        where: moveWhere,
        data: { projectID: null, projectName: null } as never,
      })
      await detachPhotosFromFeeds(groupID, photoIDs)
      const photosByUser = groupPhotosByUser(photos)
      for (const [ownerID, ownerPhotos] of photosByUser) {
        const feedIDs = await createPhotoFeedForMovedPhotos({
          groupID,
          projectID: null,
          userID: ownerID,
          photos: ownerPhotos,
        })
        createdFeedIDs.push(...feedIDs)
      }
      return ok({ movedCount: result.count, feedIDs: createdFeedIDs })
    }
    const target = await prisma.project.findFirst({ where: { groupID, projectID: targetProjectID, deletedAt: null } })
    if (!target) return bad("目标项目不存在")
    const result = await prisma.photo.updateMany({
      where: moveWhere,
      data: { projectID: targetProjectID, projectName: target.projectName },
    })
    await detachPhotosFromFeeds(groupID, photoIDs)
    const photosByUser = groupPhotosByUser(photos)
    for (const [ownerID, ownerPhotos] of photosByUser) {
      const feedIDs = await createPhotoFeedForMovedPhotos({
        groupID,
        projectID: targetProjectID,
        userID: ownerID,
        photos: ownerPhotos,
      })
      createdFeedIDs.push(...feedIDs)
    }
    return ok({ movedCount: result.count, feedIDs: createdFeedIDs })
  } catch (err) {
    console.log("[app/photo/move/v1] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
