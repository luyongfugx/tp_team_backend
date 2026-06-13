import { NextResponse } from "next/server"
import { bad, ok, readBody, requireTeamManager, requireUser } from "@/app/api/_utils/api"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    if (!(await requireTeamManager(body.groupID, user.id))) return bad("无团队管理权限", 403)
    return ok({ roles: [{ role: "管理员", roleID: 2 }, { role: "普通成员", roleID: 3 }] })
  } catch (err) {
    console.log("[app/group/user/invite/role/list] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
