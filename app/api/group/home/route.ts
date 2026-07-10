import { NextResponse } from "next/server"
import type { Prisma, TeamRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { jsonSafe, readBody, requireUser, roleToID, roleToName } from "@/app/api/_utils/api"
import { dayRangeForTimeZone, normalizeTimeZone } from "@/app/api/_utils/timezone"
import { localeFromRequest, t, type AppLocale } from "@/lib/i18n"

type HomeCode = 0 | 400 | 401 | 403 | 500

function homeResponse(code: HomeCode, data: Record<string, unknown> | null, message?: string, status = 200) {
  return NextResponse.json({ code, data, ...(message ? { message, error: message } : {}) }, { status })
}

function pageParams(body: Record<string, unknown>) {
  const pageIndex = Math.max(Number(body.pageIndex ?? 1), 1)
  const pageSize = Math.min(Math.max(Number(body.pageSize ?? 60), 1), 100)
  return { pageIndex, pageSize, skip: (pageIndex - 1) * pageSize, take: pageSize }
}

function hasOwn(body: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(body, key)
}

function decimalToNumber(value: unknown) {
  if (value == null) return null
  if (typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
    return value.toNumber()
  }
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

function jsonObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
}

const photoSelect = {
  photoID: true,
  mediaType: true,
  timestamp: true,
  takePhotoTimezoneID: true,
  largeURL: true,
  smallURL: true,
  ossFileName: true,
  localPhotoName: true,
  userID: true,
  userName: true,
  userShortName: true,
  userAvatar: true,
  user: { select: { userName: true, shortName: true, avatar: true } },
  projectID: true,
  projectName: true,
  location: true,
  lat: true,
  lng: true,
  timeInfo: true,
} satisfies Prisma.PhotoSelect

function mapPhoto(photo: Prisma.PhotoGetPayload<{ select: typeof photoSelect }>) {
  const timeInfo = jsonObject(photo.timeInfo)
  return {
    photoID: photo.photoID,
    mediaType: photo.mediaType,
    timestamp: Number(photo.timestamp),
    timezoneID: photo.takePhotoTimezoneID,
    timezoneAbbreviation: typeof timeInfo?.timezoneAbbreviation === "string" ? timeInfo.timezoneAbbreviation : null,
    largeURL: photo.largeURL,
    smallURL: photo.smallURL,
    ossFileName: photo.ossFileName,
    localPhotoName: photo.localPhotoName,
    userID: photo.userID,
    userName: photo.userName || photo.user.userName,
    userShortName: photo.userShortName || photo.user.shortName,
    userAvatar: photo.userAvatar || photo.user.avatar,
    projectID: photo.projectID,
    projectName: photo.projectName,
    location: photo.location,
    lat: decimalToNumber(photo.lat),
    lng: decimalToNumber(photo.lng),
  }
}

function mapProject(project: {
  projectID: number
  projectName: string
  photoCount: number
  latestPhotoTimestamp: bigint | null
  latestPhotoSmallURL: string | null
  lat: unknown
  lng: unknown
  address: string | null
  circle: number | null
  distanceUnit: string | null
  removeAddress: boolean
}) {
  return {
    projectID: project.projectID,
    projectName: project.projectName,
    photoCount: project.photoCount,
    latestPhotoTimestamp: project.latestPhotoTimestamp == null ? null : Number(project.latestPhotoTimestamp),
    latestPhotoSmallURL: project.latestPhotoSmallURL,
    addressInfo: {
      lat: decimalToNumber(project.lat),
      lng: decimalToNumber(project.lng),
      address: project.address,
      circle: project.circle,
      distanceUnit: project.distanceUnit,
      removeAddress: project.removeAddress,
    },
  }
}

function mapRole(role: TeamRole, locale: AppLocale) {
  return { role: roleToName(role, locale), roleID: roleToID(role) }
}

async function pendingInviteForUser(user: { id: string; email: string }, locale: AppLocale) {
  const now = new Date()
  const invite = await prisma.teamEmailInvite.findFirst({
    where: {
      email: user.email,
      acceptedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      team: { deletedAt: null, members: { none: { userID: user.id } } },
    },
    include: {
      team: { include: { _count: { select: { members: true } } } },
    },
    orderBy: { createdAt: "desc" },
  } as never)
  if (!invite) return null
  const typed = invite as unknown as {
    id: string
    groupID: string
    email: string
    role: TeamRole
    roleID: number
    uuID: string | null
    inviteCode: string | null
    expiresAt: Date | null
    createdAt: Date
    team: { groupName: string; _count: { members: number } }
  }
  return {
    inviteID: typed.id,
    groupID: typed.groupID,
    groupName: typed.team.groupName,
    uuid: typed.uuID,
    uuID: typed.uuID,
    inviteCode: typed.inviteCode,
    inviteLinkWay: "EMAIL",
    role: roleToName(typed.role, locale),
    roleID: roleToID(typed.role),
    email: typed.email,
    memberNum: typed.team._count.members,
    expiresAt: typed.expiresAt,
    createdAt: typed.createdAt,
  }
}

export async function POST(req: Request) {
  try {
    const body = await readBody(req)
    const locale = localeFromRequest(req, body)
    const user = await requireUser(req)
    if (!user) return homeResponse(401, null, "未授权或登录已过期", 401)

    const timeZone = normalizeTimeZone(
      typeof body.timeZone === "string" && body.timeZone.trim().length > 0
        ? body.timeZone
        : body.timezone,
    )
    const todayTimestamp = body.timestamp ?? body.takePhotoTimestamp
    const { pageIndex, pageSize, skip, take } = pageParams(body)

    const memberships = await prisma.teamMember.findMany({
      where: { userID: user.id, team: { deletedAt: null } },
      include: {
        team: {
          include: {
            projects: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
            members: { include: { user: true }, orderBy: { joinedAt: "asc" } },
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    })

    if (memberships.length === 0) {
      const pendingInvite = await pendingInviteForUser(user, locale)
      return homeResponse(0, {
        setupStep: pendingInvite ? "joinTeam" : "createTeam",
        selectedGroupID: null,
        selectedProjectID: null,
        pendingInvite,
        groups: [],
        photos: { totalCount: 0, pageIndex, pageSize, hasMore: false, list: [] },
        homeStats: {
          memberCount: 0,
          projectCount: 0,
          syncCount: 0,
          todayPhotoCount: 0,
          todayActiveMemberCount: 0,
          todayInactiveMemberCount: 0,
          latestPhotoID: null,
        },
      })
    }

    const requestedGroupID = typeof body.groupID === "string" && body.groupID ? body.groupID : null
    const membershipGroupIDs = new Set(memberships.map((member) => member.groupID))
    let selectedMembership =
      requestedGroupID && membershipGroupIDs.has(requestedGroupID)
        ? memberships.find((member) => member.groupID === requestedGroupID)
        : undefined
    if (!selectedMembership && user.selectedGroupID && membershipGroupIDs.has(user.selectedGroupID)) {
      selectedMembership = memberships.find((member) => member.groupID === user.selectedGroupID)
    }
    selectedMembership ||= memberships[0]
    if (!selectedMembership) return homeResponse(403, null, "无团队访问权限", 403)

    const selectedGroupID = selectedMembership.groupID
    const selectedTeam = selectedMembership.team
    const projects = selectedTeam.projects
    const requestedProjectWasProvided = hasOwn(body, "projectID")
    const requestedProjectID = body.projectID == null ? null : Number(body.projectID)
    if (requestedProjectWasProvided && requestedProjectID != null && !Number.isFinite(requestedProjectID)) {
      return homeResponse(400, null, "项目不正确", 400)
    }

    const projectIDs = new Set(projects.map((project) => project.projectID))
    let selectedProjectID: number | null
    if (requestedProjectWasProvided) {
      selectedProjectID = requestedProjectID && requestedProjectID > 0 ? requestedProjectID : null
    } else if (user.selectedGroupID === selectedGroupID && user.selectedProjectID == null) {
      selectedProjectID = null
    } else if (user.selectedProjectID && projectIDs.has(user.selectedProjectID)) {
      selectedProjectID = user.selectedProjectID
    } else {
      selectedProjectID = projects[0]?.projectID ?? null
    }
    if (selectedProjectID != null && !projectIDs.has(selectedProjectID)) {
      return homeResponse(400, null, "项目不存在")
    }

    const setupStep = projects.length === 0 ? "createProject" : "teamHome"
    const photoWhere: Prisma.PhotoWhereInput = {
      groupID: selectedGroupID,
      deletedAt: null,
      ...(selectedProjectID == null ? {} : { projectID: selectedProjectID }),
    }
    const todayPhotoWhere: Prisma.PhotoWhereInput = {
      groupID: selectedGroupID,
      deletedAt: null,
      timestamp: dayRangeForTimeZone(timeZone, todayTimestamp),
      ...(selectedProjectID == null ? {} : { projectID: selectedProjectID }),
    }

    const [totalCount, photos, todayPhotoCount, todayActiveMembers, latestPhoto] = await Promise.all([
      prisma.photo.count({ where: photoWhere }),
      prisma.photo.findMany({ where: photoWhere, select: photoSelect, orderBy: { timestamp: "desc" }, skip, take }),
      prisma.photo.count({ where: todayPhotoWhere }),
      prisma.photo.groupBy({ by: ["userID"], where: todayPhotoWhere, _count: { photoID: true } }),
      prisma.photo.findFirst({ where: photoWhere, select: { photoID: true }, orderBy: { timestamp: "desc" } }),
    ])

    const groupPayloads = memberships.map((member) => {
      const memberProjects = member.team.projects.map(mapProject)
      return {
        groupID: member.groupID,
        groupName: member.team.groupName,
        ...mapRole(member.role, locale),
        memberNum: member.team._count.members,
        syncNum: member.team.syncNum,
        defaultSelect: memberProjects[0]?.projectID ?? null,
        projects: memberProjects,
        members: member.team.members.map((teamMember) => ({
          userID: teamMember.userID,
          userName: teamMember.user.userName,
          shortName: teamMember.user.shortName,
          email: teamMember.user.email,
          avatar: teamMember.user.avatar,
          ...mapRole(teamMember.role, locale),
          photoCount: teamMember.photoCount,
          latestPhotoTimestamp: teamMember.latestPhotoTimestamp == null ? null : Number(teamMember.latestPhotoTimestamp),
          latestPhotoSmallURL: teamMember.latestPhotoSmallURL,
        })),
      }
    })
    const selectedProject = selectedProjectID == null
      ? null
      : projects.find((project) => project.projectID === selectedProjectID) ?? null

    await prisma.user.update({
      where: { id: user.id },
      data: { selectedGroupID, selectedProjectID } as never,
    }).catch(() => {})

    const todayActiveMemberCount = todayActiveMembers.length
    const memberCount = selectedTeam._count.members
    return homeResponse(0, jsonSafe({
      setupStep,
      selectedGroupID,
      selectedProjectID,
      selectedGroup: {
        groupID: selectedGroupID,
        groupName: selectedTeam.groupName,
        ...mapRole(selectedMembership.role, locale),
        memberNum: selectedTeam._count.members,
        syncNum: selectedTeam.syncNum,
      },
      selectedProject: selectedProject ? mapProject(selectedProject) : null,
      pendingInvite: null,
      groups: groupPayloads,
      photos: {
        totalCount,
        pageIndex,
        pageSize,
        hasMore: skip + photos.length < totalCount,
        list: photos.map(mapPhoto),
      },
      homeStats: {
        memberCount,
        projectCount: projects.length,
        syncCount: selectedTeam.syncNum,
        todayPhotoCount,
        todayActiveMemberCount,
        todayInactiveMemberCount: Math.max(memberCount - todayActiveMemberCount, 0),
        latestPhotoID: latestPhoto?.photoID ?? null,
      },
    }))
  } catch (err) {
    console.log("[app/group/home] error:", err)
    return homeResponse(500, null, t(localeFromRequest(req), "common.serverError"), 500)
  }
}
