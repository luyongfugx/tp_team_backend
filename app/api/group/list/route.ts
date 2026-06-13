import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, jsonSafe, ok, readBody, roleToID, roleToName, requireUser } from "@/app/api/_utils/api"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)

    if (typeof body.groupID === "string" && Array.isArray(body.settings)) {
      await prisma.teamMember.updateMany({
        where: { groupID: body.groupID, userID: user.id },
        data: { userSettings: body.settings },
      })
    }

    const memberships = await prisma.teamMember.findMany({
      where: { userID: user.id, team: { deletedAt: null } },
      include: {
        team: {
          include: {
            projects: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    })

    const groups = memberships.map((member) => ({
      groupID: member.groupID,
      groupName: member.team.groupName,
      role: roleToName(member.role),
      roleID: roleToID(member.role),
      userSettings: member.userSettings,
      projects: member.team.projects.map((project) => ({
        projectID: project.projectID,
        projectName: project.projectName,
        photoCount: project.photoCount,
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
        microBind: project.microBind,
      })),
      memberNum: member.team._count.members,
      memberSubscriptionInfo: member.team.memberSubscriptionInfo,
      accessControl: member.team.accessControl,
      syncNum: member.team.syncNum,
      isNew: member.team.isNew,
    }))

    return ok({ groups: jsonSafe(groups) })
  } catch (err) {
    console.log("[app/group/list] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
