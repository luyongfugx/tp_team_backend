import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, jsonSafe, ok, readBody, requireTeamMember, requireUser, roleToID, roleToName } from "@/app/api/_utils/api"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    const projectID = Number(body.projectID)
    if (!Number.isFinite(projectID)) return bad()
    if (!(await requireTeamMember(groupID, user.id))) return bad("无团队访问权限", 403)
    const users = await prisma.projectMember.findMany({
      where: { groupID, projectID },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    })
    return ok({
      users: jsonSafe(users.map((item) => ({
        userID: item.userID,
        userName: item.user.userName,
        shortName: item.user.shortName,
        avatar: item.user.avatar,
        role: roleToName(item.role),
        roleID: roleToID(item.role),
        accessControl: item.accessControl,
      }))),
    })
  } catch (err) {
    console.log("[app/group/project/user/list] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
