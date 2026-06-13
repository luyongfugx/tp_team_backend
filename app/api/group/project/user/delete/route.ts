import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { asStringArray, bad, ok, readBody, requireTeamManager, requireUser } from "@/app/api/_utils/api"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    const projectID = Number(body.projectID)
    if (!Number.isFinite(projectID)) return bad()
    if (!(await requireTeamManager(groupID, user.id))) return bad("无项目成员管理权限", 403)
    await prisma.projectMember.deleteMany({
      where: { groupID, projectID, userID: { in: asStringArray(body.userID || body.userIDs) } },
    })
    return ok()
  } catch (err) {
    console.log("[app/group/project/user/delete] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
