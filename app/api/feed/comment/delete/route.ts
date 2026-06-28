import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, ok, readBody, requireTeamMember, requireUser } from "@/app/api/_utils/api"
import { canDeleteFeedItem, feedPrisma, findVisibleFeed } from "@/app/api/_utils/feed"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    const commentID = typeof body.commentID === "string" ? body.commentID : ""
    const member = await requireTeamMember(groupID, user.id)
    if (!member) return bad("无团队访问权限", 403)
    const comment = await feedPrisma.teamFeedComment.findFirst({
      where: { groupID, commentID, deletedAt: null },
    })
    if (!comment) return bad("评论不存在")
    const feed = await findVisibleFeed(groupID, String(comment.feedID || ""))
    if (!feed) return bad("动态不存在")
    if (!canDeleteFeedItem(comment, user, member)) return bad("无评论删除权限", 403)

    const decrement = Number(feed.commentCount || 0) > 0 ? 1 : 0
    await prisma.$transaction(async (tx) => {
      const delegate = tx as unknown as typeof feedPrisma
      await delegate.teamFeedComment.update({
        where: { commentID },
        data: { deletedAt: new Date() },
      })
      if (decrement) {
        await delegate.teamFeed.update({
          where: { feedID: feed.feedID },
          data: { commentCount: { decrement } },
        })
      }
    })

    return ok()
  } catch (err) {
    console.log("[app/feed/comment/delete] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
