import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { badFor, jsonSafe, ok, requireUser, roleToID, roleToName } from "@/app/api/_utils/api"
import { isSuperAdmin } from "@/app/api/_utils/admin"
import { localeFromRequest, t } from "@/lib/i18n"

export async function GET(req: Request) {
  try {
    const locale = localeFromRequest(req)
    const url = new URL(req.url)
    const requestedPage = Number(url.searchParams.get("page") || "1")
    const requestedPageSize = Number(url.searchParams.get("pageSize") || "30")
    const pageSize = Number.isFinite(requestedPageSize) && requestedPageSize > 0 ? Math.min(Math.floor(requestedPageSize), 30) : 30
    const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1
    const skip = (page - 1) * pageSize
    const user = await requireUser(req)
    if (!user) return badFor(req, "未授权或登录已过期", 401)

    const superAdmin = isSuperAdmin(user)
    const teamWhere = superAdmin
      ? { deletedAt: null }
      : { deletedAt: null, members: { some: { userID: user.id } } }
    const relatedTeamWhere = superAdmin ? {} : { team: teamWhere }
    const [totalTeamCount, teams] = await Promise.all([
      prisma.team.count({ where: teamWhere }),
      prisma.team.findMany({
        where: teamWhere,
        include: {
          owner: { select: { id: true, email: true, userName: true, shortName: true, avatar: true } },
          members: {
            include: { user: { select: { id: true, email: true, userName: true, shortName: true, avatar: true } } },
            orderBy: { joinedAt: "asc" },
          },
          projects: {
            where: { deletedAt: null },
            orderBy: { createdAt: "desc" },
          },
          photos: {
            where: { deletedAt: null },
            orderBy: { createdAt: "desc" },
            take: 12,
            select: {
              photoID: true,
              projectID: true,
              userID: true,
              mediaType: true,
              timestamp: true,
              takePhotoFormatTime: true,
              smallURL: true,
              largeURL: true,
              userName: true,
              userAvatar: true,
              projectName: true,
              location: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
    ])

    const teamIDs = teams.map((team) => team.groupID)
    const [userCount, projectCount, photoCount] = await Promise.all([
      superAdmin
        ? prisma.user.count({ where: { deletedAt: null } })
        : prisma.teamMember
            .findMany({ where: { team: teamWhere }, select: { userID: true }, distinct: ["userID"] })
            .then((items) => items.length),
      prisma.project.count({ where: { deletedAt: null, ...relatedTeamWhere } }),
      prisma.photo.count({ where: { deletedAt: null, ...relatedTeamWhere } }),
    ])
    const teamPhotoCounts = await prisma.photo.groupBy({
      by: ["groupID"],
      where: { groupID: { in: teamIDs }, deletedAt: null },
      _count: { _all: true },
    })
    const projectPhotoCounts = await prisma.photo.groupBy({
      by: ["projectID"],
      where: { groupID: { in: teamIDs }, projectID: { not: null }, deletedAt: null },
      _count: { _all: true },
    })
    const memberPhotoCounts = await prisma.photo.groupBy({
      by: ["groupID", "userID"],
      where: { groupID: { in: teamIDs }, deletedAt: null },
      _count: { _all: true },
    })
    const teamPhotoCountByID = new Map(teamPhotoCounts.map((item) => [item.groupID, item._count._all]))
    const projectPhotoCountByID = new Map(projectPhotoCounts.map((item) => [item.projectID, item._count._all]))
    const memberPhotoCountByID = new Map(memberPhotoCounts.map((item) => [`${item.groupID}:${item.userID}`, item._count._all]))

    return ok(
      jsonSafe({
        role: superAdmin ? "SUPER_ADMIN" : "TEAM_OWNER",
        currentUser: {
          id: user.id,
          email: user.email,
          userName: user.userName,
          avatar: user.avatar,
        },
        summary: {
          teamCount: totalTeamCount,
          userCount,
          projectCount,
          photoCount,
        },
        pagination: {
          page,
          pageSize,
          totalCount: totalTeamCount,
          totalPages: Math.max(1, Math.ceil(totalTeamCount / pageSize)),
        },
        teams: teams.map((team) => {
          const currentMember = team.members.find((member) => member.userID === user.id)
          return {
            groupID: team.groupID,
            groupName: team.groupName,
            owner: team.owner,
            createdAt: team.createdAt,
            currentMember: currentMember
              ? {
                  userID: currentMember.userID,
                  role: roleToName(currentMember.role, locale),
                  roleID: roleToID(currentMember.role),
                  photoCount: memberPhotoCountByID.get(`${team.groupID}:${currentMember.userID}`) || 0,
                }
              : null,
            memberNum: team.members.length,
            projectNum: team.projects.length,
            photoNum: teamPhotoCountByID.get(team.groupID) || 0,
            members: team.members.map((member) => ({
              userID: member.userID,
              email: member.user.email,
              userName: member.user.userName,
              shortName: member.user.shortName,
              avatar: member.user.avatar,
              role: roleToName(member.role, locale),
              roleID: roleToID(member.role),
              photoCount: memberPhotoCountByID.get(`${team.groupID}:${member.userID}`) || 0,
              joinedAt: member.joinedAt,
            })),
            projects: team.projects.map((project) => ({
              projectID: project.projectID,
              projectName: project.projectName,
              photoCount: projectPhotoCountByID.get(project.projectID) || 0,
              latestPhotoTimestamp: project.latestPhotoTimestamp,
              latestPhotoSmallURL: project.latestPhotoSmallURL,
              addressInfo: {
                lat: project.lat,
                lng: project.lng,
                address: project.address,
                circle: project.circle,
                distanceUnit: project.distanceUnit,
                removeAddress: project.removeAddress,
              },
              createdAt: project.createdAt,
            })),
            photos: team.photos,
          }
        }),
      }),
    )
  } catch (err) {
    console.log("[app/admin/overview] error:", err)
    return NextResponse.json({ error: t(localeFromRequest(req), "common.serverError") }, { status: 500 })
  }
}
