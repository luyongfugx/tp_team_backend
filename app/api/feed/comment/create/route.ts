import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, jsonSafe, ok, readBody, requireTeamMember, requireUser } from "@/app/api/_utils/api"
import { feedPrisma, findVisibleFeed, mapComment } from "@/app/api/_utils/feed"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    const feedID = typeof body.feedID === "string" ? body.feedID : ""
    const content = typeof body.content === "string" ? body.content.trim() : ""
    if (!content) return bad("请输入评论内容")
    if (content.length > 2000) return bad("评论内容不能超过 2000 个字符")
    if (!(await requireTeamMember(groupID, user.id))) return bad("无团队访问权限", 403)
    const feed = await findVisibleFeed(groupID, feedID)
    if (!feed) return bad("动态不存在")

    const comment = await prisma.$transaction(async (tx) => {
      const delegate = tx as unknown as typeof feedPrisma
      const created = await delegate.teamFeedComment.create({
        data: { feedID, groupID, userID: user.id, content },
        include: { user: { select: { id: true, email: true, userName: true, shortName: true, avatar: true } } },
      })
      await delegate.teamFeed.update({
        where: { feedID },
        data: { commentCount: { increment: 1 } },
      })
      return created
    })

    return ok({ commentInfo: jsonSafe(mapComment(comment)) })
  } catch (err) {
    console.log("[app/feed/comment/create] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
