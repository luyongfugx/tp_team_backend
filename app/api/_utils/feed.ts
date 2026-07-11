import type { TeamMember, User } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { asStringArray, canManage } from "@/app/api/_utils/api"

type FeedDelegatePrisma = typeof prisma & {
  teamFeed: {
    findFirst: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>
    findMany: (args: Record<string, unknown>) => Promise<Record<string, unknown>[]>
    count: (args: Record<string, unknown>) => Promise<number>
    create: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
    update: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
  }
  teamFeedPhoto: {
    findMany: (args: Record<string, unknown>) => Promise<Record<string, unknown>[]>
    createMany: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
    deleteMany: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
  }
  teamFeedComment: {
    findFirst: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>
    findMany: (args: Record<string, unknown>) => Promise<Record<string, unknown>[]>
    create: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
    update: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
  }
  teamFeedLike: {
    findFirst: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>
    create: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
    delete: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
  }
}

export const feedPrisma = prisma as FeedDelegatePrisma

export function feedAggregationWindowMs() {
  const ms = Number(process.env.TEAM_FEED_AGGREGATION_MS)
  if (Number.isFinite(ms) && ms > 0) return ms
  const minutes = Number(process.env.TEAM_FEED_AGGREGATION_MINUTES ?? 5)
  return (Number.isFinite(minutes) && minutes > 0 ? minutes : 5) * 60 * 1000
}

export function pageFeedArgs(body: Record<string, unknown>, defaultSize = 20) {
  const pageIndex = Math.max(Number(body.pageIndex ?? 1), 1)
  const pageSize = Math.min(Math.max(Number(body.pageSize ?? defaultSize), 1), 100)
  return { pageIndex, pageSize, skip: (pageIndex - 1) * pageSize, take: pageSize }
}

export function parseProjectID(value: unknown) {
  if (value == null || value === "" || value === 0 || value === "0") return null
  const projectID = Number(value)
  return Number.isFinite(projectID) && projectID > 0 ? projectID : Number.NaN
}

export function parseFeedType(value: unknown) {
  if (value === "PHOTO" || value === "SYSTEM") return value
  return "TEXT"
}

export async function validateProjectScope(groupID: string, projectID: number | null) {
  if (projectID == null) return true
  const project = await prisma.project.findFirst({ where: { groupID, projectID, deletedAt: null }, select: { projectID: true } })
  return Boolean(project)
}

export async function validatePhotoScope(groupID: string, photoID: string, projectID: number | null) {
  if (!photoID) return true
  const photo = await prisma.photo.findFirst({
    where: {
      groupID,
      photoID,
      deletedAt: null,
      ...(projectID == null ? {} : { projectID }),
    },
    select: { photoID: true },
  })
  return Boolean(photo)
}

export function parseFeedPhotoIDs(body: Record<string, unknown>) {
  const photoIDs = [
    ...asStringArray(body.photoIDs),
    ...asStringArray(body.photoID),
  ].map((item) => item.trim()).filter(Boolean)
  return Array.from(new Set(photoIDs))
}

export async function validatePhotoScopes(groupID: string, photoIDs: string[], projectID: number | null) {
  if (photoIDs.length === 0) return true
  const count = await prisma.photo.count({
    where: {
      groupID,
      photoID: { in: photoIDs },
      deletedAt: null,
      ...(projectID == null ? {} : { projectID }),
    },
  })
  return count === photoIDs.length
}

export async function attachPhotosToFeed(feedID: string, groupID: string, photoIDs: string[]) {
  const uniquePhotoIDs = Array.from(new Set(photoIDs.filter(Boolean)))
  if (uniquePhotoIDs.length === 0) return
  await feedPrisma.teamFeedPhoto.createMany({
    data: uniquePhotoIDs.map((photoID, index) => ({ feedID, groupID, photoID, sortOrder: index })),
    skipDuplicates: true,
  })
  await feedPrisma.teamFeed.update({
    where: { feedID },
    data: { updatedAt: new Date() },
  })
}

async function refreshFeedsAfterPhotoDetach(feedIDs: string[]) {
  const uniqueFeedIDs = Array.from(new Set(feedIDs.filter(Boolean)))
  for (const feedID of uniqueFeedIDs) {
    const remaining = await feedPrisma.teamFeedPhoto.findMany({
      where: { feedID, photo: { deletedAt: null } },
      orderBy: { sortOrder: "asc" },
      include: { photo: { select: { photoID: true, projectID: true } } },
    })
    if (remaining.length === 0) {
      await feedPrisma.teamFeed.update({
        where: { feedID },
        data: { deletedAt: new Date(), photoID: null, updatedAt: new Date() },
      })
      continue
    }
    const first = remaining[0].photo as Record<string, unknown>
    await feedPrisma.teamFeed.update({
      where: { feedID },
      data: {
        photoID: first.photoID,
        projectID: first.projectID ?? null,
        updatedAt: new Date(),
      },
    })
  }
}

