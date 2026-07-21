import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { badFor, jsonSafe, ok, requireUser, roleToID, roleToName } from "@/app/api/_utils/api"
import { isSuperAdmin } from "@/app/api/_utils/admin"
import { localeFromRequest, t } from "@/lib/i18n"

export async function GET(req: Request) {
  try {
    const locale = localeFromRequest(req)
    const user = await requireUser(req)
    if (!user) return badFor(req, "未授权或登录已过期", 401)

    const superAdmin = isSuperAdmin(user)
    const teams = await prisma.team.findMany({
      where: superAdmin
        ? { deletedAt: null }
        : { deletedAt: null, members: { some: { userID: user.id } } },
      include: {
        owner: { select: { id: true, email: true, userName: true, shortName: true, avatar: true } },
        members: {
          include: { user: { select: { id: true, email: true, userName: true, shortName: true, avatar: true } } },
          orderBy: { joinedAt: "asc" },
        },
        projects: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { members: true, photos: true } } },
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
        _count: { select: { members: true, projects: true, photos: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    const teamIDs = teams.map((team) => team.groupID)
    const userCount = superAdmin
      ? await prisma.user.count({ where: { deletedAt: null } })
      : await prisma.teamMember
          .findMany({ where: { groupID: { in: teamIDs } }, select: { userID: true }, distinct: ["userID"] })
          .then((items) => items.length)
    const photoCount = await prisma.photo.count({ where: { groupID: { in: teamIDs }, deletedAt: null } })
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
          teamCount: teams.length,
          userCount,
          projectCount: teams.reduce((sum, team) => sum + team.projects.length, 0),
          photoCount,
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
            memberNum: team._count.members,
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
              memberCount: project._count.members,
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
