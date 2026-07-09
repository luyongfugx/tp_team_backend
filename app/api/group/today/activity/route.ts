import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { bad, jsonSafe, ok, readBody, requireTeamMember, requireUser, roleToID, roleToName } from "@/app/api/_utils/api"
import { mapPhotoWithUserFallback, photoSelect } from "@/app/api/_utils/photo"

function timezoneOffsetMillis(timeZone: string, date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date)
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0)
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"))
  return asUTC - date.getTime()
}

function zonedMidnightUTC(timeZone: string, y: number, m: number, d: number) {
  let utc = Date.UTC(y, m - 1, d, 0, 0, 0, 0)
  utc -= timezoneOffsetMillis(timeZone, new Date(utc))
  utc -= timezoneOffsetMillis(timeZone, new Date(utc)) - timezoneOffsetMillis(timeZone, new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0)))
  return utc
}

function todayRange(timeZone: string) {
  const now = new Date()
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0)
  const start = zonedMidnightUTC(timeZone, get("year"), get("month"), get("day"))
  const end = start + 24 * 60 * 60 * 1000 - 1
  return { gte: BigInt(start), lte: BigInt(end) }
}

function mapMember(member: Prisma.TeamMemberGetPayload<{ include: { user: true } }>) {
  return {
    userID: member.userID,
    userName: member.user.userName,
    shortName: member.user.shortName,
    email: member.user.email,
    avatar: member.user.avatar,
    role: roleToName(member.role),
    roleID: roleToID(member.role),
    photoCount: member.photoCount,
    latestPhotoTimeInterval: member.latestPhotoTimeInterval,
    latestPhotoTimestamp: member.latestPhotoTimestamp,
    latestPhotoSmallURL: member.latestPhotoSmallURL,
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)

    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    if (!(await requireTeamMember(groupID, user.id))) return bad("无团队访问权限", 403)

    const rawProjectID = body.projectID == null ? null : Number(body.projectID)
    const projectID = rawProjectID == null || !Number.isFinite(rawProjectID) || rawProjectID <= 0 ? null : rawProjectID
    if (projectID != null) {
      const project = await prisma.project.findFirst({ where: { groupID, projectID, deletedAt: null }, select: { projectID: true } })
      if (!project) return bad("项目不存在或无访问权限", 404)
    }

    const timeZone = typeof body.timeZone === "string" && body.timeZone.trim().length > 0
      ? body.timeZone.trim()
      : "Asia/Shanghai"
    const todayPhotoWhere: Prisma.PhotoWhereInput = {
      groupID,
      deletedAt: null,
      timestamp: todayRange(timeZone),
      ...(projectID == null ? {} : { projectID }),
    }

    const [members, photos] = await Promise.all([
      prisma.teamMember.findMany({
        where: { groupID },
        include: { user: true },
        orderBy: { joinedAt: "asc" },
      }),
      prisma.photo.findMany({
        where: todayPhotoWhere,
        select: photoSelect(),
        orderBy: { timestamp: "desc" },
      }),
    ])

    const activeUserIDs = new Set(photos.map((photo) => photo.userID).filter(Boolean))
    const activeUsers = members.filter((member) => activeUserIDs.has(member.userID))
    const inactiveUsers = members.filter((member) => !activeUserIDs.has(member.userID))

    return ok(jsonSafe({
      groupID,
      projectID,
      timeZone,
      todayPhotoCount: photos.length,
      todayActiveMemberCount: activeUsers.length,
      todayInactiveMemberCount: inactiveUsers.length,
      photos: photos.map(mapPhotoWithUserFallback),
      activeUsers: activeUsers.map(mapMember),
      inactiveUsers: inactiveUsers.map(mapMember),
    }))
  } catch (err) {
    console.log("[app/group/today/activity] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