export async function detachPhotosFromFeeds(groupID: string, photoIDs: string[]) {
  const uniquePhotoIDs = Array.from(new Set(photoIDs.filter(Boolean)))
  if (uniquePhotoIDs.length === 0) return
  const feedPhotos = await feedPrisma.teamFeedPhoto.findMany({
    where: { groupID, photoID: { in: uniquePhotoIDs } },
    select: { feedID: true },
  })
  const feedIDs = feedPhotos.map((item) => String(item.feedID))
  await feedPrisma.teamFeedPhoto.deleteMany({
    where: { groupID, photoID: { in: uniquePhotoIDs } },
  })
  await refreshFeedsAfterPhotoDetach(feedIDs)
}

export async function createPhotoFeedForMovedPhotos({
  groupID,
  projectID,
  userID,
  photoIDs,
}: {
  groupID: string
  projectID: number | null
  userID: string
  photoIDs: string[]
}) {
  const uniquePhotoIDs = Array.from(new Set(photoIDs.filter(Boolean)))
  if (uniquePhotoIDs.length === 0) return null
  const feed = await feedPrisma.teamFeed.create({
    data: {
      groupID,
      projectID,
      photoID: uniquePhotoIDs[0],
      createdByUserID: userID,
      feedType: "PHOTO",
    },
  })
  await attachPhotosToFeed(String(feed.feedID), groupID, uniquePhotoIDs)
  return String(feed.feedID)
}

export async function findVisibleFeed(groupID: string, feedID: string) {
  if (!groupID || !feedID) return null
  return feedPrisma.teamFeed.findFirst({
    where: { groupID, feedID, deletedAt: null },
  })
}

export async function findOrCreateFeedForInteraction(
  body: Record<string, unknown>,
  groupID: string,
  userID: string,
  feedID: string,
) {
  const existing = await findVisibleFeed(groupID, feedID)
  if (existing) return { feed: existing, created: false }

  const projectID = parseProjectID(body.projectID)
  if (Number.isNaN(projectID)) return { error: "项目不正确", status: 400 }
  if (!(await validateProjectScope(groupID, projectID))) return { error: "项目不存在", status: 400 }

  const photoIDs = parseFeedPhotoIDs(body)
  const photoID = photoIDs[0]
  if (!(await validatePhotoScopes(groupID, photoIDs, projectID))) return { error: "照片不存在", status: 400 }

  const title = typeof body.feedTitle === "string" && body.feedTitle.trim()
    ? body.feedTitle.trim().slice(0, 120)
    : typeof body.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 120)
      : undefined
  const content = typeof body.feedContent === "string" && body.feedContent.trim() ? body.feedContent.trim() : undefined
  const payload = body.feedPayload && typeof body.feedPayload === "object"
    ? body.feedPayload
    : body.payload && typeof body.payload === "object"
      ? body.payload
      : undefined

  const feed = await feedPrisma.teamFeed.create({
    data: {
      ...(feedID ? { feedID } : {}),
      groupID,
      projectID,
      photoID,
      createdByUserID: userID,
      feedType: parseFeedType(body.feedType || (photoID ? "PHOTO" : "TEXT")),
      title,
      content,
      payload,
    },
  })
  await attachPhotosToFeed(String(feed.feedID), groupID, photoIDs)
  return { feed, created: true }
}

export function canDeleteFeedItem(item: Record<string, unknown>, user: Pick<User, "id">, member: Pick<TeamMember, "role">) {
  return canManage(member) || item.createdByUserID === user.id || item.userID === user.id
}

function feedPhotoFingerprint(photo: Record<string, unknown>) {
  const mediaInfo = photo.mediaInfo && typeof photo.mediaInfo === "object" ? photo.mediaInfo as Record<string, unknown> : null
  const mediaID = mediaInfo && typeof mediaInfo.mediaID === "string" && mediaInfo.mediaID.trim() ? mediaInfo.mediaID.trim() : null
  if (mediaID) return `media:${mediaID}`
  const ossFileName = typeof photo.ossFileName === "string" && photo.ossFileName.trim() ? photo.ossFileName.trim() : null
  if (ossFileName) return `oss:${ossFileName}`
  const largeURL = typeof photo.largeURL === "string" && photo.largeURL.trim() ? photo.largeURL.trim() : null
  if (largeURL) return `url:${largeURL}`
  return null
}

