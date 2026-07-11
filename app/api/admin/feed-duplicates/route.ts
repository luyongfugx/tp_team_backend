import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { bad, canManage, jsonSafe, ok, readBody, requireTeamMember, requireUser } from "@/app/api/_utils/api"
import { isSuperAdmin } from "@/app/api/_utils/admin"
import { detachPhotosFromFeeds } from "@/app/api/_utils/feed"
import { resolvePhotoURL, thumbnailPhotoURL } from "@/app/web/photo-url"

const feedPhotoSelect = {
  id: true,
  sortOrder: true,
  createdAt: true,
  photo: {
    select: {
      photoID: true,
      mediaType: true,
      timestamp: true,
      takePhotoFormatTime: true,
      takePhotoTimezoneID: true,
      largeURL: true,
      smallURL: true,
      ossFileName: true,
      mediaInfo: true,
      localPhotoName: true,
      userID: true,
      userName: true,
      userShortName: true,
      userAvatar: true,
      projectID: true,
      projectName: true,
      location: true,
      deletedAt: true,
      createdAt: true,
    },
  },
} satisfies Prisma.TeamFeedPhotoSelect

type FeedWithPhotos = Prisma.TeamFeedGetPayload<{
  include: {
    team: { select: { groupID: true; groupName: true } }
    project: { select: { projectID: true; projectName: true } }
    feedPhotos: { select: typeof feedPhotoSelect }
  }
}>

type FeedPhoto = FeedWithPhotos["feedPhotos"][number]["photo"]

function jsonObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function duplicateFingerprint(photo: FeedPhoto) {
  const mediaInfo = jsonObject(photo.mediaInfo)
  const mediaID = typeof mediaInfo?.mediaID === "string" && mediaInfo.mediaID.trim() ? mediaInfo.mediaID.trim() : null
  if (mediaID) return { key: `media:${mediaID}`, label: `mediaID: ${mediaID}` }

  const ossFileName = photo.ossFileName?.trim()
  if (ossFileName) return { key: `oss:${ossFileName}`, label: `ossFileName: ${ossFileName}` }

  const largeURL = photo.largeURL?.trim()
  if (largeURL) return { key: `url:${largeURL}`, label: `largeURL: ${largeURL}` }

  return null
}

function mapPhoto(photo: FeedPhoto, keepPhotoID: string) {
  const imageURL = resolvePhotoURL(photo.smallURL || photo.largeURL || photo.ossFileName)
  const mediaInfo = jsonObject(photo.mediaInfo)
  return {
    photoID: photo.photoID,
    keep: photo.photoID === keepPhotoID,
    mediaType: photo.mediaType,
    timestamp: Number(photo.timestamp),
    takePhotoFormatTime: photo.takePhotoFormatTime,
    takePhotoTimezoneID: photo.takePhotoTimezoneID,
    imageURL,
    thumbnailURL: thumbnailPhotoURL(imageURL),
    largeURL: resolvePhotoURL(photo.largeURL || photo.ossFileName),
    smallURL: resolvePhotoURL(photo.smallURL || photo.ossFileName),
    ossFileName: photo.ossFileName,
    mediaID: typeof mediaInfo?.mediaID === "string" ? mediaInfo.mediaID : null,
    localPhotoName: photo.localPhotoName,
    userID: photo.userID,
    userName: photo.userName,
    userShortName: photo.userShortName,
    userAvatar: photo.userAvatar,
    projectID: photo.projectID,
    projectName: photo.projectName,
    location: photo.location,
    createdAt: photo.createdAt,
  }
}

function duplicateGroups(feed: FeedWithPhotos) {
  const groups = new Map<string, { label: string; photos: FeedPhoto[] }>()
  for (const item of feed.feedPhotos) {
    if (!item.photo || item.photo.deletedAt) continue
    const fingerprint = duplicateFingerprint(item.photo)
    if (!fingerprint) continue
    const existing = groups.get(fingerprint.key)
    if (existing) {
      existing.photos.push(item.photo)
    } else {
      groups.set(fingerprint.key, { label: fingerprint.label, photos: [item.photo] })
    }
  }

  return Array.from(groups.entries())
    .filter(([, group]) => group.photos.length > 1)
    .map(([fingerprint, group]) => {
      const keepPhotoID = group.photos[0].photoID
      return {
        fingerprint,
        label: group.label,
        keepPhotoID,
        duplicateCount: group.photos.length - 1,
        photos: group.photos.map((photo) => mapPhoto(photo, keepPhotoID)),
      }
    })
}

async function loadFeed(feedID: string) {
  return prisma.teamFeed.findFirst({
    where: { feedID, deletedAt: null },
    include: {
      team: { select: { groupID: true, groupName: true } },
      project: { select: { projectID: true, projectName: true } },
      feedPhotos: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: feedPhotoSelect,
      },
    },
  })
}

async function assertCanManageFeed(req: Request, feedID: string) {
  const user = await requireUser(req)
  if (!user) return { error: "未授权或登录已过期", status: 401 as const }
  const feed = await loadFeed(feedID)
  if (!feed) return { error: "动态不存在", status: 404 as const }
  const member = await requireTeamMember(feed.groupID, user.id)
  if (!isSuperAdmin(user) && !canManage(member)) {
    return { error: "无重复照片处理权限", status: 403 as const }
  }
  return { user, feed }
}

export async function POST(req: Request) {
  try {
    const body = await readBody(req)
    const feedID = typeof body.feedID === "string" ? body.feedID.trim() : ""
    if (!feedID) return bad("请输入 feedID")

    const result = await assertCanManageFeed(req, feedID)
    if ("error" in result) return bad(result.error, result.status)

    if (body.action === "delete") {
      const photoID = typeof body.photoID === "string" ? body.photoID.trim() : ""
      if (!photoID) return bad("请输入 photoID")
      const groups = duplicateGroups(result.feed)
      const group = groups.find((item) => item.photos.some((photo) => photo.photoID === photoID))
      if (!group) return bad("该照片不在重复组内，不能通过此页面删除")
      if (group.keepPhotoID === photoID) return bad("保留照片不能删除，请删除重复项")

      await prisma.photo.update({
        where: { photoID },
        data: { deletedAt: new Date() },
      })
      await detachPhotosFromFeeds(result.feed.groupID, [photoID])

      const refreshedFeed = await loadFeed(feedID)
      return ok(jsonSafe({
        deletedPhotoID: photoID,
        feed: refreshedFeed
          ? {
              feedID: refreshedFeed.feedID,
              groupID: refreshedFeed.groupID,
              groupName: refreshedFeed.team.groupName,
              projectID: refreshedFeed.projectID,
              projectName: refreshedFeed.project?.projectName ?? null,
              duplicateGroups: duplicateGroups(refreshedFeed),
            }
          : null,
      }))
    }

    return ok(jsonSafe({
      feed: {
        feedID: result.feed.feedID,
        groupID: result.feed.groupID,
        groupName: result.feed.team.groupName,
        projectID: result.feed.projectID,
        projectName: result.feed.project?.projectName ?? null,
        photoCount: result.feed.feedPhotos.filter((item) => item.photo && !item.photo.deletedAt).length,
        duplicateGroups: duplicateGroups(result.feed),
      },
    }))
  } catch (err) {
    console.log("[app/admin/feed-duplicates] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
