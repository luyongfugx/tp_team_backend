import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, jsonSafe, ok, pageArgs, readBody, requireTeamMember, requireUser } from "@/app/api/_utils/api"
import { mapPhotoWithUserFallback, photoSelect, photoWhere } from "@/app/api/_utils/photo"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    if (!(await requireTeamMember(groupID, user.id))) return bad("无团队访问权限", 403)
    const where = photoWhere(body, groupID)
    const [totalCount, photos, contributors] = await Promise.all([
      prisma.photo.count({ where }),
      prisma.photo.findMany({ where, select: photoSelect(), orderBy: { timestamp: "desc" }, ...pageArgs(body) }),
      prisma.photo.groupBy({
        by: ["userID"],
        where,
        _count: { photoID: true },
        orderBy: { _count: { photoID: "desc" } },
        take: 20,
      }),
    ])
    return ok({ totalCount, photos: jsonSafe(photos.map(mapPhotoWithUserFallback)), contributors: jsonSafe(contributors) })
  } catch (err) {
    console.log("[app/photo/list/v1] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
