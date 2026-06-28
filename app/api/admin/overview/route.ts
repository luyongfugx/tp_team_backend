import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, jsonSafe, ok, requireUser, roleToID, roleToName } from "@/app/api/_utils/api"
import { isSuperAdmin } from "@/app/api/_utils/admin"
import { localeFromRequest, t } from "@/lib/i18n"

export async function GET(req: Request) {
  try {
    const locale = localeFromRequest(req)
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)

    const superAdmin = isSuperAdmin(user)
    const teams = await prisma.team.findMany({
      where: superAdmin ? { deletedAt: null } : { ownerID: user.id, deletedAt: null },
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
          projectCount: teams.reduce((sum, team) => sum + team._count.projects, 0),
          photoCount,
        },
        teams: teams.map((team) => ({
          groupID: team.groupID,
          groupName: team.groupName,
          owner: team.owner,
          createdAt: team.createdAt,
          memberNum: team._count.members,
          projectNum: team._count.projects,
          photoNum: team._count.photos,
          members: team.members.map((member) => ({
            userID: member.userID,
            email: member.user.email,
            userName: member.user.userName,
            shortName: member.user.shortName,
            avatar: member.user.avatar,
            role: roleToName(member.role, locale),
            roleID: roleToID(member.role),
            joinedAt: member.joinedAt,
          })),
          projects: team.projects.map((project) => ({
            projectID: project.projectID,
            projectName: project.projectName,
            photoCount: project._count.photos,
            memberCount: project._count.members,
            latestPhotoTimestamp: project.latestPhotoTimestamp,
            latestPhotoSmallURL: project.latestPhotoSmallURL,
            createdAt: project.createdAt,
          })),
          photos: team.photos,
        })),
      }),
    )
  } catch (err) {
    console.log("[app/admin/overview] error:", err)
    return NextResponse.json({ error: t(localeFromRequest(req), "common.serverError") }, { status: 500 })
  }
}
