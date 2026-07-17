import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { WebPhoto, WebPhotoDay } from "@/components/web/photo-gallery"
import { resolvePhotoURL, thumbnailPhotoURL } from "@/app/web/photo-url"
import { localeDateCode, resolveLocale, type AppLocale } from "@/lib/i18n"

const photoSelect = {
  photoID: true,
  timestamp: true,
  takePhotoFormatTime: true,
  smallURL: true,
  largeURL: true,
  localPhotoName: true,
  location: true,
  userName: true,
  projectName: true,
} satisfies Prisma.PhotoSelect

type GalleryPhotoRecord = Prisma.PhotoGetPayload<{ select: typeof photoSelect }>

function photoDate(photo: GalleryPhotoRecord) {
  const millis = Number(photo.timestamp)
  if (Number.isFinite(millis) && millis > 0) return new Date(millis)
  const parsed = Date.parse(photo.takePhotoFormatTime.replace(" ", "T"))
  return Number.isFinite(parsed) ? new Date(parsed) : new Date(0)
}

function formatDate(date: Date, locale: AppLocale) {
  const dateLocale = localeDateCode(locale)
  if (locale === "zh-Hans" || locale === "zh-Hant") {
    const parts = new Intl.DateTimeFormat(dateLocale, {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date)
    const get = (type: string) => parts.find((part) => part.type === type)?.value || ""
    return `${get("year")} 年 ${get("month")} 月 ${get("day")} 日`
  }
  return new Intl.DateTimeFormat(dateLocale, {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date)
}

function formatTime(date: Date, locale: AppLocale) {
  return new Intl.DateTimeFormat(localeDateCode(locale), {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)
}

function groupPhotosByDate(records: GalleryPhotoRecord[], locale: AppLocale): WebPhotoDay[] {
  const grouped = new Map<string, WebPhoto[]>()
  for (const photo of records) {
    const date = photoDate(photo)
    const dateText = formatDate(date, locale)
    const imageURL = resolvePhotoURL(photo.largeURL || photo.smallURL)
    const item: WebPhoto = {
      photoID: photo.photoID,
      imageURL,
      thumbnailURL: thumbnailPhotoURL(imageURL),
      downloadURL: `/api/web/photos/download?photoID=${encodeURIComponent(photo.photoID)}`,
      localPhotoName: photo.localPhotoName,
      location: photo.location,
      userName: photo.userName,
      projectName: photo.projectName,
      timeText: formatTime(date, locale),
    }
    const photos = grouped.get(dateText) || []
    photos.push(item)
    grouped.set(dateText, photos)
  }
  return Array.from(grouped, ([dateText, photos]) => ({ dateText, photos }))
}

export async function getTeamGallery(groupID: string, localeInput?: string) {
  const locale = resolveLocale(localeInput)
  const [team, photos, memberCount] = await Promise.all([
    prisma.team.findFirst({
      where: { groupID, deletedAt: null },
      select: { groupID: true, groupName: true, photos: { where: { deletedAt: null }, select: { photoID: true } } },
    }),
    prisma.photo.findMany({
      where: { groupID, deletedAt: null },
      select: photoSelect,
      orderBy: { timestamp: "desc" },
    }),
    prisma.teamMember.count({ where: { groupID, user: { deletedAt: null } } }),
  ])
  return {
    team,
    days: groupPhotosByDate(photos, locale),
    photoCount: photos.length,
    memberCount,
  }
}

export async function getProjectGallery(projectID: number, localeInput?: string) {
  const locale = resolveLocale(localeInput)
  const project = await prisma.project.findFirst({
    where: { projectID, deletedAt: null },
    include: {
      team: { select: { groupID: true, groupName: true, deletedAt: true } },
    },
  })
  if (!project || project.team.deletedAt) {
    return { project: null, days: [], photoCount: 0, memberCount: 0 }
  }

  const [photos, memberCount] = await Promise.all([
    prisma.photo.findMany({
      where: { groupID: project.groupID, projectID, deletedAt: null },
      select: photoSelect,
      orderBy: { timestamp: "desc" },
    }),
    prisma.teamMember.count({ where: { groupID: project.groupID, user: { deletedAt: null } } }),
  ])

  return {
    project,
    days: groupPhotosByDate(photos, locale),
    photoCount: photos.length,
    memberCount,
  }
}

export async function getUserGallery(userID: string, localeInput?: string) {
  const locale = resolveLocale(localeInput)
  const [user, photos] = await Promise.all([
    prisma.user.findFirst({
      where: { id: userID, deletedAt: null },
      select: { id: true, email: true, userName: true, shortName: true, avatar: true },
    }),
    prisma.photo.findMany({
      where: { userID, deletedAt: null },
      select: photoSelect,
      orderBy: { timestamp: "desc" },
    }),
  ])

  return {
    user,
    days: groupPhotosByDate(photos, locale),
    photoCount: photos.length,
  }
}
