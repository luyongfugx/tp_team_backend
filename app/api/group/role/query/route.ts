import { NextResponse } from "next/server"
import { bad, ok, readBody, requireTeamMember, requireUser, roleToID, roleToName } from "@/app/api/_utils/api"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const member = await requireTeamMember(body.groupID, user.id)
    if (!member) return bad("无团队访问权限", 403)
    const canManage = member.role === "OWNER" || member.role === "ADMIN"
    return ok({
      accessControl: {
        role: roleToName(member.role),
        roleID: roleToID(member.role),
        projectManageAC: canManage ? 3 : 0,
        projectAC: [{ projectID: 0, ac: 31 }],
      },
    })
  } catch (err) {
    console.log("[app/group/role/query] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
