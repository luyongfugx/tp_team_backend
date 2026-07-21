import { prisma } from "@/lib/prisma"
import { badFor, jsonSafe, ok, requireTeamMember, requireUser, serverError } from "@/app/api/_utils/api"
import { isSuperAdmin } from "@/app/api/_utils/admin"
import { resolvePhotoURL, thumbnailPhotoURL } from "@/app/web/photo-url"
import { localeDateCode, resolveLocale } from "@/lib/i18n"

const photoSelect = {
  photoID: true,
  timestamp: true,
  takePhotoFormatTime: true,
  takePhotoTimezoneID: true,
  smallURL: true,
  largeURL: true,
  localPhotoName: true,
  location: true,
  userName: true,
  projectName: true,
  createdAt: true,
}

const DEFAULT_DAY_PAGE_SIZE = 10
const MAX_DAY_PAGE_SIZE = 10

function photoDate(photo: { timestamp: bigint | number; takePhotoFormatTime: string; createdAt: Date }) {
  const millis = Number(photo.timestamp)
  if (Number.isFinite(millis) && millis > 0) return new Date(millis)
  const parsed = Date.parse(photo.takePhotoFormatTime.replace(" ", "T"))
  return Number.isFinite(parsed) ? new Date(parsed) : photo.createdAt
}

function parseOffsetMinutes(timeZone: string) {
  const trimmed = timeZone.trim()
  if (/^(GMT|UTC|Z)$/i.test(trimmed)) return 0
  const match = trimmed.match(/^(?:GMT|UTC)?([+-])(\d{1,2})(?::?(\d{2}))?$/i)
  if (!match) return null
  const hours = Number(match[2])
  const minutes = Number(match[3] ?? 0)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) return null
  return (match[1] === "-" ? -1 : 1) * (hours * 60 + minutes)
}

function validIanaTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date())
    return true
  } catch {
    return false
  }
}

function photoTimeZone(timeZone: string | null | undefined) {
  const value = typeof timeZone === "string" && timeZone.trim() ? timeZone.trim() : ""
  if (value && (parseOffsetMinutes(value) != null || validIanaTimeZone(value))) return value
  return "Asia/Shanghai"
}

function formatInPhotoTimeZone(date: Date, localeInput: string, timeZoneInput: string, options: Intl.DateTimeFormatOptions) {
  const offsetMinutes = parseOffsetMinutes(timeZoneInput)
  const zonedDate = offsetMinutes == null ? date : new Date(date.getTime() + offsetMinutes * 60 * 1000)
  const timeZone = offsetMinutes == null ? timeZoneInput : "UTC"
  return new Intl.DateTimeFormat(localeDateCode(resolveLocale(localeInput)), {
    timeZone,
    ...options,
  }).format(zonedDate)
}

function formatDate(date: Date, localeInput: string, timeZoneInput: string) {
  const locale = resolveLocale(localeInput)
  const dateLocale = localeDateCode(locale)
  const offsetMinutes = parseOffsetMinutes(timeZoneInput)
  const zonedDate = offsetMinutes == null ? date : new Date(date.getTime() + offsetMinutes * 60 * 1000)
  const timeZone = offsetMinutes == null ? timeZoneInput : "UTC"
  if (locale === "zh-Hans" || locale === "zh-Hant") {
    const parts = new Intl.DateTimeFormat(dateLocale, {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(zonedDate)
    const get = (type: string) => parts.find((part) => part.type === type)?.value || ""
    return `${get("year")} 年 ${get("month")} 月 ${get("day")} 日`
  }
  return new Intl.DateTimeFormat(dateLocale, {
    timeZone,
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(zonedDate)
}

function formatDateTime(date: Date, localeInput: string, timeZoneInput: string) {
  return formatInPhotoTimeZone(date, localeInput, timeZoneInput, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

export async function GET(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return badFor(req, "未授权或登录已过期", 401)

    const url = new URL(req.url)
    const groupID = url.searchParams.get("groupID") || ""
    const projectIDValue = url.searchParams.get("projectID")
    const requestedProjectID = projectIDValue == null ? null : Number(projectIDValue)
    const userID = url.searchParams.get("userID") || ""
    const locale = url.searchParams.get("locale") || "zh-Hans"
    const requestedPage = Number(url.searchParams.get("page") || "1")
    const requestedPageSize = Number(url.searchParams.get("pageSize") || String(DEFAULT_DAY_PAGE_SIZE))
    const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1
    const pageSize = Number.isFinite(requestedPageSize) && requestedPageSize > 0
      ? Math.min(Math.floor(requestedPageSize), MAX_DAY_PAGE_SIZE)
      : DEFAULT_DAY_PAGE_SIZE
    if (!groupID) return badFor(req, "参数不正确")
    if (requestedProjectID != null && (!Number.isFinite(requestedProjectID) || requestedProjectID <= 0)) return badFor(req, "项目不正确")

    if (!isSuperAdmin(user) && !(await requireTeamMember(groupID, user.id))) {
      return badFor(req, "无团队访问权限", 403)
    }

    const team = await prisma.team.findFirst({
      where: { groupID, deletedAt: null },
      select: { groupID: true, groupName: true },
    })
    if (!team) return badFor(req, "团队不存在", 404)

    const projectID = requestedProjectID
    const project = projectID == null
      ? null
      : await prisma.project.findFirst({
          where: { groupID, projectID, deletedAt: null },
          select: { projectID: true, projectName: true },
        })
    if (projectID != null && !project) return badFor(req, "项目不存在", 404)

    const member = userID
      ? await prisma.teamMember.findUnique({
          where: { groupID_userID: { groupID, userID } },
          select: {
            userID: true,
            user: { select: { id: true, email: true, userName: true } },
          },
        })
      : null
    if (userID && !member) return badFor(req, "成员不存在", 404)

    const photos = await prisma.photo.findMany({
      where: {
        groupID,
        deletedAt: null,
        ...(projectID == null ? {} : { projectID }),
        ...(userID ? { userID } : {}),
      },
      select: photoSelect,
      orderBy: { timestamp: "desc" },
    })

    const grouped = new Map<string, Array<Record<string, unknown>>>()
    for (const photo of photos) {
      const date = photoDate(photo)
      const timeZone = photoTimeZone(photo.takePhotoTimezoneID)
      const dateText = formatDate(date, locale, timeZone)
      const imageURL = resolvePhotoURL(photo.largeURL || photo.smallURL)
      const items = grouped.get(dateText) || []
      items.push({
        photoID: photo.photoID,
        imageURL,
        thumbnailURL: thumbnailPhotoURL(imageURL),
        downloadURL: `/api/web/photos/download?photoID=${encodeURIComponent(photo.photoID)}`,
        localPhotoName: photo.localPhotoName,
        location: photo.location,
        userName: photo.userName,
        projectName: photo.projectName,
        timeText: formatDateTime(date, locale, timeZone),
        timeZone,
      })
      grouped.set(dateText, items)
    }

    const allDays = Array.from(grouped, ([dateText, items]) => ({ dateText, photos: items }))
    const totalDays = allDays.length
    const totalPages = Math.max(1, Math.ceil(totalDays / pageSize))
    const currentPage = Math.min(page, totalPages)
    const start = (currentPage - 1) * pageSize
    const pagedDays = allDays.slice(start, start + pageSize)

    return ok(jsonSafe({
      team,
      project,
      member,
      totalCount: photos.length,
      totalDays,
      page: currentPage,
      pageSize,
      totalPages,
      days: pagedDays,
    }))
  } catch (err) {
    console.log("[app/admin/team-photos] error:", err)
    return serverError(req)
  }
}
