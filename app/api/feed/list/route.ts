import { NextResponse } from "next/server"
import { bad, jsonSafe, ok, readBody, requireTeamMember, requireUser } from "@/app/api/_utils/api"
import { feedInclude, feedPrisma, mapFeed, pageFeedArgs, parseProjectID, validateProjectScope } from "@/app/api/_utils/feed"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const projectID = parseProjectID(body.projectID)
    if (Number.isNaN(projectID)) return bad("项目不正确")
    const requestedGroupID = typeof body.groupID === "string" ? body.groupID : ""
    const project = projectID == null
      ? null
      : await prisma.project.findFirst({
          where: {
            projectID,
            deletedAt: null,
            ...(requestedGroupID ? { groupID: requestedGroupID } : {}),
          },
          select: { groupID: true },
        })
    if (projectID != null && !project) return bad("项目不存在")
    const groupID = requestedGroupID || project?.groupID || ""
    if (!(await requireTeamMember(groupID, user.id))) return bad("无团队访问权限", 403)
    if (!(await validateProjectScope(groupID, projectID))) return bad("项目不存在")

    const { pageIndex, pageSize, skip, take } = pageFeedArgs(body)
    const teamOnly = body.scope === "teamOnly"
    const where = {
      groupID,
      deletedAt: null,
      ...(projectID == null ? (teamOnly ? { projectID: null } : {}) : { projectID }),
    }
    const [totalCount, feeds] = await Promise.all([
      feedPrisma.teamFeed.count({ where }),
      feedPrisma.teamFeed.findMany({
        where,
        include: feedInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
    ])

    return ok(jsonSafe({
      totalCount,
      pageIndex,
      pageSize,
      hasMore: skip + feeds.length < totalCount,
      list: feeds.map((feed) => mapFeed(feed, user.id)),
    }))
  } catch (err) {
    console.log("[app/feed/list] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
