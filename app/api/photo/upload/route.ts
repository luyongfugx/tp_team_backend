import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { bad, jsonSafe, ok, readBody, requireTeamMember, requireUser } from "@/app/api/_utils/api"
import { feedAggregationWindowMs } from "@/app/api/_utils/feed"

type FeedPhotoDelegate = {
  teamFeed: {
    findFirst: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>
    create: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
    update: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
  }
  teamFeedPhoto: {
    createMany: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
  }
}

function maybeJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value == null) return undefined
  if (typeof value !== "string") return value
  try {
    return JSON.parse(value) as Prisma.InputJsonValue
  } catch {
    return value
  }
}

async function attachPhotoToRecentFeed({
  groupID,
  projectID,
  userID,
  photoID,
}: {
  groupID: string
  projectID?: number
  userID: string
  photoID: string
}) {
  const delegate = prisma as never as FeedPhotoDelegate
  const windowStart = new Date(Date.now() - feedAggregationWindowMs())
  const feed = await delegate.teamFeed.findFirst({
    where: {
      groupID,
      projectID: projectID ?? null,
      createdByUserID: userID,
      feedType: "PHOTO",
      deletedAt: null,
      createdAt: { gte: windowStart },
    },
    orderBy: { createdAt: "desc" },
  })
  const targetFeed = feed ?? await delegate.teamFeed.create({
    data: {
      groupID,
      projectID: projectID ?? null,
      photoID,
      createdByUserID: userID,
      feedType: "PHOTO",
    },
  })
  await delegate.teamFeedPhoto.createMany({
    data: [{ feedID: targetFeed.feedID, groupID, photoID }],
    skipDuplicates: true,
  })
  if (feed) {
    await delegate.teamFeed.update({
      where: { feedID: targetFeed.feedID },
      data: { updatedAt: new Date() },
    })
  }
  return String(targetFeed.feedID)
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    const projectID = body.projectID == null ? undefined : Number(body.projectID)
    const timestamp = Number(body.takePhotoTimestamp)
    if (!groupID || !Number.isFinite(timestamp)) return bad()
    if (typeof body.ossFileName !== "string" || !body.ossFileName) return bad()
    if (typeof body.takePhotoFormatTime !== "string" || typeof body.takePhotoTimezoneID !== "string") return bad()
    if (!(await requireTeamMember(groupID, user.id))) return bad("无团队访问权限", 403)

    const hasProject = projectID != null && Number.isFinite(projectID) && projectID > 0
    const project = hasProject
      ? await prisma.project.findFirst({ where: { groupID, projectID, deletedAt: null } })
      : null
    if (hasProject && !project) return bad("项目不存在")

    const mediaInfo = maybeJson(body.mediaInfo)
    const mediaObject = mediaInfo && typeof mediaInfo === "object" && !Array.isArray(mediaInfo)
      ? mediaInfo as Record<string, unknown>
      : undefined
    const baseURL = process.env.COS_PUBLIC_BASE_URL || ""
    const fallbackURL = baseURL ? `${baseURL.replace(/\/$/, "")}/${body.ossFileName}` : undefined
    const largeURL = typeof mediaObject?.imageUrl === "string"
      ? mediaObject.imageUrl
      : typeof mediaObject?.videoUrl === "string"
        ? mediaObject.videoUrl
        : fallbackURL
    const duration = mediaObject?.duration == null ? undefined : Number(mediaObject.duration)

    const photo = await prisma.photo.create({
      data: {
        groupID,
        projectID: project?.projectID,
        userID: user.id,
        mediaType: body.mediaType == null ? 0 : Number(body.mediaType),
        timestamp: BigInt(timestamp),
        takePhotoFormatTime: body.takePhotoFormatTime,
        takePhotoTimezoneID: body.takePhotoTimezoneID,
        duration: Number.isFinite(duration) ? duration : undefined,
        largeURL,
        smallURL: largeURL,
        userName: user.userName,
        userShortName: user.shortName,
        userAvatar: user.avatar,
        projectName: project?.projectName,
        antiFakeCode: typeof body.antiFakeCode === "string" ? body.antiFakeCode : undefined,
        ossFileName: body.ossFileName,
        localPhotoName: typeof body.localPhotoName === "string" ? body.localPhotoName : undefined,
        location: typeof body.location === "string" ? body.location : undefined,
        lat: body.lat == null ? undefined : String(body.lat),
        lng: body.lng == null ? undefined : String(body.lng),
        watermarkID: typeof body.watermarkID === "string" ? body.watermarkID : undefined,
        watermarkBaseID: typeof body.watermarkBaseID === "string" ? body.watermarkBaseID : undefined,
        saveToDevice: body.saveToDevice == null ? undefined : Number(body.saveToDevice),
        timeInfo: maybeJson(body.timeInfo),
        addressInfo: maybeJson(body.addressInfo),
        watermarkInfo: maybeJson(body.watermarkInfo),
        systemInfo: maybeJson(body.systemInfo),
        mediaInfo,
        attendanceInfo: maybeJson(body.attendanceInfo),
        searchText: [body.location, body.antiFakeCode, body.localPhotoName, project?.projectName, user.userName].filter(Boolean).join(" "),
      } as never,
    })

    const updates = [
      prisma.teamMember.update({
        where: { groupID_userID: { groupID, userID: user.id } },
        data: {
          photoCount: { increment: 1 },
          latestPhotoTimestamp: BigInt(timestamp),
          latestPhotoSmallURL: largeURL,
          latestPhotoTimeInterval: Math.max(Date.now() - timestamp, 0),
        },
      }),
      ...(project
        ? [
            prisma.project.update({
              where: { projectID: project.projectID },
              data: {
                photoCount: { increment: 1 },
                latestPhotoTimestamp: BigInt(timestamp),
                latestPhotoSmallURL: largeURL,
              },
            }),
          ]
        : []),
    ]
    await prisma.$transaction(updates)
    const feedID = await attachPhotoToRecentFeed({
      groupID,
      projectID: project?.projectID,
      userID: user.id,
      photoID: photo.photoID,
    })

    return ok({ photoID: photo.photoID, feedID })
  } catch (err) {
    console.log("[app/photo/upload] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