function visibleUniqueFeedPhotos(item: Record<string, unknown>) {
  if (!Array.isArray(item.feedPhotos)) return []
  const seen = new Set<string>()
  return item.feedPhotos
    .map((feedPhoto) => feedPhoto && typeof feedPhoto === "object" ? (feedPhoto as Record<string, unknown>).photo : null)
    .filter((photo): photo is Record<string, unknown> => Boolean(photo) && typeof photo === "object" && !(photo as Record<string, unknown>).deletedAt)
    .filter((photo) => {
      const fingerprint = feedPhotoFingerprint(photo)
      if (!fingerprint) return true
      if (seen.has(fingerprint)) return false
      seen.add(fingerprint)
      return true
    })
}

export function mapFeed(item: Record<string, unknown>, currentUserID: string) {
  const creator = item.createdBy && typeof item.createdBy === "object" ? item.createdBy as Record<string, unknown> : null
  const comments = Array.isArray(item.comments) ? item.comments : []
  const likes = Array.isArray(item.likes) ? item.likes : []
  return {
    feedID: item.feedID,
    groupID: item.groupID,
    projectID: item.projectID,
    photoID: item.photoID,
    photos: visibleUniqueFeedPhotos(item).map(mapFeedPhoto),
    feedType: item.feedType,
    title: item.title,
    content: item.content,
    payload: item.payload,
    commentCount: item.commentCount,
    likeCount: item.likeCount,
    likedByMe: likes.some((like) => like && typeof like === "object" && (like as Record<string, unknown>).userID === currentUserID),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    createdBy: creator
      ? {
          userID: creator.id,
          userName: creator.userName,
          shortName: creator.shortName,
          email: creator.email,
          avatar: creator.avatar,
        }
      : null,
    likedUsers: likes
      .map((like) => like && typeof like === "object" ? (like as Record<string, unknown>).user : null)
      .filter((user): user is Record<string, unknown> => Boolean(user))
      .map((user) => ({
        userID: user.id,
        userName: user.userName,
        shortName: user.shortName,
        email: user.email,
        avatar: user.avatar,
      })),
    latestComments: comments.map(mapComment),
  }
}

function mapFeedPhoto(item: Record<string, unknown>) {
  const timeInfo = item.timeInfo && typeof item.timeInfo === "object" ? item.timeInfo as Record<string, unknown> : null
  const mediaInfo = item.mediaInfo && typeof item.mediaInfo === "object" ? item.mediaInfo as Record<string, unknown> : null
  return {
    photoID: item.photoID,
    mediaType: item.mediaType,
    timestamp: item.timestamp,
    timezoneID: item.takePhotoTimezoneID,
    timezoneAbbreviation: timeInfo && typeof timeInfo.timezoneAbbreviation === "string" ? timeInfo.timezoneAbbreviation : null,
    duration: item.duration,
    largeURL: item.largeURL,
    smallURL: item.smallURL,
    ossFileName: item.ossFileName,
    mediaID: mediaInfo && typeof mediaInfo.mediaID === "string" ? mediaInfo.mediaID : null,
    imageWidth: mediaInfo && typeof mediaInfo.imageWidth === "number" ? mediaInfo.imageWidth : null,
    imageHeight: mediaInfo && typeof mediaInfo.imageHeight === "number" ? mediaInfo.imageHeight : null,
    localPhotoName: item.localPhotoName,
    userID: item.userID,
    userName: item.userName,
    userShortName: item.userShortName,
    userAvatar: item.userAvatar,
    projectID: item.projectID,
    projectName: item.projectName,
    location: item.location,
    lat: item.lat,
    lng: item.lng,
  }
}

export function mapComment(item: unknown) {
  const comment = item && typeof item === "object" ? item as Record<string, unknown> : {}
  const user = comment.user && typeof comment.user === "object" ? comment.user as Record<string, unknown> : null
  return {
    commentID: comment.commentID,
    feedID: comment.feedID,
    groupID: comment.groupID,
    content: comment.content,
    createdAt: comment.createdAt,
    user: user
      ? {
          userID: user.id,
          userName: user.userName,
          shortName: user.shortName,
          email: user.email,
          avatar: user.avatar,
        }
      : null,
  }
}

export const feedInclude = {
  createdBy: { select: { id: true, email: true, userName: true, shortName: true, avatar: true } },
  feedPhotos: {
    orderBy: { sortOrder: "asc" },
    include: {
      photo: {
        select: {
          photoID: true,
          mediaType: true,
          timestamp: true,
          takePhotoTimezoneID: true,
          duration: true,
          largeURL: true,
          smallURL: true,
          ossFileName: true,
          timeInfo: true,
          mediaInfo: true,
          deletedAt: true,
          localPhotoName: true,
          userID: true,
          userName: true,
          userShortName: true,
          userAvatar: true,
          projectID: true,
          projectName: true,
          location: true,
          lat: true,
          lng: true,
        },
      },
    },
  },
  likes: {
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, email: true, userName: true, shortName: true, avatar: true } } },
  },
  comments: {
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, email: true, userName: true, shortName: true, avatar: true } } },
  },
}
