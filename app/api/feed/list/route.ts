import { NextResponse } from "next/server"
import { bad, jsonSafe, ok, readBody, requireTeamMember, requireUser } from "@/app/api/_utils/api"
import { feedInclude, feedPrisma, mapFeed, pageFeedArgs, parseProjectID, validateProjectScope } from "@/app/api/_utils/feed"
import { prisma } from "@/lib/prisma"

function timestampMillis(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (typeof value === "bigint") return Number(value)
  if (value instanceof Date) return value.getTime()
  if (typeof value === "string") {
    const numberValue = Number(value)
    if (Number.isFinite(numberValue)) return numberValue
    const dateValue = Date.parse(value)
    return Number.isFinite(dateValue) ? dateValue : 0
  }
  return 0
}

function feedOrderTimestamp(feed: Record<string, unknown>) {
  if (feed.feedType === "PHOTO" && Array.isArray(feed.feedPhotos)) {
    const photoTimestamps = feed.feedPhotos
      .map((item) => item && typeof item === "object" ? (item as Record<string, unknown>).photo : null)
      .filter((photo): photo is Record<string, unknown> => Boolean(photo) && typeof photo === "object" && !(photo as Record<string, unknown>).deletedAt)
      .map((photo) => timestampMillis(photo.timestamp))
      .filter((timestamp) => timestamp > 0)
    if (photoTimestamps.length > 0) return Math.min(...photoTimestamps)
  }
  return timestampMillis(feed.createdAt)
}

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
    const feedsForSort = await feedPrisma.teamFeed.findMany({
      where,
      select: {
        feedID: true,
        feedType: true,
        createdAt: true,
        feedPhotos: {
          select: {
            photo: { select: { timestamp: true, deletedAt: true } },
          },
        },
      },
    })
    const orderedFeedIDs = feedsForSort
      .sort((a, b) => feedOrderTimestamp(b) - feedOrderTimestamp(a))
      .map((feed) => String(feed.feedID))
    const pageFeedIDs = orderedFeedIDs.slice(skip, skip + take)
    const feeds = pageFeedIDs.length > 0
      ? await feedPrisma.teamFeed.findMany({
          where: { ...where, feedID: { in: pageFeedIDs } },
          include: feedInclude,
        })
      : []
    const feedsByID = new Map(feeds.map((feed) => [String(feed.feedID), feed]))
    const orderedFeeds = pageFeedIDs
      .map((feedID) => feedsByID.get(feedID))
      .filter((feed): feed is Record<string, unknown> => Boolean(feed))
    const totalCount = orderedFeedIDs.length

    return ok(jsonSafe({
      totalCount,
      pageIndex,
      pageSize,
      hasMore: skip + orderedFeeds.length < totalCount,
      list: orderedFeeds.map((feed) => mapFeed(feed, user.id)),
    }))
  } catch (err) {
    console.log("[app/feed/list] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
