import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { WebPhoto, WebPhotoDay } from "@/components/web/photo-gallery"
import { resolvePhotoURL } from "@/app/web/photo-url"

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

function formatDate(date: Date) {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value || ""
  return `${get("year")} 年 ${get("month")} 月 ${get("day")} 日`
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)
}

function groupPhotosByDate(records: GalleryPhotoRecord[]): WebPhotoDay[] {
  const grouped = new Map<string, WebPhoto[]>()
  for (const photo of records) {
    const date = photoDate(photo)
    const dateText = formatDate(date)
    const imageURL = resolvePhotoURL(photo.smallURL || photo.largeURL)
    const item: WebPhoto = {
      photoID: photo.photoID,
      imageURL,
      downloadURL: `/api/web/photos/download?photoID=${encodeURIComponent(photo.photoID)}`,
      localPhotoName: photo.localPhotoName,
      location: photo.location,
      userName: photo.userName,
      projectName: photo.projectName,
      timeText: formatTime(date),
    }
    const photos = grouped.get(dateText) || []
    photos.push(item)
    grouped.set(dateText, photos)
  }
  return Array.from(grouped, ([dateText, photos]) => ({ dateText, photos }))
}

export async function getTeamGallery(groupID: string) {
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
    prisma.teamMember.count({ where: { groupID } }),
  ])
  return {
    team,
    days: groupPhotosByDate(photos),
    photoCount: photos.length,
    memberCount,
  }
}

export async function getProjectGallery(projectID: number) {
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
    prisma.projectMember.count({ where: { projectID } }),
  ])

  return {
    project,
    days: groupPhotosByDate(photos),
    photoCount: photos.length,
    memberCount,
  }
}
