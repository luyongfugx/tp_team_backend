import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, ok, readBody, requireTeamMember, requireUser } from "@/app/api/_utils/api"
import { feedPrisma, findOrCreateFeedForInteraction } from "@/app/api/_utils/feed"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    const feedID = typeof body.feedID === "string" ? body.feedID : ""
    if (!(await requireTeamMember(groupID, user.id))) return bad("无团队访问权限", 403)
    const feedResult = await findOrCreateFeedForInteraction(body, groupID, user.id, feedID)
    if (!feedResult.feed) return bad(feedResult.error || "动态不存在", feedResult.status || 400)
    const actualFeedID = String(feedResult.feed.feedID)

    const existing = await feedPrisma.teamFeedLike.findFirst({
      where: { groupID, feedID: actualFeedID, userID: user.id },
    })
    if (existing) return ok({ feedID: actualFeedID, feedCreated: Boolean(feedResult.created), likeID: existing.likeID, liked: true, alreadyLiked: true })

    const like = await prisma.$transaction(async (tx) => {
      const delegate = tx as unknown as typeof feedPrisma
      const created = await delegate.teamFeedLike.create({
        data: { groupID, feedID: actualFeedID, userID: user.id },
      })
      await delegate.teamFeed.update({
        where: { feedID: actualFeedID },
        data: { likeCount: { increment: 1 } },
      })
      return created
    })

    return ok({ feedID: actualFeedID, feedCreated: Boolean(feedResult.created), likeID: like.likeID, liked: true, alreadyLiked: false })
  } catch (err) {
    console.log("[app/feed/like/create] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
