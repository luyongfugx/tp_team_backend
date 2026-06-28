import { NextResponse } from "next/server"
import { bad, jsonSafe, ok, readBody, requireTeamMember, requireUser } from "@/app/api/_utils/api"
import { feedInclude, feedPrisma, mapFeed, parseFeedType, parseProjectID, validatePhotoScope, validateProjectScope } from "@/app/api/_utils/feed"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    if (!(await requireTeamMember(groupID, user.id))) return bad("无团队访问权限", 403)
    const projectID = parseProjectID(body.projectID)
    if (Number.isNaN(projectID)) return bad("项目不正确")
    if (!(await validateProjectScope(groupID, projectID))) return bad("项目不存在")

    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 120) : undefined
    const content = typeof body.content === "string" && body.content.trim() ? body.content.trim() : undefined
    const photoID = typeof body.photoID === "string" && body.photoID ? body.photoID : undefined
    const payload = body.payload && typeof body.payload === "object" ? body.payload : undefined
    if (!title && !content && !photoID && !payload) return bad("请输入动态内容")
    if (photoID && !(await validatePhotoScope(groupID, photoID, projectID))) return bad("照片不存在")

    const feed = await feedPrisma.teamFeed.create({
      data: {
        groupID,
        projectID,
        photoID,
        createdByUserID: user.id,
        feedType: parseFeedType(body.feedType || (photoID ? "PHOTO" : "TEXT")),
        title,
        content,
        payload,
      },
      include: feedInclude,
    })

    return ok({ feedInfo: jsonSafe(mapFeed(feed, user.id)) })
  } catch (err) {
    console.log("[app/feed/create] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
