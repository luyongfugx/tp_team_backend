import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bad, ok, readBody, requireTeamManager, requireUser } from "@/app/api/_utils/api"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    if (typeof body.groupName !== "string" || !body.groupName.trim()) return bad()
    if (!(await requireTeamManager(groupID, user.id))) return bad("无团队管理权限", 403)
    await prisma.team.update({ where: { groupID }, data: { groupName: body.groupName.trim() } })
    return ok()
  } catch (err) {
    console.log("[app/group/name/update] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
