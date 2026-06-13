import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { asStringArray, bad, ok, readBody, requireTeamManager, requireUser, roleIDToRole, roleToID } from "@/app/api/_utils/api"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    const projectID = Number(body.projectID)
    if (!Number.isFinite(projectID)) return bad()
    if (!(await requireTeamManager(groupID, user.id))) return bad("无项目成员管理权限", 403)
    const userIDs = asStringArray(body.userID || body.userIDs)
    const role = roleIDToRole(body.roleID)
    await prisma.projectMember.createMany({
      data: userIDs.map((userID) => ({
        groupID,
        projectID,
        userID,
        role,
        roleID: roleToID(role),
        accessControl: body.accessControl,
      })),
      skipDuplicates: true,
    })
    return ok()
  } catch (err) {
    console.log("[app/group/project/user/add] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
