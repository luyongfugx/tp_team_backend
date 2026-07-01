import type { Prisma } from "@prisma/client"
import { asNumberArray, asStringArray, rangeWhere } from "@/app/api/_utils/api"

export function photoWhere(body: Record<string, unknown>, groupID: string): Prisma.PhotoWhereInput {
  const projectIDs = asNumberArray(body.projectID)
  const colleagueUserIDs = asStringArray(body.colleagueUserID)
  const mediaTypes = asNumberArray(body.mediaType)
  const topLeft = body.topLeft as { lat?: unknown; lng?: unknown } | undefined
  const bottomRight = body.bottomRight as { lat?: unknown; lng?: unknown } | undefined
  const searchKey = typeof body.searchKey === "string" ? body.searchKey.trim() : ""

  return {
    groupID,
    deletedAt: null,
    timestamp: rangeWhere(body.rangeSelected),
    projectID: projectIDs.length ? { in: projectIDs } : undefined,
    userID: colleagueUserIDs.length ? { in: colleagueUserIDs } : undefined,
    mediaType: mediaTypes.length ? { in: mediaTypes } : undefined,
    lat: topLeft?.lat != null && bottomRight?.lat != null
      ? { gte: String(bottomRight.lat), lte: String(topLeft.lat) }
      : undefined,
    lng: topLeft?.lng != null && bottomRight?.lng != null
      ? { gte: String(topLeft.lng), lte: String(bottomRight.lng) }
      : undefined,
    OR: searchKey
      ? [
          { location: { contains: searchKey } },
          { projectName: { contains: searchKey } },
          { userName: { contains: searchKey } },
          { localPhotoName: { contains: searchKey } },
          { antiFakeCode: { contains: searchKey } },
          { searchText: { contains: searchKey } },
        ]
      : undefined,
  }
}

export function photoSelect() {
  return {
    photoID: true,
    mediaType: true,
    timestamp: true,
    duration: true,
    largeURL: true,
    smallURL: true,
    userID: true,
    userName: true,
    userShortName: true,
    userAvatar: true,
    user: { select: { userName: true, shortName: true, avatar: true } },
    projectID: true,
    projectName: true,
    antiFakeCode: true,
    ossFileName: true,
    localPhotoName: true,
    location: true,
    lat: true,
    lng: true,
    createdAt: true,
  } satisfies Prisma.PhotoSelect
}

export function mapPhotoWithUserFallback(photo: Prisma.PhotoGetPayload<{ select: ReturnType<typeof photoSelect> }>) {
  const { user, ...payload } = photo
  return {
    ...payload,
    userName: payload.userName || user.userName,
    userShortName: payload.userShortName || user.shortName,
    userAvatar: payload.userAvatar || user.avatar,
  }
}

export function selectedPhotoWhere(
  body: Record<string, unknown>,
  groupID: string,
): Prisma.PhotoWhereInput {
  const rangeSelected = Boolean(body.rangeSelected)
  const selectedPhotoIDs = asStringArray(body.selectedPhotoIDs)
  const unSelectedPhotoIDs = asStringArray(body.unSelectedPhotoIDs)
  if (!rangeSelected) return { groupID, deletedAt: null, photoID: { in: selectedPhotoIDs } }
  return {
    ...photoWhere(body, groupID),
    photoID: unSelectedPhotoIDs.length ? { notIn: unSelectedPhotoIDs } : undefined,
  }
}

export function batchPhotoWhereForUser(
  body: Record<string, unknown>,
  groupID: string,
  currentUserID: string,
  canManageTeamPhotos: boolean,
): Prisma.PhotoWhereInput {
  const scene = typeof body.scene === "string" ? body.scene : ""
  const isPersonalScene = ["user", "personal", "member"].includes(scene)
  const where = selectedPhotoWhere(body, groupID)

  if (isPersonalScene) {
    return { ...where, userID: currentUserID }
  }

  if (!canManageTeamPhotos) {
    return { ...where, userID: currentUserID }
  }

  return where
}

export function isForbiddenPersonalPhotoScene(body: Record<string, unknown>, currentUserID: string) {
  const scene = typeof body.scene === "string" ? body.scene : ""
  if (!["user", "personal", "member"].includes(scene)) return false
  const detailUserIDs = asStringArray(body.userID || body.userIDs || body.colleagueUserID)
  return detailUserIDs.length > 0 && (detailUserIDs.length !== 1 || detailUserIDs[0] !== currentUserID)
}
