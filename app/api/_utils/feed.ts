import type { TeamMember, User } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { canManage } from "@/app/api/_utils/api"

type FeedDelegatePrisma = typeof prisma & {
  teamFeed: {
    findFirst: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>
    findMany: (args: Record<string, unknown>) => Promise<Record<string, unknown>[]>
    count: (args: Record<string, unknown>) => Promise<number>
    create: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
    update: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
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

export async function findVisibleFeed(groupID: string, feedID: string) {
  if (!groupID || !feedID) return null
  return feedPrisma.teamFeed.findFirst({
    where: { groupID, feedID, deletedAt: null },
  })
}

export function canDeleteFeedItem(item: Record<string, unknown>, user: Pick<User, "id">, member: Pick<TeamMember, "role">) {
  return canManage(member) || item.createdByUserID === user.id || item.userID === user.id
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
    latestComments: comments.map(mapComment),
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
  likes: { select: { userID: true } },
  comments: {
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 3,
    include: { user: { select: { id: true, email: true, userName: true, shortName: true, avatar: true } } },
  },
}
