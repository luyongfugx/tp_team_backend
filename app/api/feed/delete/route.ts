import { NextResponse } from "next/server"
import { bad, canManage, ok, readBody, requireTeamMember, requireUser } from "@/app/api/_utils/api"
import { feedPrisma, findVisibleFeed } from "@/app/api/_utils/feed"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    const feedID = typeof body.feedID === "string" ? body.feedID : ""
    const member = await requireTeamMember(groupID, user.id)
    if (!member) return bad("无团队访问权限", 403)
    const feed = await findVisibleFeed(groupID, feedID)
    if (!feed) return bad("动态不存在")
    if (!canManage(member) && feed.createdByUserID !== user.id) return bad("无动态删除权限", 403)

    await feedPrisma.teamFeed.update({
      where: { feedID },
      data: { deletedAt: new Date() },
    })
    return ok()
  } catch (err) {
    console.log("[app/feed/delete] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
