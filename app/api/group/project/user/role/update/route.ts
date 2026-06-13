import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, ok, readBody, requireTeamManager, requireUser, roleIDToRole, roleToID } from "@/app/api/_utils/api"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    const projectID = Number(body.projectID)
    const targetUserID = typeof body.userID === "string" ? body.userID : ""
    if (!Number.isFinite(projectID) || !targetUserID) return bad()
    if (!(await requireTeamManager(groupID, user.id))) return bad("无项目成员管理权限", 403)
    const role = roleIDToRole(body.roleID)
    await prisma.projectMember.update({
      where: { projectID_userID: { projectID, userID: targetUserID } },
      data: { role, roleID: roleToID(role), accessControl: body.accessControl },
    })
    return ok()
  } catch (err) {
    console.log("[app/group/project/user/role/update] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
