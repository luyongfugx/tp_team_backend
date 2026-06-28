import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, ok, readBody, requireTeamMember, requireUser } from "@/app/api/_utils/api"
import { feedPrisma, findVisibleFeed } from "@/app/api/_utils/feed"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    const feedID = typeof body.feedID === "string" ? body.feedID : ""
    if (!(await requireTeamMember(groupID, user.id))) return bad("无团队访问权限", 403)
    const feed = await findVisibleFeed(groupID, feedID)
    if (!feed) return bad("动态不存在")

    const existing = await feedPrisma.teamFeedLike.findFirst({
      where: { groupID, feedID, userID: user.id },
    })
    if (!existing) return ok({ liked: false, deleted: false })

    const decrement = Number(feed.likeCount || 0) > 0 ? 1 : 0
    await prisma.$transaction(async (tx) => {
      const delegate = tx as unknown as typeof feedPrisma
      await delegate.teamFeedLike.delete({ where: { likeID: existing.likeID } })
      if (decrement) {
        await delegate.teamFeed.update({
          where: { feedID },
          data: { likeCount: { decrement } },
        })
      }
    })

    return ok({ liked: false, deleted: true })
  } catch (err) {
    console.log("[app/feed/like/delete] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
