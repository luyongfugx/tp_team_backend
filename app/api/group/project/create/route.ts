import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, jsonSafe, ok, readBody, requireTeamManager, requireUser } from "@/app/api/_utils/api"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    if (typeof body.projectName !== "string" || !body.projectName.trim()) return bad()
    if (!(await requireTeamManager(groupID, user.id))) return bad("无团队管理权限", 403)

    const teamMembers = await prisma.teamMember.findMany({ where: { groupID }, select: { userID: true, role: true, roleID: true } })
    const project = await prisma.project.create({
      data: {
        groupID,
        projectName: body.projectName.trim(),
        lat: body.lat == null ? undefined : String(body.lat),
        lng: body.lng == null ? undefined : String(body.lng),
        address: typeof body.address === "string" ? body.address : undefined,
        circle: body.circle == null ? undefined : Number(body.circle),
        distanceUnit: typeof body.distanceUnit === "string" ? body.distanceUnit : undefined,
        microBind: body.microBind ?? undefined,
        members: {
          create: teamMembers.map((member) => ({
            groupID,
            userID: member.userID,
            role: member.role,
            roleID: member.roleID,
          })),
        },
      },
    })
    return ok({ projectInfo: jsonSafe(project) })
  } catch (err) {
    console.log("[app/group/project/create] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
